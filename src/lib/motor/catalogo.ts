import catalogo from "../../../datos/catalogo-tramites-ayudas.json";
import { estadoDe, type Estado } from "@/datos/estados";
import { ADAPTADAS } from "@/datos/lectura-facil";
import { normalizar, zonaDe, type Zona } from "@/lib/lugares";
import { INGRESOS_BAJOS } from "@/lib/llm/pregunta";
import type { CampoPerfil, Ficha, Perfil } from "@/lib/tipos";

// Motor sobre el catálogo local: del `Perfil` de la persona a las ayudas del
// catálogo que podrían encajar. Es determinista y se ejecuta en el servidor:
// no llama a ningún servicio externo, no guarda el texto y cada motivo sale de
// algo que la persona ha dicho y de un requisito del catálogo.

type Entrada = {
  id: string;
  tipo: string;
  titulo: string;
  administracion: string;
  organismo: string;
  requisitos_clave: string[];
  pasos: string[];
  documentacion: string[];
  plazo: string | null;
  enlace_info: string;
  enlace_tramite: string | null;
  fuente: string;
  verificado: boolean;
  nota?: string;
};

const ayudas = (catalogo.items as unknown as Entrada[]).filter(
  (e) => e.tipo === "ayuda",
);

// ───────────────────────── Señales del perfil ─────────────────────────

// Lo que las reglas necesitan saber, sacado de los hechos del `Perfil`.
type Senales = {
  edad: number | null;
  paro: boolean;
  paroAgotado: boolean;
  sinIngresos: boolean;
  pocosIngresos: boolean;
  // Lo que dijo de sus ingresos, para el motivo.
  dichoIngresos: string;
  alquiler: boolean;
  hijos: boolean;
  escolar: boolean;
  comedor: boolean;
  libros: boolean;
  luz: boolean;
  pensionista: boolean;
  familiaNumerosa: boolean;
  autonomo: boolean;
  lugar: Zona;
  lugarNombre: string | null;
};

function senalesDe(perfil: Perfil): Senales {
  const valor = (c: CampoPerfil) =>
    perfil.hechos.filter((h) => h.campo === c).map((h) => normalizar(h.valor));
  const tiene = (c: CampoPerfil, v?: string) =>
    v ? valor(c).includes(normalizar(v)) : valor(c).length > 0;
  const nec = normalizar(perfil.necesidad ?? "");
  const edadN = Number(valor("edad")[0]);
  const hijos = tiene("hijos");
  const comedor = /\b(comedor|menjador)\b/.test(nec);
  const libros = /\b(libros|llibres)\b/.test(nec);
  const municipio = valor("municipio")[0] ?? null;
  const zona = municipio ? zonaDe(municipio) : null;
  const ingresos = perfil.hechos.find((h) => h.campo === "ingresos")?.valor;
  return {
    edad: Number.isFinite(edadN) && edadN > 0 ? edadN : null,
    paro: tiene("situacionLaboral", "en paro") || tiene("situacionLaboral", "paro agotado"),
    paroAgotado: tiene("situacionLaboral", "paro agotado"),
    sinIngresos: tiene("ingresos", "sin ingresos"),
    pocosIngresos: INGRESOS_BAJOS.some((v) => tiene("ingresos", v)),
    dichoIngresos:
      ingresos === "sin ingresos"
        ? "Dices que no tienes ingresos."
        : ingresos === "bajos"
          ? "Dices que tus ingresos son bajos."
          : `Dices que en tu casa entran ${ingresos} al mes.`,
    alquiler: tiene("vivienda", "alquiler"),
    hijos,
    escolar:
      comedor ||
      libros ||
      /\b(cole|colegio|escuela|escolar|instituto|primaria|eso|bachillerato)\b/.test(nec),
    comedor,
    libros,
    luz: /\b(luz|electricidad|electrica|llum)\b/.test(nec),
    pensionista: tiene("pension"),
    familiaNumerosa:
      tiene("hijos", "tres o más") || tiene("hijos", "familia numerosa"),
    autonomo: tiene("situacionLaboral", "autónomo"),
    lugar: zona,
    lugarNombre: municipio,
  };
}

// ───────────────────────── Reglas ─────────────────────────

// `motivo` son frases cortas; cada una se muestra en su línea.
type Senal = { peso: number; motivo: string[]; aviso?: string[] };
type Regla = {
  id: string;
  umbral: number;
  senales: (p: Senales) => Senal[];
};

