import type { Prioridad } from "@/lib/ayudas/bdns";
import type { ArgsBuscar, AyudaEncontrada, ResultadoBuscar } from "@/lib/ayudas/buscar";
import type { Enlaces } from "@/lib/ayudas/convocatoria";
import type { ErrorUbicacion } from "@/lib/ayudas/territorio";
import type { Mensaje } from "@/lib/ia";
import { elegirPreguntas, INGRESOS_BAJOS, TEXTO_PREGUNTA } from "@/lib/llm/pregunta";
import { hablaDeDana, perfilDeTexto } from "@/lib/llm/respaldo";
import {
  bloqueada,
  crearFicha,
  fichasDelCatalogo,
  IDS_AYUDAS,
  noCubiertoPor,
  vigentesPorEstado,
} from "@/lib/motor/catalogo";
import { centralPorId } from "@/lib/ayudas/central";
import { fichaCentral, fichasCentrales, VERSION_CENTRAL } from "@/lib/motor/central";
import { normalizar } from "@/lib/lugares";
import type { Cobertura, Ficha, MensajeChat, Paso, Perfil, Respuesta } from "@/lib/tipos";
import {
  conversarConHerramientas,
  nuevosHallazgos,
  type Agente,
  type Ejecutar,
  type Hallazgos,
} from "./agente";
import {
  busquedaDelPerfil,
  coberturaConBdns,
  encajaPorTitulo,
  fichaDeBdns,
  fichaDeRecurrente,
  fichaDeRenta,
  fichaServiciosSociales,
  paraEntidades,
  temasEnTitulo,
} from "./bdns";
import { construirMensajes, leerDatos, leerRespuesta, type Lectura } from "./perfil";

// Un segundo intento solo si el primero falla, tarda demasiado o no trae JSON.
export const INTENTOS = 2;

type Dependencias = {
  completar: (messages: Mensaje[]) => Promise<string>;
  hoy: Date;
  msPorIntento?: number;
  // Opcionales: con ellas, además del catálogo, se buscan convocatorias en la
  // BDNS para el municipio de la persona (lib/ayudas).
  agente?: Agente;
  ejecutar?: Ejecutar;
  buscar?: (args: ArgsBuscar) => Promise<ResultadoBuscar | ErrorUbicacion>;
  requisitos?: (numero: string, p?: Prioridad) => Promise<string[]>;
  // Quita los enlaces rotos antes de enseñarlos.
  comprobar?: (enlaces: Enlaces) => Promise<Enlaces>;
  msAgente?: number;
  // Lo que manda el navegador del turno anterior: se valida antes de usarlo.
  anterior?: unknown;
  ayudasAnteriores?: unknown;
  alAvanzar?: (paso: Paso) => void;
};

// Presupuesto con agente, dentro de los 120 s de la ruta: el LLM (agente y, si
// falla rápido, el bucle sin herramientas) y después la BDNS y sus requisitos.
// Con HelmCode cargado, cada llamada tarda hasta 15 s y el agente hace dos o tres.
const MS_LLM_CON_AGENTE = 70_000;
const MS_BUSQUEDA = 14_000;
const MS_REQUISITOS = 4_000;
const MS_PRECARGA = 30_000;
// Convocatorias que se proponen solas si el LLM no elige ninguna, y cuántas
// puede elegir él.
const AUTOMATICAS = 4;
const MAX_ELEGIDAS = 5;
const MAX_RECURRENTES = 3;

function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error(`sin respuesta en ${ms} ms`)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(reloj));
}

