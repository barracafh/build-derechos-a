// Del perfil del chat a la búsqueda en la BDNS, y de sus resultados a las
// fichas y la cobertura del contrato (tipos.ts). Todo lo que sale aquí viene de
// la fuente oficial o de lo que dijo la persona: nada se redacta ni se supone.
import type { ArgsBuscar, AyudaEncontrada, ResultadoBuscar } from "@/lib/ayudas/buscar";
import type { Recurrente } from "@/lib/ayudas/recurrentes";
import { RENTAS_CONSULTADO, rentaPorId } from "@/lib/ayudas/rentas";
import { sinOrganismo, type Tema } from "@/lib/ayudas/temas";
import { normalizar } from "@/lib/lugares";
import { INGRESOS_BAJOS } from "@/lib/llm/pregunta";
import type { Cobertura, Ficha, Perfil } from "@/lib/tipos";

export type Busqueda = {
  args: ArgsBuscar;
  // Frases de la persona que justifican cada tema: son el «por qué» de las fichas.
  citasPorTema: Partial<Record<Tema, string[]>>;
};

// Palabras de la necesidad que apuntan a un tema.
const NECESIDAD: [RegExp, Tema][] = [
  [/\b(alquiler|lloguer|piso|vivienda|habitatge|hipoteca|desahucio)/, "vivienda"],
  [/\b(luz|llum|electric|gas|calefaccion|factura|energia)/, "energia"],
  [/\b(beca|estudi|libros|llibres|comedor|menjador|colegio|cole|escuela|instituto|matricula)/, "educacion"],
  [/\b(trabajo|empleo|treball|paro|atur|formacion)/, "empleo"],
  [/\b(transporte|autobus|bus|metro|abono)/, "transporte"],
  [/\b(dependencia|residencia|mayor|jubilad|pension)/, "mayores"],
  [/\b(discapacidad|diversidad funcional|minusvalia)/, "discapacidad"],
  [/\b(gafas|dentista|dental|medic|salud|tratamiento|audifono)/, "salud"],
  [/\b(hij[oa]s?|fills?|bebe|nacimiento|familia|guarderia)/, "familia"],
  [/\b(comida|alimentos|pobreza|deudas|emergencia)/, "servicios_sociales"],
];

const UNICOS = <T,>(xs: T[]) => [...new Set(xs)];

// Cosas concretas que se piden con una ayuda. Solo estas cuentan como palabra
// clave: una palabra libre («instituto») encaja con cualquier organismo
// («Instituto Geográfico Nacional»).
const PALABRAS_AYUDA = new Set(
  ("alquiler lloguer gafas dentista dental audifono audifonos comedor menjador libros llibres " +
    "material uniforme matricula guarderia escoleta transporte abono luz llum electricidad gas agua " +
    "calefaccion suministros ortopedia protesis silla dependencia cuidador cuidadora teleasistencia " +
    "natalidad nacimiento adopcion acogimiento lactancia campamento campamentos colonias vacaciones " +
    "deporte bicicleta ordenador internet hipoteca desahucio mudanza fianza").split(" "),
);

// Hasta 6 de esas palabras, dichas por la persona: ordenan la búsqueda y bastan
// para proponer una convocatoria si están en su título.
export function palabrasDeNecesidad(necesidad: string | null): string[] {
  if (!necesidad) return [];
  const palabras = normalizar(necesidad)
    .split(/[^a-zñç]+/)
    .filter((p) => PALABRAS_AYUDA.has(p));
  return UNICOS(palabras).slice(0, 6);
}

