// buscar_ayudas: del municipio y la necesidad a las ayudas a las que el
// ciudadano podría optar, con estado comprobado por fechas y enlace oficial.
import {
  buscarConvocatorias,
  leerFicha,
  type FiltrosBusqueda,
  type ResultadoBusqueda,
} from "./bdns";
import {
  ayudasCatalogo,
  aplicaEn,
  CATALOGO_VERSION,
  enlacesCatalogo,
  estadoCatalogo,
  temasCatalogo,
} from "./catalogo";
import {
  delPack,
  desdeApi,
  enlacesDe,
  grupoDelPack,
  PACK_CONSULTADO,
  type Convocatoria,
  type Enlaces,
} from "./convocatoria";
import { buscarRecurrentes, type Recurrente } from "./recurrentes";
import { enlacesRenta, estadoRenta, rentaDe } from "./rentas";
import { calcularEstado, fechaLegible, hoyEnMadrid, sumarDias, type Estado } from "./plazo";
import { normalizar } from "./nombres";
import { palabrasEnTitulo, relevancia, temasQueEncajan, type Tema } from "./temas";
import { regionCubre, resolverUbicacion, type ErrorUbicacion, type Ubicacion } from "./territorio";

export type ArgsBuscar = {
  municipio?: string;
  provincia?: string;
  temas?: Tema[];
  palabras?: string[];
  autonomo?: boolean;
  incluir_cerradas?: boolean;
  pagina?: number;
  // false si quien llama ya tiene su propio catálogo (el motor del chat).
  catalogo?: boolean;
};

export type Nivel = "Estado" | "Comunidad autónoma" | "Local";

export type AyudaEncontrada = {
  id: string;
  titulo: string;
  organismo: string;
  nivel: Nivel;
  estado: Estado;
  plazo: string;
  // Último día seguro del plazo, AAAA-MM-DD.
  fin_plazo: string | null;
  finalidad: string | null;
  // Temas pedidos que aparecen en el título o la finalidad.
  encaja_con: Tema[];
  // Palabras pedidas que aparecen en el título.
  palabras_en_titulo: string[];
  para_quien: string[];
  ambito: string[];
  aviso: string | null;
  // Ficha oficial (BDNS o página del catálogo).
  enlace: string;
  enlaces: Enlaces;
  fuente: "catalogo" | "bdns" | "pack";
};

export type ResultadoBuscar = {
  ubicacion: {
    municipio: string | null;
    provincia: string;
    comunidad: string;
    isla: string | null;
    organismos_locales_consultados: string[];
  };
  fecha_consulta: string;
  ayudas: AyudaEncontrada[];
  resumen: {
    pagina: number;
    convocatorias_revisadas: number;
    descartadas: { motivo: string; cuantas: number }[];
    cerradas_ocultas: number;
    quedan_por_revisar: number;
  };
  // Anuales que el año pasado abrieron por estas fechas y este año aún no han salido.
  recurrentes: Recurrente[];
  no_consultado: string[];
  respaldo: string | null;
  origen_datos: string;
};

// Unas 10 fichas por consulta, como pide la organización (SETUP.md).
const FICHAS_POR_PAGINA = 10;
const LIMITE_MS = 18_000;
const MS_RECURRENTES = 8_000;

// Títulos de subvenciones nominativas, convenios o directas a una entidad:
// nadie puede solicitarlas, así que no se gasta una ficha en ellas.
export const NO_SOLICITABLE_TITULO =
  /nominativ|nommina|subvenci[oó] directa|subv\.? directa|subvenci[oó]n directa|convenio|conveni |regula y conced|regula i conced|adenda|addenda|concesi[oó]n directa/i;

export const PERSONA_FISICA = "PERSONAS FÍSICAS QUE NO DESARROLLAN ACTIVIDAD ECONÓMICA";
export const AUTONOMO = "PYME Y PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA";

const ORDEN_ESTADO: Record<Estado, number> = {
  abierta: 0,
  sin_plazo_fijo: 1,
  proximamente: 2,
  por_confirmar: 3,
  cerrada: 4,
  no_solicitable: 5,
};

export type Busqueda = {
  nivel: Nivel;
  nombre: string;
  filtros: FiltrosBusqueda;
  // Grupo de la copia del pack que la sustituye si la API falla.
  respaldo: string | null;
};