// Una conversación → una respuesta con las ayudas del catálogo. El LLM lee el
// texto y propone ayudas; el código valida cada cosa y monta las fichas. Si el
// LLM no responde bien, se lee el texto con reglas (respaldo.ts y motor/).
// No guarda ni registra nada de lo que escribe la persona.
export async function responder(
  mensajes: MensajeChat[],
  {
    completar,
    hoy,
    msPorIntento = 20_000,
    agente,
    ejecutar,
    buscar,
    requisitos,
    comprobar,
    msAgente = 60_000,
    anterior = null,
    ayudasAnteriores = [],
    alAvanzar = () => {},
  }: Dependencias,
): Promise<Respuesta> {
  const empezado = Date.now();
  const fechaConsulta = hoy.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const delUsuario = mensajes.filter((m) => m.rol === "usuario");
  const ultimo = delUsuario.at(-1)!;

  // Las ayudas de la DANA no están en el catálogo: se remite a la sede.
  if (hablaDeDana(ultimo.texto))
    return {
      perfil: { hechos: [], necesidad: null },
      fichas: [],
      cobertura: {
        consultado: [],
        noConsultado: ["Ayudas por la DANA de 2024: míralas en https://sede.gva.es"],
        respaldo: true,
        fechaConsulta,
      },
      pregunta: null,
      formulario: [],
    };

  // Mientras el LLM lee, se adelanta la búsqueda con el municipio que encuentran
  // las reglas: la BDNS queda en caché para cuando la pida el agente.
  const adelantada = buscar ? adelantar(delUsuario, buscar, requisitos) : null;

  // En los registros, solo el error de HelmCode, nunca el texto de la persona.
  // Solo ids con forma de ayuda: van al prompt.
  // Las fichas centrales llevan el id sin prefijo: al modelo se le da con «central:».
  const anteriores = (Array.isArray(ayudasAnteriores) ? ayudasAnteriores : [])
    .filter((id): id is string => typeof id === "string")
    .map((id) => (centralPorId(id) ? `central:${id}` : id))
    .filter((id) => IDS_AYUDAS.includes(id) || /^(bdns|renta|central):[\w-]{1,80}$/.test(id))
    .slice(0, 15);
  let lectura: Lectura | null = null;
  const hallazgos = nuevosHallazgos();
  let sinTiempo = false;
  if (agente) {
    alAvanzar("leyendo");
    // Si el agente se pasa de tiempo, sigue en segundo plano: sus fases ya no se envían.
    let enAgente = true;
    try {
      const texto = await conLimite(
        conversarConHerramientas(mensajes, agente, hallazgos, ejecutar, anteriores, (paso) => {
          if (enAgente) alAvanzar(paso);
        }),
        msAgente,
      ).finally(() => (enAgente = false));
      lectura = texto
        ? leerRespuesta(texto, mensajes, new Set(hallazgos.ayudas.keys()), anterior)
        : null;
      if (!lectura) console.error("LLM con herramientas: la respuesta no trae JSON");
    } catch (error) {
      sinTiempo = (error as Error).message.startsWith("sin respuesta");
      console.error("LLM con herramientas:", (error as Error).message);
    }
  }
  // Si el agente agotó su tiempo, otro intento tampoco cabe: se usan las reglas.
  const finLLM = agente ? empezado + MS_LLM_CON_AGENTE : Infinity;
  for (let intento = 1; intento <= INTENTOS && !lectura && !sinTiempo; intento++) {
    const ms = Math.min(msPorIntento, finLLM - Date.now());
    if (agente && ms < 2_000) break;
    alAvanzar(intento === 1 && !agente ? "leyendo" : "reintentando");
    try {
      const texto = await conLimite(completar(construirMensajes(mensajes, { anteriores })), ms);
      lectura = leerRespuesta(texto, mensajes, undefined, anterior);
      if (!lectura) console.error(`LLM, intento ${intento}: la respuesta no trae JSON`);
    } catch (error) {
      console.error(`LLM, intento ${intento}:`, (error as Error).message);
    }
  }
  alAvanzar("comprobando");

  let perfil: Perfil;
  let fichas: Ficha[];
  const noConsultado: string[] = [];
  if (lectura) {
    perfil = lectura.perfil;
    fichas = vigentesPorEstado(
      lectura.elegidos
        .filter(({ id }) => IDS_AYUDAS.includes(id) && !bloqueada(id, perfil))
        .map(({ id, citas }) =>
          crearFicha(id, perfil, citas.map((c) => `Dices: «${c}».`), [], hoy),
        ),
    );
  } else {
    // Lo que leen las reglas y, para lo que no encuentran, el perfil anterior validado.
    const leido = perfilDeTexto(delUsuario.map((m) => m.texto).join("\n"));
    const previo = leerDatos({}, mensajes, undefined, anterior).perfil;
    const nuevos = new Set(leido.hechos.map((h) => h.campo));
    perfil = {
      hechos: [...previo.hechos.filter((h) => !nuevos.has(h.campo)), ...leido.hechos],
      necesidad: leido.necesidad ?? previo.necesidad,
    };
    fichas = fichasDelCatalogo(perfil, hoy);
    noConsultado.push(
      "La lectura de tu mensaje con inteligencia artificial. No ha funcionado y he buscado palabras clave.",
    );
  }

  // Ayudas centrales (spec 004): después del catálogo, sin repetirlas.
  fichas = vigentesPorEstado([...fichas, ...fichasCentrales(perfil, new Set(fichas.map((f) => f.id)), hoy)]);
  // Las centrales que eligió el agente entre las de buscar_ayudas, con sus citas.
  for (const e of lectura?.elegidos ?? []) {
    const a = e.id.startsWith("central:") ? centralPorId(e.id.slice("central:".length)) : null;
    if (!a) continue;
    const porQue = e.citas.map((c) => `Dices: «${c}».`);
    const ya = fichas.find((f) => f.id === a.id);
    if (ya) ya.porQue = porQue;
    else fichas = vigentesPorEstado([...fichas, { ...fichaCentral(a, perfil, null, hoy), porQue }]);
  }
  // Y, si cuenta una urgencia o no tiene ingresos, a dónde ir: servicios sociales.
  const social = fichaServiciosSociales(perfil);
  if (social) fichas = [...fichas, social];

  const base: Cobertura = {
    consultado: [
      "Catálogo de trámites y ayudas (Estado, Generalitat y Ajuntament de València), a 18/10/2026",
      `Ayudas leídas de páginas oficiales por un proceso automático, a ${VERSION_CENTRAL}`,
    ],
    noConsultado: [...noConsultado, ...noCubiertoPor(perfil)],
    respaldo: true,
    fechaConsulta,
  };
  if (!buscar)
    return { perfil, fichas, cobertura: base, ...elegirPreguntas(fichas, perfil, mensajes) };

  // Si el agente ya buscó, conBdns usa su resultado y no vuelve a buscar.
  if (!hallazgos.busqueda) alAvanzar("buscando");
  const bdns = await conBdns(perfil, lectura, hallazgos, buscar, requisitos, comprobar, adelantada);
  // Si la BDNS no reconoce el municipio, se aclara eso solo; si falta, ya va
  // en el formulario.
  const hecha = (p: string) => mensajes.some((m) => m.rol === "asistente" && m.texto === p);
  const aclarar =
    bdns.pregunta && bdns.pregunta !== TEXTO_PREGUNTA.municipio && !hecha(bdns.pregunta);
  return {
    perfil,
    fichas: vigentesPorEstado([...fichas, ...bdns.fichas]),
    cobertura: coberturaConBdns(base, hallazgos.busqueda, bdns.motivo),
    recurrentes: bdns.recurrentes,
    ...(aclarar
      ? { pregunta: bdns.pregunta, formulario: [] }
      : elegirPreguntas(fichas, perfil, mensajes)),
  };
}