export function busquedaDelPerfil(perfil: Perfil): Busqueda | null {
  const hecho = (campo: string) => perfil.hechos.find((h) => h.campo === campo);
  const municipio = hecho("municipio");
  if (!municipio) return null;

  const citas: Partial<Record<Tema, string[]>> = {};
  const poner = (t: Tema, cita: string) => (citas[t] = UNICOS([...(citas[t] ?? []), cita]));
  const valor = (campo: string) => normalizar(hecho(campo)?.valor ?? "");

  const laboral = hecho("situacionLaboral");
  if (laboral) {
    const v = valor("situacionLaboral");
    if (v.includes("paro")) poner("empleo", laboral.cita);
    if (v === "autonomo") poner("emprendimiento", laboral.cita);
    if (v === "jubilado") poner("mayores", laboral.cita);
    if (v === "estudiando") poner("educacion", laboral.cita);
  }
  const pension = hecho("pension");
  if (pension) poner("mayores", pension.cita);
  const vivienda = hecho("vivienda");
  if (vivienda && /alquiler|habitacion/.test(valor("vivienda"))) poner("vivienda", vivienda.cita);
  const hijos = hecho("hijos");
  // Un número o «sí» (las reglas no siempre saben cuántos).
  if (hijos && !/^(0|no|ninguno|ninguna)$/.test(valor("hijos"))) {
    poner("familia", hijos.cita);
    poner("educacion", hijos.cita);
  }
  const ingresos = hecho("ingresos");
  if (ingresos && (ingresos.valor === "sin ingresos" || INGRESOS_BAJOS.includes(ingresos.valor)))
    poner("servicios_sociales", ingresos.cita);
  const discapacidad = hecho("discapacidad");
  if (discapacidad && !/^no\b/.test(valor("discapacidad"))) poner("discapacidad", discapacidad.cita);
  const edad = hecho("edad");
  if (edad && Number(edad.valor) > 0 && Number(edad.valor) <= 35) poner("juventud", edad.cita);
  if (perfil.necesidad) {
    const n = normalizar(perfil.necesidad);
    for (const [re, tema] of NECESIDAD) if (re.test(n)) poner(tema, perfil.necesidad);
  }

  return {
    args: {
      municipio: municipio.valor,
      temas: Object.keys(citas) as Tema[],
      palabras: palabrasDeNecesidad(perfil.necesidad),
      autonomo: !!citas.emprendimiento,
      catalogo: false,
    },
    citasPorTema: citas,
  };
}

// Para proponer una convocatoria sin que la elija el LLM, su título tiene que
// hablar de lo que contó la persona, no solo compartir tema: «vivienda» también
// son las ayudas a propietarios para rehabilitar edificios. Y «beca» sola
// tampoco: la mayoría son de formación para adultos.
const TITULO_POR_TEMA: Partial<Record<Tema, RegExp>> = {
  vivienda: /\b(alquiler|lloguer|arrendamiento|arrendataria|inquilin)/,
  empleo: /\b(desemplead|parad[oa]s|aturad|demandantes de empleo)/,
  familia: /\b(hij[oa]s|fills|famili|natalidad|nacimiento|naixement|crianza|infancia|guarderia|escoleta)/,
  educacion: /\b(libros|llibres|comedor|menjador|material escolar|matricula|estudiantes|alumn)/,
  energia: /\b(suministr|pobreza energetica|factura|electric|calefaccion)/,
  mayores: /\b(mayores|majors|jubilad|pensionist|tercera edad|envejecimiento)/,
  discapacidad: /\b(discapacidad|diversidad funcional|dependencia)/,
  juventud: /\b(joven|jovenes|juventud|jove|joves)\b/,
  servicios_sociales: /\b(emergencia social|vulnerab|exclusion|necesidades basicas|urgencia social)/,
  emprendimiento: /\b(autonom|cuenta propia|emprend)/,
};
const NO_PARA_PERSONAS =
  /\b(edificio|fachada|ascensor|rehabilitaci|subsecretaria|becas? (de|para) (la )?formacion|practicas|comunidades? de propietarios|empresas|entidades|asociaciones|ayuntamientos|municipios|premio|concurso|investigaci|contratacion de|centros|clubes)/;

// Temas de la convocatoria que su título confirma, o ninguno si no es para personas.
type ConTitulo = Pick<AyudaEncontrada, "titulo" | "encaja_con" | "palabras_en_titulo">;

export function temasEnTitulo(a: ConTitulo): Tema[] {
  const t = sinOrganismo(a.titulo);
  if (NO_PARA_PERSONAS.test(t)) return [];
  return a.encaja_con.filter((tema) => TITULO_POR_TEMA[tema]?.test(t));
}

// Para proponerla sin que la elija el LLM: un tema que su título confirma o una
// palabra de lo que pidió la persona, y que no sea para entidades.
export function encajaPorTitulo(a: ConTitulo): boolean {
  if (NO_PARA_PERSONAS.test(sinOrganismo(a.titulo))) return false;
  return temasEnTitulo(a).length > 0 || a.palabras_en_titulo.length > 0;
}

