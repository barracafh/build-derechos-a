import catalogo from "../../datos/catalogo-tramites-ayudas.json";
import { estadoDe, type Estado } from "@/datos/estados";
import {
  ADAPTADAS,
  GLOSARIO,
  terminosDe,
  type Dinero,
} from "@/datos/lectura-facil";

// Motor de «Ayudas para ti»: del texto libre de la persona a las ayudas del
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

// ───────────────────────── Perfil ─────────────────────────

export type Perfil = {
  edad: number | null;
  paro: boolean;
  paroAgotado: boolean;
  sinIngresos: boolean;
  pocosIngresos: boolean;
  alquiler: boolean;
  hijos: boolean;
  escolar: boolean;
  comedor: boolean;
  libros: boolean;
  luz: boolean;
  pensionista: boolean;
  familiaNumerosa: boolean;
  autonomo: boolean;
  dana: boolean;
  // Comunitat Valenciana, otro sitio de España que el catálogo no cubre, o no dicho.
  lugar: "cv" | "fuera" | null;
  lugarNombre: string | null;
};

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const LUGARES_CV = [
  "valencia",
  "castello",
  "castellon",
  "alicante",
  "alacant",
  "safor",
  "gandia",
  "torrent",
  "paterna",
  "sagunto",
  "elche",
  "elx",
  "benidorm",
  "alzira",
  "xativa",
  "orihuela",
];
const LUGARES_FUERA = [
  "madrid",
  "barcelona",
  "sevilla",
  "malaga",
  "bilbao",
  "zaragoza",
  "murcia",
  "galicia",
  "andalucia",
  "cataluna",
  "mallorca",
  "canarias",
];

const rx = (re: RegExp, t: string) => re.test(t);

export function extraerPerfil(texto: string): Perfil {
  const t = normalizar(texto);

  // «tengo 24 años» gana a un «12 años» suelto, que suele ser de un hijo.
  const edadMatch =
    t.match(/\btengo (\d{2})\b/) ?? t.match(/\b(\d{2}) (?:anos|años)\b/);
  const edadNum = edadMatch ? Number(edadMatch[1]) : null;
  const edad = edadNum !== null && edadNum >= 16 && edadNum <= 99 ? edadNum : null;

  const cv = LUGARES_CV.find((l) => new RegExp(`\\b${l}\\b`).test(t));
  const fuera = LUGARES_FUERA.find((l) => new RegExp(`\\b${l}\\b`).test(t));

  const hijos = rx(/\b(hij[oa]s?|nin[oa]s?|bebes?|fills?|crios?|menores a cargo)\b/, t);
  const tresOMasHijos = rx(
    /\b(3|tres|4|cuatro|5|cinco) (hij[oa]s|nin[oa]s|fills)\b/,
    t,
  );

  return {
    edad,
    paro: rx(
      /\b(en paro|paro|desempleo|desemplead[oa]|sin trabajo|sin empleo|atur|me han echado|despedid[oa])\b/,
      t,
    ),
    paroAgotado: rx(
      /(se (me )?(ha )?acab(ado|o) (el )?(paro|subsidio)|agot(e|ado) (el )?paro|sin paro|acabat l.atur)/,
      t,
    ),
    sinIngresos: rx(
      /(sin ingresos|no tengo ingresos|sin dinero|no tengo dinero|no tinc ingressos|cero ingresos|no cobro nada)/,
      t,
    ),
    pocosIngresos: rx(
      /(ingresos bajos|pocos ingresos|bajos ingresos|cobro poco|gano poco|no llego|fin de mes|pocs ingressos|sueldo bajo)/,
      t,
    ),
    alquiler: rx(/\b(alquiler|alquilo|alquilad[oa]|lloguer|llogue)\b/, t),
    hijos,
    escolar: rx(
      /\b(cole|colegio|escuela|escolar|instituto|primaria|eso|bachillerato|menjador|comedor|libros|llibres|edad escolar)\b/,
      t,
    ),
    comedor: rx(/\b(comedor|menjador)\b/, t),
    libros: rx(/\b(libros|llibres|banco de libros|xarxa llibres)\b/, t),
    luz: rx(/\b(luz|electricidad|electrica|llum|factura de la luz)\b/, t),
    pensionista: rx(/\b(jubilad[oa]|pensionista|jubilat|pension)\b/, t),
    familiaNumerosa: rx(/familia numerosa/, t) || tresOMasHijos,
    autonomo: rx(/\b(autonom[oa]|freelance|cuenta propia)\b/, t),
    dana: rx(/\b(dana|riada|inundacion(es)?)\b/, t),
    lugar: cv ? "cv" : fuera ? "fuera" : null,
    lugarNombre: cv ?? fuera ?? null,
  };
}