const PROPONIBLE = new Set<AyudaEncontrada["estado"]>(["abierta", "sin_plazo_fijo", "proximamente"]);

// Las convocatorias que se proponen solas si el LLM no elige ninguna.
const automaticas = (ayudas: AyudaEncontrada[]) =>
  ayudas
    .filter((a) => a.id.startsWith("bdns:") && PROPONIBLE.has(a.estado))
    .filter(encajaPorTitulo)
    .slice(0, AUTOMATICAS);

// Convocatorias de la BDNS para el municipio: las que eligió el LLM entre las
// que devolvió buscar_ayudas o, si no eligió ninguna, las primeras que tratan de
// lo que contó la persona y tienen el plazo comprobado.
// La renta mínima de la comunidad, si el LLM la eligió o si la persona dice que
// no tiene ingresos, que son bajos o que se le acabó el paro.
function rentaSiEncaja(
  perfil: Perfil,
  lectura: Lectura | null,
  r: ResultadoBuscar,
  citasSociales: string[],
): Ficha[] {
  const a = r.ayudas.find((x) => x.id.startsWith("renta:"));
  if (!a || a.estado === "cerrada") return [];
  const elegida = lectura?.elegidos.find((e) => e.id === a.id);
  const senales = perfil.hechos
    .filter(
      (h) =>
        (h.campo === "ingresos" &&
          (h.valor === "sin ingresos" || INGRESOS_BAJOS.includes(h.valor))) ||
        (h.campo === "situacionLaboral" && h.valor === "paro agotado"),
    )
    .map((h) => h.cita);
  const citas = [...new Set([...(elegida?.citas ?? []), ...senales, ...citasSociales])];
  if (!elegida && !senales.length) return [];
  const conocidos = new Set(perfil.hechos.map((h) => h.campo));
  const ficha = fichaDeRenta(a, {
    porQue: citas.map((c) => `Dices: «${c}».`),
    pendiente: conocidos.has("ingresos") ? [] : ["ingresos"],
  });
  return ficha ? [ficha] : [];
}

