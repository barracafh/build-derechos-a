// ver_requisitos: el texto oficial de quién puede pedir una ayuda, cuánto da y
// el plazo. Devuelve fragmentos literales para que el agente cite, no resúmenes.
import { leerDocumento, leerFicha, recordar } from "./bdns";
import { entradaCatalogo } from "./catalogo";
import { delPack, desdeApi, type Convocatoria } from "./convocatoria";

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
      enlace_bases: string | null;
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

// En el PDF de la convocatoria: el primer bloque que trata de cada tema.
const TEMAS_PDF: [string, RegExp][] = [
  ["Personas beneficiarias y requisitos", /(?:^|\n)[^\n]{0,40}(beneficiari[oa]s|requisitos|persones beneficiàries|destinatari[oa]s)[^\n]{0,60}\n/i],
  ["Cuantía", /(?:^|\n)[^\n]{0,40}(cuant[ií]a|importe|quant[ií]a|import de)[^\n]{0,60}\n/i],
  ["Plazo y forma de presentación", /(?:^|\n)[^\n]{0,40}(plazo de presentaci|presentaci[oó]n de solicitudes|termini de presentaci|solicitudes y plazo)[^\n]{0,60}\n/i],
  ["Documentación", /(?:^|\n)[^\n]{0,40}(documentaci[oó]n)[^\n]{0,60}\n/i],
];

export function fragmentosPdf(texto: string): Fragmento[] {
  const out: Fragmento[] = [];
  for (const [apartado, re] of TEMAS_PDF) {
    const m = texto.match(re);
    if (!m || m.index === undefined) continue;
    out.push({ apartado, texto: recortar(texto.slice(m.index, m.index + MAX_FRAGMENTO).trim()) });
  }
  return out;
}

async function textoPdf(id: string): Promise<string> {
  return recordar(`pdf:${id}`, 30 * 60_000, async () => {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(await leerDocumento(id));
    const { text } = await extractText(pdf, { mergePages: true });
    return text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
  });
}

async function convocatoria(numero: string): Promise<Convocatoria | null> {
  try {
    return desdeApi(await leerFicha(numero));
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
      enlace: e.enlace_tramite ?? e.enlace_info,
      enlace_bases: e.enlace_info,
      aviso: e.verificado ? AVISO : `${AVISO} Esta entrada NO está verificada: dilo.`,
    };
  }

  if (fuente !== "bdns" || !/^\d+$/.test(clave ?? ""))
    return { error: `Identificador no válido: «${id}». Usa el id que devuelve buscar_ayudas.` };

  const c = await convocatoria(clave);
  if (!c) return { error: "La BDNS no responde y la convocatoria no está en la copia de respaldo." };
  const base = { id, titulo: c.titulo, enlace: c.enlace, enlace_bases: c.bases.url, aviso: AVISO };

  // 1. Extracto del boletín que viene dentro de la ficha (sin coste extra).
  const anuncio = c.anuncios.find((a) => a.texto && a.texto.length > 200);
  if (anuncio?.texto) {
    const texto = htmlATexto(anuncio.texto);
    const partes = partirExtracto(texto);
    return {
      ...base,
      origen: `Extracto publicado en ${anuncio.diario ?? "el diario oficial"}${anuncio.fecha ? ` el ${anuncio.fecha.split("-").reverse().join("/")}` : ""}`,
      enlace_origen: anuncio.url,
      fragmentos: partes.length ? partes : [{ apartado: "Extracto", texto: recortar(texto, 6000) }],
    };
  }

  // 2. PDF de la convocatoria (segunda llamada).
  const doc =
    c.documentos.find((d) => /castellano|español/i.test(d.descripcion)) ??
    c.documentos.find((d) => /convocatoria/i.test(d.descripcion)) ??
    c.documentos[0];
  if (doc) {
    try {
      const texto = await textoPdf(doc.id);
      if (texto.trim().length > 300) {
        const fr = fragmentosPdf(texto);
        return {
          ...base,
          origen: `Documento de la convocatoria (PDF): ${doc.descripcion}`,
          enlace_origen: doc.url,
          fragmentos: fr.length ? fr : [{ apartado: "Inicio de la convocatoria", texto: recortar(texto, 5000) }],
        };
      }
    } catch {
      // PDF escaneado, demasiado grande o sin respuesta: se cae al enlace.
    }
  }

  return {
    ...base,
    origen: "La BDNS no trae el texto de esta convocatoria",
    enlace_origen: c.bases.url ?? c.enlace,
    fragmentos: [],
    aviso: "No hay texto oficial que leer: di que no puedes confirmar los requisitos y enlaza la ficha oficial y las bases.",
  };
}

// Requisitos de una convocatoria ya leída, solo si su ficha trae el extracto del
// boletín: no descarga PDF. Para las tarjetas del chat; el detalle completo, con
// verRequisitos.
export async function requisitosDelExtracto(numero: string): Promise<string[]> {
  const c = await convocatoria(numero);
  const anuncio = c?.anuncios.find((a) => a.texto && a.texto.length > 200);
  if (!anuncio?.texto) return [];
  const parte = partirExtracto(htmlATexto(anuncio.texto)).find((p) =>
    /beneficiari|requisit|destinatari|solicitantes/i.test(p.apartado),
  );
  if (!parte) return [];
  return parte.texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3)
    .slice(0, 8);
}
