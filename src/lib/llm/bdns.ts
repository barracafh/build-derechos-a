// Del perfil del chat a la búsqueda en la BDNS, y de sus resultados a las
// fichas y la cobertura del contrato (tipos.ts). Todo lo que sale aquí viene de
// la fuente oficial o de lo que dijo la persona: nada se redacta ni se supone.
import type { ArgsBuscar, AyudaEncontrada, ResultadoBuscar } from "@/lib/ayudas/buscar";
import type { Tema } from "@/lib/ayudas/temas";
import { normalizar } from "@/lib/lugares";
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
  [/\b(beca|estudi|libros|llibres|comedor|menjador|colegio|cole|escuela|matricula)/, "educacion"],
  [/\b(trabajo|empleo|treball|paro|atur|formacion)/, "empleo"],
  [/\b(transporte|autobus|bus|metro|abono)/, "transporte"],
  [/\b(dependencia|residencia|mayor|jubilad|pension)/, "mayores"],
  [/\b(discapacidad|diversidad funcional|minusvalia)/, "discapacidad"],
  [/\b(gafas|dentista|dental|medic|salud|tratamiento|audifono)/, "salud"],
  [/\b(hij[oa]s?|fills?|bebe|nacimiento|familia|guarderia)/, "familia"],
  [/\b(comida|alimentos|pobreza|deudas|emergencia)/, "servicios_sociales"],
];

const UNICOS = <T,>(xs: T[]) => [...new Set(xs)];

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
  if (hijos && Number(hijos.valor) > 0) {
    poner("familia", hijos.cita);
    poner("educacion", hijos.cita);
  }
  const ingresos = hecho("ingresos");
  if (ingresos && /sin ingresos|bajos/.test(valor("ingresos")))
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
      autonomo: !!citas.emprendimiento,
      catalogo: false,
    },
    citasPorTema: citas,
  };
}

// Para proponer una convocatoria sin que la elija el LLM, su título tiene que
// hablar de lo que contó la persona, no solo compartir tema: «vivienda» también
// son las ayudas a propietarios para rehabilitar edificios.
const TITULO_POR_TEMA: Partial<Record<Tema, RegExp>> = {
  vivienda: /\b(alquiler|lloguer|arrendamiento|arrendataria|inquilin)/,
  empleo: /\b(desemplead|parad[oa]s|aturad|demandantes de empleo)/,
  familia: /\b(hij[oa]s|fills|famili|natalidad|nacimiento|naixement|crianza|infancia|guarderia|escoleta)/,
  educacion: /\b(beca|libros|llibres|comedor|menjador|material escolar|matricula|estudiantes|alumn)/,
  energia: /\b(suministr|pobreza energetica|factura|electric|calefaccion)/,
  mayores: /\b(mayores|majors|jubilad|pensionist|tercera edad|envejecimiento)/,
  discapacidad: /\b(discapacidad|diversidad funcional|dependencia)/,
  juventud: /\b(joven|jovenes|juventud|jove|joves)\b/,
  servicios_sociales: /\b(emergencia social|vulnerab|exclusion|necesidades basicas|urgencia social)/,
  emprendimiento: /\b(autonom|cuenta propia|emprend)/,
};
const NO_PARA_PERSONAS =
  /\b(edificio|fachada|ascensor|rehabilitaci|subsecretaria|becas? de formacion|practicas|comunidades? de propietarios|empresas|entidades|asociaciones|ayuntamientos|municipios|premio|concurso|investigaci|contratacion de|centros|clubes)/;

// Temas de la convocatoria que su título confirma, o ninguno si no es para personas.
export function temasEnTitulo(a: AyudaEncontrada): Tema[] {
  // Sin el nombre del organismo que convoca («Conselleria de Vivienda, Empleo,
  // Juventud e Igualdad»), que no dice nada de la ayuda.
  const t = normalizar(a.titulo).replace(
    /\b(conselleria|consejeria|ministerio|departament\w*|vicep\w*)\b.*?(\bque\b|\bpor la que\b|\bde aprobacion\b|,|$)/g,
    " ",
  );
  if (NO_PARA_PERSONAS.test(t)) return [];
  return a.encaja_con.filter((tema) => TITULO_POR_TEMA[tema]?.test(t));
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

  const fuentes = [
    {
      nombre: "Base de Datos Nacional de Subvenciones (Intervención General de la Administración del Estado)",
      url: a.enlace,
    },
  ];
  if (a.enlace_bases?.startsWith("https://") && a.enlace_bases !== a.enlace)
    fuentes.push({ nombre: "Bases de la convocatoria", url: a.enlace_bases });

  return {
    id: a.id,
    titulo: a.titulo,
    finalidad: a.finalidad ?? a.titulo,
    fuente: a.fuente === "pack" ? "pack" : "bdns",
    administracion,
    estado: ESTADO[a.estado],
    fechaFin: a.fin_plazo,
    enlace: a.enlace,
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
        "Lee las bases oficiales: dicen quién puede pedirla, qué papeles hacen falta y dónde se presenta.",
        "Preséntala dentro del plazo.",
      ],
      documentos: ["Los que piden las bases de la convocatoria."],
      enlaceTramite: null,
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
