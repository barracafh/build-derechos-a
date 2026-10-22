import central from "@/datos/central.json";
import { normalizar, zonaDe } from "@/lib/lugares";
import type { Ficha, Perfil } from "@/lib/tipos";

// Ayudas centralizadas (spec 004, FR-014): las que el job nocturno extrae de
// páginas oficiales a src/datos/central.json. Entran como `Ficha` con
// `fuente: "central"`, después de las del catálogo. Todo lo que se muestra
// sale del JSON (citas literales de la página oficial). El estado sale solo de
// fechas que el job sacó por código (`plazoListado` de la sede o `fechaFin` de
// la cita de plazo); sin ellas es «desconocido». `verificado` es false: la
// interfaz muestra «Sin confirmar» y remite al enlace oficial.
// La app no lee src/datos/textos/: solo este JSON.

export type AyudaCentral = {
  id: string;
  tipo: string;
  titulo: string;
  administracion: string;
  organismo: string;
  frases_usuario: string[];
  requisitos_clave: string[];
  pasos: string[];
  documentacion: string[];
  plazo: string | null;
  enlace_info: string;
  enlace_tramite: string | null;
  fuente: string;
  verificado: boolean;
  nota?: string | null;
  cuantia?: string | null;
  ambito?: string | null;
  exclusiones?: string[];
  incompleta?: boolean;
  posibleDuplicado?: string;
  /** Cómo es el plazo, decidido por el job; nunca null en los items nuevos. */
  tipoPlazo?: "fechas" | "permanente" | "relativo" | "de_oficio" | "sin_plazo";
  /** AAAA-MM-DD sacadas por código (listado de la sede o cita de `plazo`), o null. */
  fechaInicio?: string | null;
  fechaFin?: string | null;
  /** Plazo que el listado de la sede (GVA) muestra junto al enlace, sin LLM. */
  plazoListado?: { texto: string; inicio: string | null; fin: string | null; estado: string | null } | null;
};

type Almacen = { version: string; items: AyudaCentral[] };

const ALMACEN = central as unknown as Almacen;

/** Fecha de la última ejecución del job, para la cobertura. */
export const VERSION_CENTRAL = ALMACEN.version;

// Una ayuda `incompleta` (sin requisitos, sin tipo de plazo y sin plazo en el
// listado) solo se propone si al menos lleva el enlace del trámite: sin él no
// habría nada que hacer con ella.
export const AYUDAS_CENTRALES: AyudaCentral[] = (ALMACEN.items ?? []).filter(
  (a) => a.tipo === "ayuda" && a.titulo && a.enlace_info && (!a.incompleta || a.enlace_tramite),
);

const fecha = (d: Date) => d.toISOString().slice(0, 10);

/** Texto del plazo cuando la página oficial no da ninguno. */
export const SIN_PLAZO = "La página oficial no indica plazo.";

// Estado calculado el día de la consulta, nunca guardado: así no caduca. Sale
// solo de lo que el job sacó por código (`tipoPlazo`, `fechaInicio`, `fechaFin`,
// `plazoListado`), nunca del texto libre del LLM.
export function estadoCentral(a: AyudaCentral, hoy: Date): { estado: Ficha["estado"]; fechaFin: string | null } {
  const h = fecha(hoy);
  const fin = a.fechaFin ?? a.plazoListado?.fin ?? null;
  const inicio = a.fechaInicio ?? a.plazoListado?.inicio ?? null;
  const tipo = a.tipoPlazo ?? (fin || inicio ? "fechas" : "sin_plazo");
  if (tipo === "permanente" || tipo === "relativo" || tipo === "de_oficio")
    return { estado: "permanente", fechaFin: null };
  if (tipo === "sin_plazo") return { estado: "desconocido", fechaFin: null };
  // tipo === "fechas"
  if (inicio && h < inicio) return { estado: "cerrada", fechaFin: fin };
  if (fin) return { estado: h > fin ? "cerrada" : "abierta", fechaFin: fin };
  const texto = a.plazoListado?.estado ?? "";
  if (/cerrad|tancat/i.test(texto)) return { estado: "cerrada", fechaFin: null };
  if (/abiert|obert/i.test(texto)) return { estado: "abierta", fechaFin: null };
  return { estado: "desconocido", fechaFin: null };
}

// Palabras con contenido: sin signos ni acentos, de 4 letras o más, y sin las
// que aparecen en casi cualquier petición de ayuda.
const VACIAS = new Set([
  "para", "como", "cómo", "donde", "dónde", "tengo", "puedo", "pedir", "pido",
  "ayuda", "ayudas", "necesito", "quiero", "saber", "cual", "cuál", "cuales",
  "este", "esta", "estoy", "esto", "años", "vivo", "soy", "hay", "que", "qué",
  "solicito", "solicitar", "existe", "existen", "derecho", "toca", "alguna",
  "algun", "algún", "mucho", "poco", "pero", "porque", "desde", "hasta", "sobre",
  "ser", "estar", "hacer", "tener", "conseguir", "cobro", "cobrar", "euros",
]);