// «AYUNTAMIENTO DE LA VALL D'UIXÓ» → «Ayuntamiento de la Vall d'Uixó».
const MENORES = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "i", "d", "l", "en", "a"]);
export function nombrePropio(t: string): string {
  return t
    .toLocaleLowerCase("es")
    .replace(/[\p{L}]+/gu, (p, i: number) =>
      i > 0 && MENORES.has(p) ? p : p[0].toLocaleUpperCase("es") + p.slice(1),
    );
}

const ESTADO: Record<AyudaEncontrada["estado"], Ficha["estado"]> = {
  abierta: "abierta",
  sin_plazo_fijo: "permanente",
  proximamente: "desconocido",
  por_confirmar: "desconocido",
  cerrada: "cerrada",
  no_solicitable: "cerrada",
};

const SIN_REQUISITOS = [
  "No hemos podido leer los requisitos de esta convocatoria.",
  "Están en las bases oficiales: ábrelas en «Información oficial».",
];

export function fichaDeBdns(
  a: AyudaEncontrada,
  { comunidad, porQue, requisitos }: { comunidad: string; porQue: string[]; requisitos: string[] },
): Ficha {
  const organismo = nombrePropio(a.organismo);
  const administracion: Ficha["administracion"] =
    a.nivel === "Estado" ? "Estado" : a.nivel === "Local" ? "Local" : "Comunitat Valenciana";
  const ayuntamiento = /^Ayuntamiento de (.+)$/i.exec(organismo)?.[1];
  const ambito =
    a.nivel === "Estado" ? null : a.nivel === "Local" ? (ayuntamiento ?? organismo) : comunidad;

  const e = a.enlaces;
  const fuentes = [
    { nombre: "Convocatoria en el boletín oficial", url: e.convocatoria },
    { nombre: "Base de Datos Nacional de Subvenciones (Intervención General de la Administración del Estado)", url: e.ficha },
    { nombre: "Bases reguladoras", url: e.bases },
    { nombre: "Texto de la convocatoria (PDF, se descarga)", url: e.pdf },
    { nombre: `Sede electrónica de ${organismo}`, url: e.sede },
  ].filter((f): f is { nombre: string; url: string } => !!f.url);
  const dondeSePide = e.solicitud
    ? "Se pide en la sede electrónica: botón «Hacer el trámite»."
    : e.sede
      ? `Se pide en la sede electrónica de ${organismo}: ${new URL(e.sede).hostname}. Busca el trámite por su nombre.`
      : "Las bases dicen dónde y cómo se presenta.";

  return {
    id: a.id,
    titulo: a.titulo,
    finalidad: a.finalidad ?? a.titulo,
    fuente: a.fuente === "pack" ? "pack" : "bdns",
    administracion,
    estado: ESTADO[a.estado],
    fechaFin: a.fin_plazo,
    // «Información oficial»: el anuncio de esta convocatoria o, si no hay, su ficha.
    enlace: e.convocatoria ?? e.ficha,
    porQue: UNICOS(porQue),
    requisitos: requisitos.length ? requisitos : SIN_REQUISITOS,
    pendiente: [],
    verificado: true,
    detalle: {
      ambito,
      porQueDetalle: [],
      resumen: [`Convocatoria de ${organismo}.`, ...(a.finalidad ? [`Para: ${a.finalidad}.`] : [])],
      avisos: a.aviso ? [a.aviso] : [],
      dinero: null,
      plazo: [a.plazo],
      pasos: [
        "Lee la convocatoria: dice quién puede pedirla y qué papeles hacen falta.",
        dondeSePide,
        "Preséntala dentro del plazo.",
      ],
      documentos: ["Los que pide la convocatoria."],
      enlaceTramite: e.solicitud,
      fuentes,
      oficial: {
        titulo: a.titulo,
        organismo: a.organismo,
        requisitos,
        plazo: a.plazo,
      },
    },
  };
}