type Adelantada = { municipio: string; promesa: Promise<ResultadoBuscar | ErrorUbicacion> };

function adelantar(
  delUsuario: MensajeChat[],
  buscar: NonNullable<Dependencias["buscar"]>,
  requisitos: Dependencias["requisitos"],
): Adelantada | null {
  const b = busquedaDelPerfil(perfilDeTexto(delUsuario.map((m) => m.texto).join("\n")));
  if (!b?.args.municipio) return null;
  const promesa = buscar(b.args);
  // También los requisitos de las que encajan: si hay que bajar el PDF, que
  // quede en caché antes de montar las fichas. Con prioridad baja, detrás de
  // lo que pida el agente.
  promesa
    .then((r) => {
      if ("error" in r || !requisitos) return;
      const p: Prioridad = { baja: true, hasta: Date.now() + MS_PRECARGA };
      for (const a of automaticas(r.ayudas)) requisitos(a.id.slice("bdns:".length), p).catch(() => {});
    })
    .catch(() => {}); // si nadie la espera, que no quede un rechazo suelto
  return { municipio: b.args.municipio, promesa };
}

async function conBdns(
  perfil: Perfil,
  lectura: Lectura | null,
  hallazgos: Hallazgos,
  buscar: NonNullable<Dependencias["buscar"]>,
  requisitos: Dependencias["requisitos"],
  comprobar: Dependencias["comprobar"],
  adelantada: Adelantada | null,
): Promise<{ fichas: Ficha[]; recurrentes: Ficha[]; motivo: string | null; pregunta: string | null }> {
  const busqueda = busquedaDelPerfil(perfil);
  if (!hallazgos.busqueda && !hallazgos.errorUbicacion && busqueda) {
    const mismoSitio =
      adelantada && normalizar(adelantada.municipio).trim() === normalizar(busqueda.args.municipio ?? "").trim();
    try {
      const r = await conLimite(mismoSitio ? adelantada.promesa : buscar(busqueda.args), MS_BUSQUEDA);
      if ("error" in r) hallazgos.errorUbicacion = r;
      else hallazgos.busqueda = r;
    } catch (error) {
      console.error("BDNS:", (error as Error).message);
      return { fichas: [], recurrentes: [], motivo: "no ha respondido a tiempo", pregunta: null };
    }
  }

  const r = hallazgos.busqueda;
  if (!r) {
    const opciones = hallazgos.errorUbicacion?.opciones?.slice(0, 4);
    if (opciones?.length)
      return {
        fichas: [],
        recurrentes: [],
        motivo: "hay varios municipios con ese nombre",
        pregunta: `¿En cuál vives: ${opciones.slice(0, -1).join(", ")} o ${opciones.at(-1)}?`,
      };
    if (hallazgos.errorUbicacion)
      return {
        fichas: [],
        recurrentes: [],
        motivo: "no reconozco el municipio",
        pregunta: "¿En qué municipio y provincia vives?",
      };
    return {
      fichas: [],
      recurrentes: [],
      motivo: "falta saber tu municipio",
      pregunta: TEXTO_PREGUNTA.municipio,
    };
  }

  const ayudas = new Map(r.ayudas.map((a) => [a.id, a]));
  const comoPorQue = (citas: string[]) => citas.map((c) => `Dices: «${c}».`);
  let elegidas = (lectura?.elegidos ?? [])
    .filter((e) => e.id.startsWith("bdns:"))
    .map((e) => ({ a: ayudas.get(e.id), porQue: comoPorQue(e.citas) }))
    .filter(({ a }) => a && a.estado !== "cerrada" && a.estado !== "no_solicitable")
    .slice(0, MAX_ELEGIDAS) as { a: AyudaEncontrada; porQue: string[] }[];
  if (!elegidas.length)
    elegidas = automaticas(r.ayudas).map((a) => ({
      a,
      porQue: [
        ...comoPorQue([...new Set(temasEnTitulo(a).flatMap((t) => busqueda?.citasPorTema[t] ?? []))]),
        // No es una cita: con las reglas, la necesidad son palabras sueltas.
        ...(a.palabras_en_titulo.length
          ? [`Su título habla de ${a.palabras_en_titulo.map((p) => `«${p}»`).join(" y ")}, como lo que pides.`]
          : []),
      ],
    }));

  // Enlaces sin los rotos, a la vez que los requisitos.
  const enlaces = Promise.all(
    elegidas.map(({ a }) => (comprobar ? comprobar(a.enlaces) : a.enlaces)),
  );

  // Requisitos: los que leyó el agente o, si no, los del extracto o el PDF. Cada
  // ficha con su límite: un PDF lento no deja sin requisitos a las demás.
  const lineas = await Promise.all(
    elegidas.map(({ a }) => {
      const leidas = hallazgos.requisitos.get(a.id);
      if (leidas || !requisitos) return leidas ?? [];
      return conLimite(requisitos(a.id.slice("bdns:".length)), MS_REQUISITOS).catch(() => []);
    }),
  );

  const vivos = await conLimite(enlaces, MS_REQUISITOS).catch(() => elegidas.map(({ a }) => a.enlaces));
  return {
    fichas: [
      ...elegidas.flatMap(({ a, porQue }, i) =>
        // Si el texto oficial dice que la piden entidades, no es para la persona.
        paraEntidades(lineas[i])
          ? []
          : [
              fichaDeBdns(
                { ...a, enlaces: vivos[i] },
                { comunidad: r.ubicacion.comunidad, porQue, requisitos: lineas[i] },
              ),
            ],
      ),
      ...rentaSiEncaja(perfil, lectura, r, busqueda?.citasPorTema.servicios_sociales ?? []),
    ],
    // Solo las que tratan de lo que contó la persona, como las automáticas.
    recurrentes: (r.recurrentes ?? [])
      .filter(encajaPorTitulo)
      .slice(0, MAX_RECURRENTES)
      .map((x) =>
        fichaDeRecurrente(x, {
          comunidad: r.ubicacion.comunidad,
          porQue: comoPorQue([...new Set(temasEnTitulo(x).flatMap((t) => busqueda?.citasPorTema[t] ?? []))]),
        }),
      ),
    motivo: null,
    pregunta: null,
  };
}