export function palabras(texto: string): Set<string> {
  return new Set(
    normalizar(texto)
      .split(/[^a-z0-9ñ]+/)
      .filter((p) => p.length >= 4 && !VACIAS.has(p)),
  );
}

type Coincidencia = { ayuda: AyudaCentral; frase: string | null; puntos: number };

// Encaje de la necesidad con las frases de ciudadano y el título. Una ayuda
// pasa con 2 palabras en común, o con 1 si está en el título: así «dependencia»
// basta para la ayuda por dependencia y «ayuda para mi madre» no propone nada.
export function coincidencias(necesidad: string | null): Coincidencia[] {
  const nec = palabras(necesidad ?? "");
  if (nec.size === 0) return [];
  const r: Coincidencia[] = [];
  for (const ayuda of AYUDAS_CENTRALES) {
    const titulo = palabras(ayuda.titulo);
    let mejor: Coincidencia = { ayuda, frase: null, puntos: 0 };
    for (const frase of [ayuda.titulo, ...(ayuda.frases_usuario ?? [])]) {
      const comunes = [...palabras(frase)].filter((p) => nec.has(p));
      const enTitulo = comunes.some((p) => titulo.has(p));
      const puntos = comunes.length + (enTitulo ? 1 : 0);
      if (puntos > mejor.puntos) mejor = { ayuda, frase: frase === ayuda.titulo ? null : frase, puntos };
    }
    if (mejor.puntos >= 2) r.push(mejor);
  }
  return r.sort((a, b) => b.puntos - a.puntos);
}

function administracionDe(a: string): Ficha["administracion"] {
  if (a === "Estado") return "Estado";
  if (a === "Comunitat Valenciana" || a.startsWith("Generalitat")) return "Comunitat Valenciana";
  return "Local";
}

const limpio = (s: string | null | undefined) => (s ?? "").trim();
const lista = (l: string[] | undefined) => (l ?? []).map(limpio).filter(Boolean);

/** Una ayuda centralizada como `Ficha`. `porQue` lleva las palabras de la persona. */
export function fichaCentral(a: AyudaCentral, perfil: Perfil, frase: string | null, hoy = new Date()): Ficha {
  const necesidad = perfil.necesidad ? `Dices: «${perfil.necesidad}».` : null;
  const porQue = [necesidad, frase ? `Suele pedirse así: «${frase}».` : null].filter(
    (x): x is string => x !== null,
  );
  const requisitos = lista(a.requisitos_clave);
  const avisos = [
    "Esta ficha la ha sacado un programa de la página oficial.",
    "Nadie la ha revisado todavía.",
    "Comprueba los datos en el enlace oficial.",
  ];
  if (a.incompleta || requisitos.length === 0)
    avisos.push("No hemos podido leer los requisitos. Están en la página oficial.");
  const { estado, fechaFin } = estadoCentral(a, hoy);
  const plazo = [a.plazoListado?.texto, a.plazo].map(limpio).filter(Boolean);
  if (plazo.length === 0 && (a.tipoPlazo ?? "sin_plazo") === "sin_plazo") plazo.push(SIN_PLAZO);
  const fuentes = [a.enlace_info, ...limpio(a.fuente).split(";").map((u) => u.trim())]
    .filter((u, i, all) => /^https?:\/\//.test(u) && all.indexOf(u) === i)
    .map((url) => ({ nombre: new URL(url).hostname, url }));

  return {
    id: a.id,
    titulo: a.titulo,
    finalidad: limpio(a.nota),
    fuente: "central",
    administracion: administracionDe(a.administracion),
    estado,
    fechaFin,
    enlace: a.enlace_info,
    porQue,
    requisitos,
    pendiente: [],
    verificado: false,
    detalle: {
      ambito: limpio(a.ambito) || null,
      resumen: limpio(a.nota) ? [limpio(a.nota)] : [],
      porQueDetalle: [],
      avisos,
      dinero: limpio(a.cuantia) ? { intro: [limpio(a.cuantia)] } : null,
      plazo,
      pasos: lista(a.pasos),
      documentos: lista(a.documentacion),
      enlaceTramite: a.enlace_tramite,
      fuentes,
      oficial: {
        titulo: a.titulo,
        organismo: limpio(a.organismo),
        requisitos,
        plazo: a.plazo,
      },
    },
  };
}

/** Ayudas centralizadas que encajan con la necesidad del perfil (FR-014). */
export function fichasCentrales(perfil: Perfil, ids = new Set<string>(), hoy = new Date()): Ficha[] {
  const municipio = perfil.hechos.find((h) => h.campo === "municipio")?.valor ?? null;
  const fuera = municipio ? zonaDe(municipio) === "fuera" : false;
  return coincidencias(perfil.necesidad)
    .filter(({ ayuda }) => !ids.has(ayuda.id))
    // Fuera de la Comunitat Valenciana solo se proponen ayudas del Estado.
    .filter(({ ayuda }) => !fuera || administracionDe(ayuda.administracion) === "Estado")
    .map(({ ayuda, frase }) => fichaCentral(ayuda, perfil, frase, hoy));
}