const sinNulos = (s: (Senal | false)[]): Senal[] =>
  s.filter((x): x is Senal => x !== false);

const REGLAS: Regla[] = [
  {
    id: "subsidio-desempleo",
    umbral: 2,
    senales: (p) =>
      sinNulos([
        p.paroAgotado && {
          peso: 3,
          motivo: [
            "Dices que se te ha acabado el paro.",
            "El **subsidio** es para personas que han agotado el paro y no tienen ingresos suficientes.",
          ],
        },
        !p.paroAgotado &&
          p.paro && {
            peso: 2,
            motivo: [
              "Dices que estás en paro.",
              "El **subsidio** es para personas en paro sin ingresos suficientes.",
            ],
          },
      ]),
  },
  {
    id: "ingreso-minimo-vital",
    umbral: 2,
    senales: (p) =>
      sinNulos([
        p.sinIngresos && {
          peso: 3,
          motivo: [
            "Dices que no tienes ingresos.",
            "El **IMV** es para hogares con pocos recursos.",
          ],
        },
        p.pocosIngresos && {
          peso: 2,
          motivo: [
            p.dichoIngresos,
            "El **IMV** mira los ingresos y el **patrimonio** de tu hogar.",
          ],
        },
        p.paro && {
          peso: 1,
          motivo: [
            "Estás en paro.",
            "El **IMV** mira la situación económica de todo tu hogar.",
          ],
        },
        p.alquiler && {
          peso: 1,
          motivo: [
            "Pagas alquiler.",
            "El alquiler pesa en la situación económica de tu hogar.",
          ],
        },
        p.edad !== null &&
          p.edad < 23 && {
            peso: 0,
            motivo: [],
            aviso: [
              "La edad mínima del **IMV** es 23 años.",
              "Hay excepciones.",
              "Comprueba si es tu caso.",
            ],
          },
      ]).filter((s) => s.motivo.length > 0 || s.aviso),
  },
  {
    id: "complemento-ayuda-infancia",
    umbral: 4,
    senales: (p) =>
      sinNulos([
        p.hijos && {
          peso: 2,
          motivo: [
            "Dices que tienes hijos.",
            "El **CAPI** es para hogares con menores.",
          ],
        },
        (p.sinIngresos || p.pocosIngresos) && {
          peso: 2,
          motivo: [
            p.dichoIngresos,
            "El límite de ingresos del **CAPI** es más alto que el del **IMV**.",
            "Puedes recibirlo aunque no tengas derecho al **IMV**.",
          ],
        },
      ]),
  },
  {
    id: "renta-valenciana-inclusion",
    umbral: 3,
    senales: (p) =>
      sinNulos([
        p.sinIngresos && {
          peso: 3,
          motivo: [
            "Dices que no tienes ingresos.",
            "La **RVI** es una ayuda de la **Generalitat** para personas con muchas dificultades.",
          ],
        },
        p.pocosIngresos && {
          peso: 2,
          motivo: [
            p.dichoIngresos,
            "La **RVI** mira los recursos de tu hogar.",
          ],
        },
        p.hijos && {
          peso: 1,
          motivo: ["Tienes hijos a cargo.", "Los hijos cuentan al valorar tu hogar."],
        },
        p.edad !== null &&
          p.edad < 23 && {
            peso: 0,
            motivo: [],
            aviso: [
              "La edad mínima es 23 años.",
              "De 18 a 22 años, solo en casos concretos.",
            ],
          },
      ]).filter((s) => s.motivo.length > 0 || s.aviso),
  },
  {
    id: "bono-social-electrico",
    umbral: 2,
    senales: (p) =>
      sinNulos([
        p.luz && {
          peso: 2,
          motivo: [
            "Hablas de la factura de la luz.",
            "El **bono social** es un descuento para **consumidores vulnerables**.",
          ],
        },
        p.pensionista && {
          peso: 2,
          motivo: [
            "Cobras una pensión o estás jubilado.",
            "Si cobras la pensión mínima, puedes ser **consumidor vulnerable**.",
          ],
        },
        p.familiaNumerosa && {
          peso: 2,
          motivo: [
            "Dices que tienes familia numerosa o 3 hijos o más.",
            "Si tienes el título de familia numerosa, puedes ser **consumidor vulnerable**.",
          ],
        },
        (p.sinIngresos || p.pocosIngresos) && {
          peso: 1,
          motivo: [
            p.dichoIngresos,
            "Con esos ingresos, puedes estar por debajo del límite.",
          ],
        },
      ]),
  },
  {
    id: "bono-alquiler-joven",
    umbral: 2,
    senales: (p) => {
      // Más de 35 años queda fuera de la convocatoria: no se propone.
      if (p.edad !== null && p.edad > 35) return [];
      return sinNulos([
        p.alquiler && {
          peso: 2,
          motivo: [
            "Dices que vives de alquiler.",
            "El bono ayuda a pagar el alquiler de una casa o una habitación.",
          ],
          aviso:
            p.edad === null
              ? ["Comprueba que todas las personas del contrato tienen 35 años o menos."]
              : undefined,
        },
        p.alquiler &&
          p.edad !== null && {
            peso: 2,
            motivo: [
              `Tienes ${p.edad} años.`,
              "La convocatoria es para personas de 35 años o menos.",
            ],
          },
      ]);
    },
  },
  {
    id: "ayudas-comedor-escolar",
    umbral: 2,
    senales: (p) =>
      sinNulos([
        p.comedor && {
          peso: 3,
          motivo: ["Preguntas por el comedor escolar."],
        },
        p.hijos &&
          p.escolar && {
            peso: 2,
            motivo: [
              "Dices que tienes hijos en edad escolar.",
              "La ayuda es para alumnos de colegios públicos y concertados.",
            ],
          },
      ]),
  },
  {
    id: "xarxa-llibres",
    umbral: 2,
    senales: (p) =>
      sinNulos([
        p.libros && {
          peso: 3,
          motivo: ["Preguntas por los libros de texto."],
        },
        p.hijos &&
          p.escolar && {
            peso: 2,
            motivo: [
              "Dices que tienes hijos en edad escolar.",
              "El **Banco de Libros** es para alumnos matriculados en el curso 2026-2027.",
            ],
          },
      ]),
  },
];