type Candidata = ResultadoBusqueda & { nivel: Nivel; puntos: number };

export function busquedas(u: Ubicacion, args: ArgsBuscar, hoy: string): Busqueda[] {
  const d = sumarDias(hoy, -365);
  const fechaDesde = `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  const tiposBeneficiario = args.autonomo ? [1, 3] : [1];
  const esCV = ["03", "12", "46"].includes(u.ineProvincia);
  const lista: Busqueda[] = [
    {
      nivel: "Estado",
      nombre: "Administración General del Estado",
      filtros: { tipoAdministracion: "C", regiones: u.regionesEstado, tiposBeneficiario, fechaDesde },
      respaldo: "estatal",
    },
    {
      nivel: "Comunidad autónoma",
      nombre: u.comunidad,
      filtros: { tipoAdministracion: "A", regiones: u.regionesComunidad, tiposBeneficiario, fechaDesde },
      respaldo: esCV ? "autonomica_cv" : null,
    },
  ];
  if (u.organosLocales.length)
    lista.push({
      nivel: "Local",
      nombre: u.nombresLocales.join(", ") || "entidades locales",
      filtros: { organos: u.organosLocales, tiposBeneficiario, fechaDesde },
      respaldo: u.organosLocales.includes(2903) ? "local_ayuntamiento_valencia" : null,
    });
  return lista;
}

function aAyuda(
  c: Convocatoria,
  nivel: Nivel,
  hoy: string,
  u: Ubicacion,
  temas: Tema[],
  palabras: string[],
): AyudaEncontrada {
  const e = calcularEstado(c.plazo, hoy);
  const soloEntidades = c.beneficiarios.some((b) => /JURÍDICAS|GRAN EMPRESA/.test(b));
  const ambito = c.regiones.filter((r) => !/^ES - /.test(r));
  return {
    id: `bdns:${c.numero}`,
    titulo: c.titulo,
    organismo: c.organo.nivel3,
    nivel,
    estado: e.estado,
    plazo: e.motivo,
    fin_plazo: e.fin,
    finalidad: c.finalidad,
    encaja_con: temasQueEncajan(c.titulo, c.finalidad, temas),
    palabras_en_titulo: palabrasEnTitulo(c.titulo, palabras),
    para_quien: c.beneficiarios,
    ambito,
    aviso: soloEntidades
      ? "Admite también entidades o empresas: comprueba en los requisitos que una persona puede pedirla."
      : ambito.length && !ambito.some((r) => regionCubre(r, u.nuts))
        ? "Su ámbito no coincide exactamente con tu zona: compruébalo."
        : null,
    enlace: c.enlace,
    enlaces: enlacesDe(c),
    fuente: c.fuente,
  };
}

export async function buscarAyudas(
  args: ArgsBuscar,
  hoy = hoyEnMadrid(),
): Promise<ResultadoBuscar | ErrorUbicacion> {
  const u = resolverUbicacion(args);
  if ("error" in u) return u;
  const empezado = Date.now();
  const temas = args.temas ?? [];
  const palabras = args.palabras ?? [];
  const pagina = Math.max(1, args.pagina ?? 1);
  const noConsultado: string[] = [];
  const respaldos: string[] = [];
  const descartes = new Map<string, number>();
  const descartar = (motivo: string) => descartes.set(motivo, (descartes.get(motivo) ?? 0) + 1);

  // 1. Búsquedas en paralelo (baratas: una llamada cada una).
  const lista = busquedas(u, args, hoy);
  const desdePack: { c: Convocatoria; nivel: Nivel }[] = [];
  let publicadas: (r: ResultadoBusqueda[]) => void = () => {};
  // Las anuales van a la vez, con su propio límite: si tardan, no se enseñan.
  const recurrentes =
    pagina === 1
      ? Promise.race([
          buscarRecurrentes(u, args, hoy, new Promise((r) => (publicadas = r))),
          new Promise<Recurrente[]>((r) => setTimeout(() => r([]), MS_RECURRENTES)),
        ]).catch(() => [] as Recurrente[])
      : Promise.resolve([] as Recurrente[]);
  const resultados = await Promise.all(
    lista.map(async (b) => {
      try {
        return (await buscarConvocatorias(b.filtros)).map((r) => ({ ...r, nivel: b.nivel }));
      } catch {
        if (b.respaldo) {
          respaldos.push(b.nombre);
          for (const c of grupoDelPack(b.respaldo)) desdePack.push({ c, nivel: b.nivel });
        } else noConsultado.push(`${b.nombre}: la BDNS no respondió y no hay copia de respaldo.`);
        return [];
      }
    }),
  );

  publicadas(resultados.flat());

  // 2. Candidatas sin repetir, sin las que no se pueden solicitar por título y ordenadas.
  const vistas = new Set<string>();
  const candidatas: Candidata[] = [];
  for (const r of resultados.flat()) {
    if (vistas.has(r.numeroConvocatoria)) continue;
    vistas.add(r.numeroConvocatoria);
    // Llegan de la más reciente a la más antigua: del mismo organismo y con el
    // mismo título, solo la primera («AYUDAS PARA INSERCIÓN LABORAL» ×13).
    const mismoTitulo = `${r.nivel3}|${normalizar(r.descripcion)}`;
    if (vistas.has(mismoTitulo)) {
      descartar("Mismo título que otra convocatoria más reciente del mismo organismo");
      continue;
    }
    vistas.add(mismoTitulo);
    if (NO_SOLICITABLE_TITULO.test(r.descripcion)) {
      descartar("Subvención nominativa, directa o convenio: no admite solicitudes");
      continue;
    }
    candidatas.push({ ...r, puntos: relevancia(r.descripcion, null, temas, palabras) });
  }
  candidatas.sort((a, b) => b.puntos - a.puntos || b.fechaRecepcion.localeCompare(a.fechaRecepcion));

  // 3. Fichas de la página pedida (caras: una llamada por convocatoria).
  const tanda = candidatas.slice((pagina - 1) * FICHAS_POR_PAGINA, pagina * FICHAS_POR_PAGINA);
  let sinFicha = 0;
  const leidas = await Promise.all(
    tanda.map(async (cand) => {
      if (Date.now() - empezado > LIMITE_MS) return null;
      try {
        return { c: desdeApi(await leerFicha(cand.numeroConvocatoria)), nivel: cand.nivel };
      } catch {
        const p = delPack(cand.numeroConvocatoria);
        if (p) return { c: p, nivel: cand.nivel };
        sinFicha++;
        return null;
      }
    }),
  );
  const convocatorias = [...leidas.filter((x) => x !== null), ...(pagina === 1 ? desdePack : [])];

  // 4. Filtros con la ficha completa y estado por fechas.
  let cerradas = 0;
  const ayudas: (AyudaEncontrada & { puntos: number })[] = [];
  for (const { c, nivel } of convocatorias) {
    if (c.tipoConvocatoria && /instrumental/i.test(c.tipoConvocatoria)) {
      descartar("Convocatoria instrumental: no admite solicitudes");
      continue;
    }
    const paraPersonas =
      c.beneficiarios.includes(PERSONA_FISICA) || (args.autonomo && c.beneficiarios.includes(AUTONOMO));
    if (c.beneficiarios.length && !paraPersonas) {
      descartar("No está dirigida a personas físicas");
      continue;
    }
    if (nivel !== "Local" && c.regiones.length && !c.regiones.some((r) => regionCubre(r, u.nuts))) {
      descartar("Limitada a otro territorio");
      continue;
    }
    const a = aAyuda(c, nivel, hoy, u, temas, palabras);
    if (a.estado === "no_solicitable") {
      descartar("Sin plazo de solicitud");
      continue;
    }
    if (a.estado === "cerrada" && !args.incluir_cerradas) {
      cerradas++;
      continue;
    }
    ayudas.push({ ...a, puntos: relevancia(c.titulo, c.finalidad, temas, palabras) });
  }

  // 5. Catálogo curado (prestaciones que no están en la BDNS), solo en la primera página.
  if (pagina === 1 && args.catalogo !== false)
    for (const e of ayudasCatalogo) {
      if (!aplicaEn(e, u)) continue;
      const est = estadoCatalogo(e, hoy);
      if (est.estado === "cerrada" && !args.incluir_cerradas) {
        cerradas++;
        continue;
      }
      const puntosTema = temasCatalogo(e.id).filter((t) => temas.includes(t)).length * 2;
      ayudas.push({
        id: `catalogo:${e.id}`,
        titulo: e.titulo,
        organismo: e.organismo,
        nivel: e.administracion === "Estado" ? "Estado" : "Comunidad autónoma",
        estado: est.estado,
        plazo: est.motivo,
        fin_plazo: est.fin,
        finalidad: null,
        encaja_con: temasCatalogo(e.id).filter((t) => temas.includes(t)),
        palabras_en_titulo: palabrasEnTitulo(e.titulo, palabras),
        para_quien: [],
        ambito: e.administracion === "Estado" ? [] : ["Comunitat Valenciana"],
        aviso: e.verificado ? null : `No verificado en fuente oficial: ${e.nota ?? "revísalo en la sede"}`,
        enlace: e.enlace_info,
        enlaces: enlacesCatalogo(e),
        fuente: "catalogo",
        puntos: puntosTema + (temas.length ? 0 : 1),
      });
    }

  // 6. Renta mínima de la comunidad (fuera de la CV, que está en el catálogo).
  const renta = pagina === 1 ? rentaDe(u.ineProvincia) : null;
  if (renta) {
    const est = estadoRenta(renta);
    const encaja = temas.filter((t) => t === "servicios_sociales");
    ayudas.push({
      id: `renta:${renta.id}`,
      titulo: renta.titulo,
      organismo: renta.organismo,
      nivel: "Comunidad autónoma",
      estado: est.estado,
      plazo: est.motivo,
      fin_plazo: null,
      finalidad: "Renta mínima para cubrir las necesidades básicas",
      encaja_con: encaja,
      palabras_en_titulo: palabrasEnTitulo(renta.titulo, palabras),
      para_quien: [],
      ambito: [renta.ccaa],
      aviso: renta.nota,
      enlace: renta.enlace_info,
      enlaces: enlacesRenta(renta),
      fuente: "catalogo",
      puntos: encaja.length * 2,
    });
  }

  ayudas.sort(
    (a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || b.puntos - a.puntos,
  );

  // 7. Lo que no se ha podido mirar, dicho claro.
  if (!u.municipio)
    noConsultado.push("Ayudas de tu ayuntamiento: no sé el municipio o no tiene convocatorias en la BDNS.");
  if (["07", "35", "38"].includes(u.ineProvincia) && !u.isla)
    noConsultado.push("Ayudas del cabildo o consell insular: falta saber el municipio para conocer la isla.");
  if (!["03", "12", "46"].includes(u.ineProvincia))
    noConsultado.push(
      renta
        ? `Otras prestaciones de ${u.comunidad} que no se publican como convocatoria: consulta la sede de la comunidad.`
        : `Renta mínima y otras prestaciones de ${u.comunidad} que no se publican como convocatoria: consulta la sede de la comunidad.`,
    );
  noConsultado.push(
    "Mancomunidades, consorcios, universidades y otros organismos.",
    "Deducciones fiscales y prestaciones de la Seguridad Social que no están en el catálogo.",
  );
  if (!args.autonomo) noConsultado.push("Ayudas para autónomos y empresas (indica autonomo: true si aplica).");
  if (sinFicha) noConsultado.push(`${sinFicha} convocatorias cuya ficha no respondió a tiempo.`);

  const restantes = Math.max(0, candidatas.length - pagina * FICHAS_POR_PAGINA);
  return {
    ubicacion: {
      municipio: u.municipio,
      provincia: u.provincia,
      comunidad: u.comunidad,
      isla: u.isla,
      organismos_locales_consultados: u.nombresLocales,
    },
    fecha_consulta: fechaLegible(hoy),
    ayudas: ayudas.map(({ puntos: _puntos, ...a }) => a),
    recurrentes: await recurrentes,
    resumen: {
      pagina,
      convocatorias_revisadas: convocatorias.length,
      descartadas: [...descartes].map(([motivo, cuantas]) => ({ motivo, cuantas })),
      cerradas_ocultas: cerradas,
      quedan_por_revisar: restantes,
    },
    no_consultado: noConsultado,
    respaldo: respaldos.length
      ? `La BDNS no respondió para: ${respaldos.join(", ")}. Se usó la copia del ${fechaLegible(PACK_CONSULTADO)}; dilo al ciudadano.`
      : null,
    origen_datos: `Origen de los datos: Intervención General de la Administración del Estado (BDNS), consultado el ${fechaLegible(hoy)}. Catálogo curado verificado a ${fechaLegible(CATALOGO_VERSION)}.`,
  };
}
