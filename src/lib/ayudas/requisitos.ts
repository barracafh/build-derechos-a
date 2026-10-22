// ver_requisitos: el texto oficial de quién puede pedir una ayuda, cuánto da y
// el plazo. Devuelve fragmentos literales para que el agente cite, no resúmenes.
import { leerDocumento, leerFicha, recordar, type Prioridad } from "./bdns";
import { enlacesCatalogo, entradaCatalogo } from "./catalogo";
import { AVISO_CENTRAL, centralPorId, enlacesCentral, VERSION_CENTRAL } from "./central";
import { comprobarEnlaces } from "./enlaces";
import { enlacesRenta, RENTAS_CONSULTADO, rentaPorId } from "./rentas";
import { delPack, desdeApi, enlacesDe, type Convocatoria, type Enlaces } from "./convocatoria";

export type Fragmento = { apartado: string; texto: string };

export type Requisitos =
  | {
      id: string;
      titulo: string;
      origen: string;
      enlace_origen: string | null;
      fragmentos: Fragmento[];
      documentacion?: string[];
      pasos?: string[];
      enlace: string;
      enlaces: Enlaces;
      aviso: string;
    }
  | { error: string };

const AVISO =
  "Texto literal de la fuente oficial. Explica solo lo que aparece aquí, cita la frase y di «podrías optar», nunca «tienes derecho».";

const MAX_FRAGMENTO = 3500;

export function htmlATexto(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const recortar = (s: string, max = MAX_FRAGMENTO) =>
  s.length > max ? `${s.slice(0, max).trimEnd()} […]` : s;

// Los extractos de los boletines siguen un esquema fijo:
// «Primero. Beneficiarios. … Segundo. Objeto. … Cuarto. Cuantía. … Quinto. Plazo…».
const ORDINAL =
  /(?:^|\n)\s*(primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo|primer|segon|tercer|quart|cinqu[eè]|sis[eè]|set[eè]|vuit[eè])(?:\s*[.:\-–—])+\s*/gi;

export function partirExtracto(texto: string): Fragmento[] {
  const cortes = [...texto.matchAll(ORDINAL)];
  if (cortes.length < 2) return [];
  return cortes.map((m, i) => {
    const desde = m.index! + m[0].length;
    const hasta = i + 1 < cortes.length ? cortes[i + 1].index! : texto.length;
    const cuerpo = texto.slice(desde, hasta).trim();
    // «Personas beneficiarias. Podrán ser…» → apartado y texto.
    const m2 = cuerpo.match(/^([^\n.]{1,120})[.\n]\s*([\s\S]*)$/);
    const apartado = (m2?.[1] ?? cuerpo.slice(0, 60)).replace(/[.:\s]+$/, "");
    return { apartado, texto: recortar(m2?.[2]?.trim() || cuerpo) };
  });
}

// En el PDF de la convocatoria: el apartado de cada tema, desde su título hasta
// el siguiente apartado. Los títulos empiezan por «Artículo 3.», «Quinto.»,
// «Base 2», «IV.», «2.» o una raya; se saltan el índice (con puntos) y los
// apartados de obligaciones o reintegros, que también nombran a los beneficiarios.
const ORDINALES =
  "primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|s[eé]ptim[oa]|octav[oa]|noven[oa]|d[eé]cim[oa]\\S*|und[eé]cim[oa]|duod[eé]cim[oa]|primera|segon[a]?|tercera|quart[a]?|cinqu[eè]|sis[eè]|set[eè]";
const PALABRA_APARTADO = new RegExp(
  `^(?:(?:art[ií]culo|base|apartado|cap[ií]tulo|disposici[oó]n)\\s+(?:\\d+|${ORDINALES})\\s*º?\\s*[.:\\-–—]|(?:${ORDINALES})\\s*[.:\\-–—])`,
  "i",
);
// Con mayúscula: «artículo 13 de la Ley…» a mitad de frase no es un apartado.
const esApartado = (l: string) =>
  /^[A-ZÁÉÍÓÚÑ]/.test(l) && (PALABRA_APARTADO.test(l) || /^[IVXL]{1,5}[.)\-–]\s/.test(l));