// ───────────────────────── Fichas ─────────────────────────

// Datos que confirmarían o descartarían cada ayuda (spec 000, `pendiente`).
const PENDIENTE: Record<string, CampoPerfil[]> = {
  "subsidio-desempleo": ["situacionLaboral", "ingresos", "edad"],
  "ingreso-minimo-vital": ["ingresos", "edad", "hijos"],
  "complemento-ayuda-infancia": ["ingresos", "hijos"],
  "renta-valenciana-inclusion": ["ingresos", "edad", "municipio"],
  "bono-social-electrico": ["ingresos", "hijos", "pension"],
  "bono-alquiler-joven": ["edad", "ingresos", "vivienda"],
  "ayudas-comedor-escolar": ["ingresos", "hijos"],
  "xarxa-llibres": ["hijos", "municipio"],
};

const ESTADO_FICHA = {
  abierta: "abierta",
  cerrada: "cerrada",
  permanente: "permanente",
  "sin-confirmar": "desconocido",
} as const;

function administracionDe(a: string): Ficha["administracion"] {
  if (a === "Estado") return "Estado";
  if (a.startsWith("Generalitat")) return "Comunitat Valenciana";
  return "Local";
}

function ambitoDe(a: string): string | null {
  if (a === "Estado") return null;
  if (a.startsWith("Generalitat")) return "Comunitat Valenciana";
  return a.replace(/^Ajuntament de /, "");
}

// La entrada trae las fuentes en un solo texto separado por « ; »; se enlazan
// tal cual, cada una a la página concreta que sostiene la respuesta.
function fuentesDe(e: Entrada) {
  return e.fuente
    .split(";")
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u))
    .map((url) => ({ nombre: new URL(url).hostname, url }));
}

const ORDEN: Record<Ficha["estado"], number> = {
  abierta: 0,
  permanente: 1,
  desconocido: 2,
  cerrada: 3,
};

/** Ids de las ayudas del catálogo que el motor sabe presentar. */
export const IDS_AYUDAS = ayudas.map((e) => e.id).filter((id) => ADAPTADAS[id]);