/** Frases cortas con lo que la herramienta ha entendido, para que la persona lo corrija. */
export function resumenPerfil(p: Perfil): string[] {
  const r: string[] = [];
  if (p.edad !== null) r.push(`${p.edad} años`);
  if (p.paroAgotado) r.push("Se te ha acabado el paro");
  else if (p.paro) r.push("En paro");
  if (p.sinIngresos) r.push("Sin ingresos");
  else if (p.pocosIngresos) r.push("Ingresos bajos");
  if (p.alquiler) r.push("Vives de alquiler");
  if (p.hijos) r.push(p.familiaNumerosa ? "Tres hijos o más" : "Hijos a cargo");
  if (p.escolar) r.push("Hijos en edad escolar");
  if (p.luz) r.push("Factura de la luz");
  if (p.pensionista) r.push("Cobras una pensión o estás jubilado");
  if (p.autonomo) r.push("Trabajas por cuenta propia");
  if (p.lugar === "cv") r.push("Comunitat Valenciana");
  if (p.lugar === "fuera") r.push("Fuera de la Comunitat Valenciana");
  return r;
}

// ───────────────────────── Reglas ─────────────────────────

// `motivo` son frases cortas; cada una se muestra en su línea.
type Senal = { peso: number; motivo: string[]; aviso?: string[] };
type Regla = {
  id: string;
  umbral: number;
  senales: (p: Perfil) => Senal[];
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
            "Dices que tus ingresos son bajos.",
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
            "Dices que tus ingresos son bajos.",
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
            "Dices que tus ingresos son bajos.",
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
            "Dices que tus ingresos son bajos.",
            "Con ingresos bajos, puedes estar por debajo del límite de ingresos.",
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

// ───────────────────────── Resultado ─────────────────────────

export type Fuente = { nombre: string; url: string };

export type Glosa = { termino: string; definicion: string };

export type Resultado = {
  id: string;
  /** Nombre corto, en lenguaje sencillo. */
  nombre: string;
  quien: string;
  resumen: string[];
  motivos: string[];
  avisos: string[];
  dinero: Dinero | null;
  requisitos: string[];
  pasos: string[];
  documentos: string[];
  estado: Estado;
  glosas: Glosa[];
  enlaceInfo: string;
  enlaceTramite: string | null;
  fuentes: Fuente[];
  verificado: boolean;
  // El texto del catálogo, tal cual. No está en lectura fácil.
  oficial: {
    titulo: string;
    organismo: string;
    requisitos: string[];
    plazo: string | null;
  };
};

export type Respuesta = {
  perfil: string[];
  resultados: Resultado[];
  // Lo que la herramienta no ha podido consultar o no cubre. Cada elemento son
  // frases cortas, una por línea.
  huecos: string[][];
  // Palabras difíciles de todas las ayudas de la respuesta, sin repetir.
  glosario: Glosa[];
  // Repaso final, una frase por línea.
  resumen: string[];
  consultado: string;
};

// La entrada trae las fuentes en un solo texto separado por « ; »; se enlazan
// tal cual, cada una a la página concreta que sostiene la respuesta.
function fuentesDe(e: Entrada): Fuente[] {
  const urls = e.fuente
    .split(";")
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
  return urls.map((url) => ({ nombre: new URL(url).hostname, url }));
}

const ORDEN_ESTADO: Record<Estado["tipo"], number> = {
  abierta: 0,
  permanente: 1,
  "sin-confirmar": 2,
  cerrada: 3,
};

function glosasDe(lineas: string[]): Glosa[] {
  return terminosDe(lineas).flatMap((termino) =>
    GLOSARIO[termino] ? [{ termino, definicion: GLOSARIO[termino] }] : [],
  );
}

function unir(listas: Glosa[][]): Glosa[] {
  const vistos = new Set<string>();
  return listas
    .flat()
    .filter((g) => !vistos.has(g.definicion) && vistos.add(g.definicion));
}

function repaso(resultados: Resultado[]): string[] {
  if (resultados.length === 0)
    return [
      "No he encontrado ayudas con lo que me cuentas.",
      "Cuéntame más cosas o mira la sede electrónica de la Generalitat.",
    ];
  const lista = (tipos: Estado["tipo"][]) =>
    resultados
      .filter((r) => tipos.includes(r.estado.tipo))
      .map((r) => r.nombre)
      .join(", ");
  const ahora = lista(["abierta", "permanente"]);
  const dudosas = lista(["sin-confirmar"]);
  const cerradas = lista(["cerrada"]);
  return [
    resultados.length === 1
      ? "He encontrado 1 ayuda que puede ser para ti."
      : `He encontrado ${resultados.length} ayudas que pueden ser para ti.`,
    ...(ahora ? [`Puedes pedir ahora: ${ahora}.`] : []),
    ...(dudosas ? [`No hemos confirmado el plazo de: ${dudosas}.`] : []),
    ...(cerradas ? [`Tienen el plazo cerrado: ${cerradas}.`] : []),
    "Que una ayuda pueda ser para ti no es seguro.",
    "Comprueba siempre los requisitos en la información oficial.",
  ];
}

export function buscarAyudas(texto: string, hoy = new Date()): Respuesta {
  const perfil = extraerPerfil(texto);
  const huecos: string[][] = [];

  if (perfil.lugar === "fuera")
    huecos.push([
      "Solo conozco las ayudas del Estado y de la Comunitat Valenciana.",
      "No conozco las ayudas de tu comunidad ni de tu ayuntamiento.",
    ]);
  else if (perfil.lugar === "cv" && perfil.lugarNombre !== "valencia")
    huecos.push([
      "Mi catálogo tiene ayudas del Estado y de la Generalitat.",
      "Los trámites están pensados para València.",
      "No he consultado las ayudas de tu ayuntamiento.",
    ]);
  if (perfil.autonomo)
    huecos.push([
      "No he consultado ayudas para personas que trabajan por cuenta propia.",
      "Míralas en la sede electrónica de la Generalitat o del ministerio que corresponde.",
    ]);
  if (perfil.dana)
    huecos.push([
      "Las ayudas por la **DANA** de 2024 no están en mi catálogo.",
      "Míralas en la sede electrónica de la Generalitat: https://sede.gva.es",
    ]);

  const encontradas: Resultado[] = [];
  for (const regla of REGLAS) {
    const e = ayudas.find((a) => a.id === regla.id);
    const a = ADAPTADAS[regla.id];
    if (!e || !a) continue;
    // Fuera de la Comunitat Valenciana no se proponen ayudas de la Generalitat.
    if (perfil.lugar === "fuera" && e.administracion !== "Estado") continue;

    const senales = regla.senales(perfil);
    const puntos = senales.reduce((s, x) => s + x.peso, 0);
    if (puntos < regla.umbral) continue;

    const avisos = senales.flatMap((s) => s.aviso ?? []);
    if (!e.verificado)
      avisos.push(
        "La ley cambió el 20 de octubre de 2026.",
        "No hemos encontrado el procedimiento nuevo.",
        "Pregunta en los **servicios sociales** de tu ayuntamiento.",
        "O llama al 012.",
      );

    const estado = estadoDe(e.id, hoy);
    const motivos = senales.flatMap((s) => s.motivo);
    const dinero = a.dinero ?? null;
    const todas = [
      ...a.resumen,
      ...motivos,
      ...avisos,
      ...(dinero ? [...dinero.intro, ...(dinero.lista ?? [])] : []),
      ...a.requisitos,
      ...a.pasos,
      ...a.documentos,
      ...estado.lineas,
    ];

    encontradas.push({
      id: e.id,
      nombre: a.nombre,
      quien: a.quien,
      resumen: a.resumen,
      motivos,
      avisos,
      dinero,
      requisitos: a.requisitos,
      pasos: a.pasos,
      documentos: a.documentos,
      estado,
      glosas: glosasDe(todas),
      enlaceInfo: e.enlace_info,
      enlaceTramite: e.enlace_tramite,
      fuentes: fuentesDe(e),
      verificado: e.verificado,
      oficial: {
        titulo: e.titulo,
        organismo: e.organismo,
        requisitos: e.requisitos_clave,
        plazo: e.plazo,
      },
    });
  }

  encontradas.sort(
    (a, b) => ORDEN_ESTADO[a.estado.tipo] - ORDEN_ESTADO[b.estado.tipo],
  );

  return {
    perfil: resumenPerfil(perfil),
    resultados: encontradas,
    huecos,
    glosario: unir([
      ...encontradas.map((r) => r.glosas),
      glosasDe(huecos.flat()),
    ]),
    resumen: repaso(encontradas),
    consultado: hoy.toISOString().slice(0, 10),
  };
}