const esTitulo = (l: string) => esApartado(l) || /^(?:\d{1,2}[.)º]-?\s|[—–-]\s)/.test(l);
const INDICE = /\.{5,}|(?:\. ){5,}/;
// Pies de firma y de página: solo marcas que no salen en el texto de la convocatoria.
const RUIDO =
  /\bCSV\b|comprobar la autenticidad|cargo=|url de verificaci|c[oó]digo seguro de verificaci|verifirma|servicios electr[oó]nicos de confianza|^firmado por|p[aá]gina \d+\s*(de|\/)\s*\d+|^p[aá]gina \d+$|^\d+\s*$|^https?:\/\/\S+$/i;

const TEMAS_PDF: [string, RegExp][] = [
  ["Personas beneficiarias y requisitos", /beneficiari|requisitos|destinatari|persones beneficiàries|podr[aá]n (?:solicitar|optar|participar|ser)/i],
  ["Cuantía", /cuant[ií]a|importe|quant[ií]a/i],
  ["Plazo y forma de presentación", /plazo de presentaci|presentaci[oó]n de solicitudes|termini de presentaci|plazo de solicitud|solicitudes y plazo|forma, lugar y plazo/i],
  ["Documentación", /documentaci[oó]n/i],
];
const NO_ES = /obligaci|reintegr|justificaci|incumplim|cesi[oó]n de datos|resoluci[oó]n/i;

// Une las líneas que el PDF corta a mitad de frase: un párrafo nuevo empieza
// tras punto, dos puntos o punto y coma, o con una letra o número de lista.
export function parrafos(lineas: string[]): string[] {
  const out: string[] = [];
  for (const l of lineas) {
    const prev = out.at(-1);
    const nuevo = !prev || /[.:;]$/.test(prev) || /^(?:\d{1,2}[.)º]|[a-zñ]\)|[-–—•·]|[ivx]+\))\s?/i.test(l);
    if (nuevo) out.push(l);
    else out[out.length - 1] = prev.endsWith("-") ? prev.slice(0, -1) + l : `${prev} ${l}`;
  }
  return out;
}

function apartadoPdf(lineas: string[], tema: RegExp): string | null {
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const cabeza = l.slice(0, 90);
    if (!esTitulo(l) || INDICE.test(l) || !tema.test(cabeza) || NO_ES.test(cabeza)) continue;
    // Un título corto («4. Requisitos…») va solo. Si empieza por «4.», acaba en el «5.».
    const soloTitulo = l.length < 100 && /^[A-ZÁÉÍÓÚÑ¿«"]/.test(lineas[i + 1] ?? "");
    const n = l.match(/^(\d{1,2})\.\s/)?.[1];
    const siguiente = n ? new RegExp(`^${Number(n) + 1}\\.\\s`) : null;
    const cuerpo: string[] = [];
    let largo = 0;
    for (let j = i + 1; j < lineas.length && largo < MAX_FRAGMENTO; j++) {
      if (esApartado(lineas[j]) || siguiente?.test(lineas[j])) break;
      cuerpo.push(lineas[j]);
      largo += lineas[j].length;
    }
    if (largo < 80) continue; // título suelto o índice
    return recortar((soloTitulo ? [l, ...parrafos(cuerpo)] : parrafos([l, ...cuerpo])).join("\n"));
  }
  return null;
}

const lineasPdf = (texto: string) =>
  texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !RUIDO.test(l));

export function fragmentosPdf(texto: string): Fragmento[] {
  const lineas = lineasPdf(texto);
  const out: Fragmento[] = [];
  for (const [apartado, re] of TEMAS_PDF) {
    const t = apartadoPdf(lineas, re);
    if (t) out.push({ apartado, texto: t });
  }
  return out;
}

async function textoPdf(id: string, p?: Prioridad): Promise<string> {
  return recordar(
    `pdf:${id}`,
    30 * 60_000,
    async () => {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(await leerDocumento(id, p));
      const { text } = await extractText(pdf, { mergePages: true });
      return text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
    },
    p,
  );
}