// Una ayuda del catálogo como `Ficha`, con sus textos en lectura fácil. La usan
// las reglas de aquí y la lectura con IA (src/lib/llm): todo sale del catálogo y
// de src/datos/, salvo `porQue`, que trae las palabras de la persona.
export function crearFicha(
  id: string,
  perfil: Perfil,
  porQue: string[],
  avisosExtra: string[],
  hoy: Date,
  explicacion: string[] = [],
): Ficha {
  const e = ayudas.find((x) => x.id === id)!;
  const a = ADAPTADAS[id];
  const avisos = [...avisosExtra];
  if (!e.verificado)
    avisos.push(
      "La ley cambió el 20 de octubre de 2026.",
      "No hemos encontrado el procedimiento nuevo.",
      "Pregunta en los **servicios sociales** de tu ayuntamiento.",
      "O llama al 012.",
    );

  const estado = estadoDe(e.id, hoy);
  const conocidos = new Set(perfil.hechos.map((h) => h.campo));
  return {
    id: e.id,
    titulo: a.nombre,
    finalidad: a.resumen.join(" "),
    fuente: "catalogo",
    administracion: administracionDe(e.administracion),
    estado: ESTADO_FICHA[estado.tipo],
    fechaFin: estado.fechaFin,
    enlace: e.enlace_info,
    porQue,
    requisitos: a.requisitos,
    pendiente: (PENDIENTE[e.id] ?? []).filter((c) => !conocidos.has(c)),
    verificado: e.verificado,
    detalle: {
      ambito: ambitoDe(e.administracion),
      resumen: a.resumen,
      porQueDetalle: explicacion,
      avisos,
      dinero: a.dinero ?? null,
      plazo: estado.lineas,
      pasos: a.pasos,
      documentos: a.documentos,
      enlaceTramite: e.enlace_tramite,
      fuentes: fuentesDe(e),
      oficial: {
        titulo: e.titulo,
        organismo: e.organismo,
        requisitos: e.requisitos_clave,
        plazo: e.plazo,
      },
    },
  };
}

// Una ayuda con el plazo ya vencido no se propone: no se puede pedir.
export const vigentesPorEstado = (fichas: Ficha[]) =>
  fichas.filter((f) => f.estado !== "cerrada").sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado]);

// Un dato dicho por la persona que el catálogo pone como límite descarta la ayuda.
const CON_HIJOS = ["complemento-ayuda-infancia", "ayudas-comedor-escolar", "xarxa-llibres"];

export function bloqueada(id: string, perfil: Perfil): boolean {
  const e = ayudas.find((x) => x.id === id)!;
  const p = senalesDe(perfil);
  const dato = (c: CampoPerfil) => perfil.hechos.find((h) => h.campo === c)?.valor;
  const fueraDeEdad =
    id === "bono-alquiler-joven" && p.edad !== null && (p.edad < 18 || p.edad > 35);
  const conPropiedad = id === "bono-alquiler-joven" && dato("vivienda") === "propiedad";
  const sinHijos = CON_HIJOS.includes(id) && dato("hijos") === "0";
  // Fuera de la Comunitat Valenciana no se proponen ayudas de la Generalitat.
  const fueraDeCV = p.lugar === "fuera" && e.administracion !== "Estado";
  return fueraDeEdad || conPropiedad || sinHijos || fueraDeCV;
}

export function fichasDelCatalogo(perfil: Perfil, hoy = new Date()): Ficha[] {
  const p = senalesDe(perfil);
  const fichas: Ficha[] = [];
  for (const regla of REGLAS) {
    const e = ayudas.find((a) => a.id === regla.id);
    const a = ADAPTADAS[regla.id];
    if (!e || !a) continue;
    // Fuera de la Comunitat Valenciana no se proponen ayudas de la Generalitat.
    if (p.lugar === "fuera" && e.administracion !== "Estado") continue;

    const senales = regla.senales(p);
    const puntos = senales.reduce((s, x) => s + x.peso, 0);
    if (puntos < regla.umbral) continue;

    fichas.push(
      crearFicha(
        e.id,
        perfil,
        senales.flatMap((s) => s.motivo.slice(0, 1)),
        senales.flatMap((s) => s.aviso ?? []),
        hoy,
        senales.flatMap((s) => s.motivo.slice(1)),
      ),
    );
  }
  return vigentesPorEstado(fichas);
}

/** Lo que este catálogo no cubre según lo que ha dicho la persona. */
export function noCubiertoPor(perfil: Perfil): string[] {
  const p = senalesDe(perfil);
  const r: string[] = [];
  if (p.lugar === "fuera")
    r.push("Ayudas de tu comunidad autónoma y de tu ayuntamiento");
  else if (p.lugar === "cv" && p.lugarNombre !== "valencia")
    r.push("Ayudas de tu ayuntamiento");
  if (p.autonomo) r.push("Ayudas para personas que trabajan por cuenta propia");
  r.push("Convocatorias publicadas en la BDNS");
  return r;
}