// La renta mínima de la comunidad: texto de su página oficial, sin resumir.
export function fichaDeRenta(
  a: AyudaEncontrada,
  { porQue, pendiente }: { porQue: string[]; pendiente: Ficha["pendiente"] },
): Ficha | null {
  const r = rentaPorId(a.id.slice("renta:".length));
  if (!r) return null;
  const e = a.enlaces;
  return {
    id: a.id,
    titulo: r.titulo,
    finalidad: "Renta mínima para cubrir las necesidades básicas.",
    fuente: "catalogo",
    administracion: "Comunitat Valenciana",
    estado: ESTADO[a.estado],
    fechaFin: null,
    enlace: e.ficha,
    porQue: UNICOS(porQue),
    requisitos: r.requisitos_clave.length
      ? r.requisitos_clave
      : ["No hemos podido leer los requisitos: míralos en «Información oficial»."],
    pendiente,
    verificado: true,
    detalle: {
      ambito: r.ccaa,
      porQueDetalle: [],
      resumen: [`Prestación de ${r.organismo}.`, "Es una renta mínima: dinero cada mes para cubrir lo básico."],
      // La nota es para revisar los datos, no para la persona.
      avisos: [],
      dinero: null,
      plazo: [a.plazo],
      pasos: [
        "Lee los requisitos en la página oficial.",
        e.solicitud
          ? "Se pide en la sede electrónica: botón «Hacer el trámite»."
          : "La página oficial dice dónde se presenta.",
        "Los servicios sociales de tu ayuntamiento también te informan.",
      ],
      documentos: ["Los que pide la página oficial."],
      enlaceTramite: e.solicitud,
      fuentes: [
        { nombre: `Página oficial de ${r.organismo}, consultada el ${fechaCorta(RENTAS_CONSULTADO)}`, url: e.ficha },
        ...(e.solicitud && e.solicitud !== e.ficha ? [{ nombre: "Trámite en la sede electrónica", url: e.solicitud }] : []),
      ],
      oficial: { titulo: r.titulo, organismo: r.organismo, requisitos: r.requisitos_clave, plazo: r.plazo },
    },
  };
}

// Una anual que aún no ha salido: la ficha de la del año pasado, sin trámite.
export function fichaDeRecurrente(
  r: Recurrente,
  { comunidad, porQue }: { comunidad: string; porQue: string[] },
): Ficha {
  const f = fichaDeBdns(
    {
      ...r,
      estado: "por_confirmar",
      plazo: r.texto,
      fin_plazo: null,
      finalidad: null,
      para_quien: [],
      ambito: [],
      aviso: null,
      fuente: "bdns",
    },
    { comunidad, porQue, requisitos: [] },
  );
  return {
    ...f,
    requisitos: [
      "Los del año pasado están en su convocatoria.",
      "Pueden cambiar si vuelve a salir.",
    ],
    detalle: {
      ...f.detalle!,
      resumen: ["Tradicionalmente es anual: tenla en cuenta para los próximos meses.", ...f.detalle!.resumen],
      avisos: ["Todavía no se puede pedir. Te la enseñamos porque otros años ha salido por estas fechas."],
      pasos: [
        "Todavía no se puede pedir.",
        "Vuelve a buscarla dentro de unas semanas o mira la sede del organismo.",
      ],
      enlaceTramite: null,
    },
  };
}

const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

// Sin lo que la búsqueda ya resolvió y con lo que ella dice que no miró.
export function coberturaConBdns(
  base: Cobertura,
  r: ResultadoBuscar | null,
  motivo: string | null,
): Cobertura {
  if (!r)
    return motivo
      ? {
          ...base,
          noConsultado: base.noConsultado.map((t) =>
            t === "Convocatorias publicadas en la BDNS" ? `${t}: ${motivo}` : t,
          ),
        }
      : base;
  const resuelto = (t: string) =>
    t === "Convocatorias publicadas en la BDNS" ||
    (!!r.ubicacion.municipio && /^Ayudas de tu (comunidad autónoma y de tu )?ayuntamiento$/.test(t));
  const locales = r.ubicacion.organismos_locales_consultados;
  return {
    ...base,
    consultado: [
      ...base.consultado,
      `Base de Datos Nacional de Subvenciones: Estado, ${r.ubicacion.comunidad}${
        locales.length ? ` y ${locales.map(nombrePropio).join(", ")}` : ""
      }, el ${r.fecha_consulta}`,
    ],
    noConsultado: UNICOS([
      ...base.noConsultado.filter((t) => !resuelto(t)),
      ...r.no_consultado.map((t) => t.replace(/ \(indica .*\)\./, ".")),
      ...(r.respaldo ? [r.respaldo.replace(/;? ?dilo al ciudadano\.?/, ".")] : []),
    ]),
  };
}