// El PDF de la convocatoria (en castellano si hay varios) y su texto, si lo tiene.
async function pdfDe(c: Convocatoria, p?: Prioridad): Promise<{ doc: Convocatoria["documentos"][number]; texto: string } | null> {
  const doc =
    c.documentos.find((d) => /castellano|español/i.test(d.descripcion)) ??
    c.documentos.find((d) => /convocatoria/i.test(d.descripcion)) ??
    c.documentos[0];
  if (!doc) return null;
  try {
    const texto = await textoPdf(doc.id, p);
    return texto.trim().length > 300 ? { doc, texto } : null;
  } catch {
    // PDF escaneado, demasiado grande o sin respuesta.
    return null;
  }
}

const esBeneficiarios = (f: Fragmento) => /beneficiari|requisit|destinatari|solicitantes/i.test(f.apartado);

async function convocatoria(numero: string, p?: Prioridad): Promise<Convocatoria | null> {
  try {
    return desdeApi(await leerFicha(numero, p));
  } catch {
    return delPack(numero);
  }
}

export async function verRequisitos(id: string): Promise<Requisitos> {
  const [fuente, clave] = id.split(":");

  if (fuente === "catalogo") {
    const e = entradaCatalogo(clave);
    if (!e) return { error: `No hay ninguna ayuda «${id}» en el catálogo.` };
    return {
      id,
      titulo: e.titulo,
      origen: `Catálogo curado, comprobado en ${e.fuente}`,
      enlace_origen: e.enlace_info,
      fragmentos: [
        { apartado: "Requisitos clave", texto: e.requisitos_clave.join("\n") },
        ...(e.plazo ? [{ apartado: "Plazo", texto: e.plazo }] : []),
      ],
      documentacion: e.documentacion,
      pasos: e.pasos,
      enlace: e.enlace_info,
      enlaces: enlacesCatalogo(e),
      aviso: e.verificado ? AVISO : `${AVISO} Esta entrada NO está verificada: dilo.`,
    };
  }

  if (fuente === "renta") {
    const r = rentaPorId(clave);
    if (!r) return { error: `No hay ninguna renta autonómica «${id}».` };
    return {
      id,
      titulo: r.titulo,
      origen: `Página oficial de ${r.organismo}, consultada el ${RENTAS_CONSULTADO}`,
      enlace_origen: r.enlace_info,
      fragmentos: [
        { apartado: "Requisitos", texto: r.requisitos_clave.join("\n") },
        ...(r.plazo ? [{ apartado: "Plazo", texto: r.plazo }] : []),
        ...(r.nota ? [{ apartado: "Nota", texto: r.nota }] : []),
      ],
      enlace: r.enlace_info,
      enlaces: enlacesRenta(r),
      aviso: AVISO,
    };
  }

  if (fuente === "central") {
    const a = centralPorId(clave ?? "");
    if (!a) return { error: `No hay ninguna ayuda «${id}» en el almacén de ayudas centrales.` };
    const texto = (l: string[] | undefined) => (l ?? []).map((x) => x.trim()).filter(Boolean).join("\n");
    const plazo = [a.plazoListado?.texto, a.plazo].map((x) => (x ?? "").trim()).filter(Boolean).join("\n");
    return {
      id,
      titulo: a.titulo,
      origen: `Página oficial de ${a.organismo || a.administracion}, leída por un programa el ${VERSION_CENTRAL}`,
      enlace_origen: a.enlace_info,
      fragmentos: [
        { apartado: "Requisitos", texto: texto(a.requisitos_clave) },
        { apartado: "Cuantía", texto: (a.cuantia ?? "").trim() },
        { apartado: "Plazo", texto: plazo },
        { apartado: "Quién no puede pedirla", texto: texto(a.exclusiones) },
      ].filter((f) => f.texto),
      documentacion: a.documentacion,
      pasos: a.pasos,
      enlace: a.enlace_info,
      enlaces: enlacesCentral(a),
      aviso: `${AVISO} ${AVISO_CENTRAL}`,
    };
  }

  if (fuente !== "bdns" || !/^\d+$/.test(clave ?? ""))
    return { error: `Identificador no válido: «${id}». Usa el id que devuelve buscar_ayudas.` };

  const c = await convocatoria(clave);
  if (!c) return { error: "La BDNS no responde y la convocatoria no está en la copia de respaldo." };
  const base = { id, titulo: c.titulo, enlace: c.enlace, enlaces: await comprobarEnlaces(enlacesDe(c)), aviso: AVISO };

  // 1. Extracto del boletín que viene dentro de la ficha (sin coste extra).
  const anuncio = c.anuncios.find((a) => a.texto && a.texto.length > 200);
  if (anuncio?.texto) {
    const texto = htmlATexto(anuncio.texto);
    const partes = partirExtracto(texto);
    // Si el extracto no tiene el apartado de quién puede pedirla, se busca en el PDF.
    const delPdf = partes.some(esBeneficiarios)
      ? []
      : await pdfDe(c).then((p) =>
          (p ? fragmentosPdf(p.texto) : [])
            .filter(esBeneficiarios)
            .map((f) => ({ ...f, apartado: `${f.apartado} (PDF de la convocatoria)` })),
        );
    return {
      ...base,
      origen: `Extracto publicado en ${anuncio.diario ?? "el diario oficial"}${anuncio.fecha ? ` el ${anuncio.fecha.split("-").reverse().join("/")}` : ""}`,
      enlace_origen: anuncio.url,
      fragmentos: [...(partes.length ? partes : [{ apartado: "Extracto", texto: recortar(texto, 6000) }]), ...delPdf],
    };
  }

  // 2. PDF de la convocatoria (segunda llamada).
  const pdf = await pdfDe(c);
  if (pdf) {
    const fr = fragmentosPdf(pdf.texto);
    return {
      ...base,
      origen: `Documento de la convocatoria (PDF): ${pdf.doc.descripcion}`,
      enlace_origen: pdf.doc.url,
      fragmentos: fr.length
        ? fr
        : [{ apartado: "Inicio de la convocatoria", texto: recortar(parrafos(lineasPdf(pdf.texto)).join("\n"), 5000) }],
    };
  }

  return {
    ...base,
    origen: "La BDNS no trae el texto de esta convocatoria",
    enlace_origen: base.enlaces.convocatoria ?? base.enlaces.bases ?? c.enlace,
    fragmentos: [],
    aviso: "No hay texto oficial que leer: di que no puedes confirmar los requisitos y enlaza la ficha oficial y las bases.",
  };
}

// Quién puede pedirla, para las tarjetas del chat: el apartado del extracto del
// boletín o, si no lo trae, el del PDF de la convocatoria. Frases literales,
// recortadas si son muy largas. El detalle completo, con verRequisitos.
const MAX_LINEA = 280;

export async function requisitosParaFicha(numero: string, p?: Prioridad): Promise<string[]> {
  const c = await convocatoria(numero, p);
  if (!c) return [];
  const anuncio = c.anuncios.find((a) => a.texto && a.texto.length > 200);
  let parte = anuncio?.texto ? partirExtracto(htmlATexto(anuncio.texto)).find(esBeneficiarios) : undefined;
  const desdePdf = !parte;
  if (!parte) {
    const pdf = await pdfDe(c, p);
    parte = pdf ? fragmentosPdf(pdf.texto).find(esBeneficiarios) : undefined;
  }
  if (!parte) return [];
  const lineas = parte.texto.split("\n").map((l) => l.trim());
  // Sin el título del apartado del PDF («Artículo 3. Requisitos de acceso.»);
  // el extracto ya llega sin él.
  if (desdePdf && lineas.length > 1 && lineas[0].length < 100 && esApartado(lineas[0])) lineas.shift();
  const corte = (l: string) => {
    const espacio = l.lastIndexOf(" ", MAX_LINEA);
    return `${l.slice(0, espacio > MAX_LINEA / 2 ? espacio : MAX_LINEA)} […]`;
  };
  return lineas
    .filter((l) => l.length > 3)
    .slice(0, 6)
    .map((l) => (l.length > MAX_LINEA ? corte(l) : l));
}
