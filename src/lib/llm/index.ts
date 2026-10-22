import type { ArgsBuscar, AyudaEncontrada, ResultadoBuscar } from "@/lib/ayudas/buscar";
import type { ErrorUbicacion } from "@/lib/ayudas/territorio";
import type { Mensaje } from "@/lib/ia";
import { elegirPregunta, PREGUNTA_INICIAL, TEXTO_PREGUNTA } from "@/lib/llm/pregunta";
import { hablaDeDana, perfilDeTexto } from "@/lib/llm/respaldo";
import {
  bloqueada,
  crearFicha,
  fichasDelCatalogo,
  IDS_AYUDAS,
  noCubiertoPor,
  porEstado,
} from "@/lib/motor/catalogo";
import type { Cobertura, Ficha, MensajeChat, Paso, Perfil, Respuesta } from "@/lib/tipos";
import {
  conversarConHerramientas,
  nuevosHallazgos,
  type Agente,
  type Ejecutar,
  type Hallazgos,
} from "./agente";
import { busquedaDelPerfil, coberturaConBdns, fichaDeBdns, temasEnTitulo } from "./bdns";
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
  requisitos?: (numero: string) => Promise<string[]>;
  msAgente?: number;
  // Lo que manda el navegador del turno anterior: se valida antes de usarlo.
  anterior?: unknown;
  ayudasAnteriores?: unknown;
  alAvanzar?: (paso: Paso) => void;
};

// Presupuesto con agente, dentro de los 60 s de la ruta: el LLM (agente y, si
// falla rápido, el bucle sin herramientas) y después la BDNS y sus requisitos.
const MS_LLM_CON_AGENTE = 38_000;
const MS_BUSQUEDA = 14_000;
const MS_REQUISITOS = 4_000;
// Convocatorias que se proponen solas si el LLM no elige ninguna, y cuántas
// puede elegir él.
const AUTOMATICAS = 4;
const MAX_ELEGIDAS = 5;

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
    msAgente = 30_000,
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
    };

  // En los registros, solo el error de HelmCode, nunca el texto de la persona.
  // Solo ids con forma de ayuda: van al prompt.
  const anteriores = (Array.isArray(ayudasAnteriores) ? ayudasAnteriores : [])
    .filter(
      (id): id is string =>
        typeof id === "string" && (IDS_AYUDAS.includes(id) || /^bdns:[\w-]{1,40}$/.test(id)),
    )
    .slice(0, 15);
  let lectura: Lectura | null = null;
  const hallazgos = nuevosHallazgos();
  let sinTiempo = false;
  if (agente) {
    alAvanzar("leyendo");
    try {
      const texto = await conLimite(
        conversarConHerramientas(mensajes, agente, hallazgos, ejecutar, anteriores),
        msAgente,
      );
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
    fichas = porEstado(
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

  const base: Cobertura = {
    consultado: [
      "Catálogo de trámites y ayudas (Estado, Generalitat y Ajuntament de València), a 18/10/2026",
    ],
    noConsultado: [...noConsultado, ...noCubiertoPor(perfil)],
    respaldo: true,
    fechaConsulta,
  };
  if (!buscar)
    return { perfil, fichas, cobertura: base, pregunta: elegirPregunta(fichas, perfil, mensajes) };

  alAvanzar("buscando");
  const bdns = await conBdns(perfil, lectura, hallazgos, buscar, requisitos);
  // La pregunta de la BDNS (dónde vives) va primero, salvo que ya se hiciera o
  // que aún no se sepa nada de la persona.
  const guiada = elegirPregunta(fichas, perfil, mensajes);
  const hecha = (p: string) => mensajes.some((m) => m.rol === "asistente" && m.texto === p);
  return {
    perfil,
    fichas: porEstado([...fichas, ...bdns.fichas]),
    cobertura: coberturaConBdns(base, hallazgos.busqueda, bdns.motivo),
    pregunta:
      bdns.pregunta && guiada !== PREGUNTA_INICIAL && !hecha(bdns.pregunta) ? bdns.pregunta : guiada,
  };
}

const PROPONIBLE = new Set<AyudaEncontrada["estado"]>(["abierta", "sin_plazo_fijo", "proximamente"]);

// Convocatorias de la BDNS para el municipio: las que eligió el LLM entre las
// que devolvió buscar_ayudas o, si no eligió ninguna, las primeras que tratan de
// lo que contó la persona y tienen el plazo comprobado.
async function conBdns(
  perfil: Perfil,
  lectura: Lectura | null,
  hallazgos: Hallazgos,
  buscar: NonNullable<Dependencias["buscar"]>,
  requisitos: Dependencias["requisitos"],
): Promise<{ fichas: Ficha[]; motivo: string | null; pregunta: string | null }> {
  const busqueda = busquedaDelPerfil(perfil);
  if (!hallazgos.busqueda && !hallazgos.errorUbicacion && busqueda) {
    try {
      const r = await conLimite(buscar(busqueda.args), MS_BUSQUEDA);
      if ("error" in r) hallazgos.errorUbicacion = r;
      else hallazgos.busqueda = r;
    } catch (error) {
      console.error("BDNS:", (error as Error).message);
      return { fichas: [], motivo: "no ha respondido a tiempo", pregunta: null };
    }
  }

  const r = hallazgos.busqueda;
  if (!r) {
    const opciones = hallazgos.errorUbicacion?.opciones?.slice(0, 4);
    if (opciones?.length)
      return {
        fichas: [],
        motivo: "hay varios municipios con ese nombre",
        pregunta: `¿En cuál vives: ${opciones.slice(0, -1).join(", ")} o ${opciones.at(-1)}?`,
      };
    if (hallazgos.errorUbicacion)
      return {
        fichas: [],
        motivo: "no reconozco el municipio",
        pregunta: "¿En qué municipio y provincia vives?",
      };
    return { fichas: [], motivo: "falta saber tu municipio", pregunta: TEXTO_PREGUNTA.municipio };
  }

  const ayudas = new Map(r.ayudas.map((a) => [a.id, a]));
  const comoPorQue = (citas: string[]) => citas.map((c) => `Dices: «${c}».`);
  let elegidas = (lectura?.elegidos ?? [])
    .filter((e) => e.id.startsWith("bdns:"))
    .map((e) => ({ a: ayudas.get(e.id), porQue: comoPorQue(e.citas) }))
    .filter(({ a }) => a && a.estado !== "cerrada" && a.estado !== "no_solicitable")
    .slice(0, MAX_ELEGIDAS) as { a: AyudaEncontrada; porQue: string[] }[];
  if (!elegidas.length)
    elegidas = r.ayudas
      .filter((a) => a.id.startsWith("bdns:") && PROPONIBLE.has(a.estado))
      .map((a) => ({ a, temas: temasEnTitulo(a) }))
      .filter(({ temas }) => temas.length)
      .slice(0, AUTOMATICAS)
      .map(({ a, temas }) => ({
        a,
        porQue: comoPorQue([...new Set(temas.flatMap((t) => busqueda?.citasPorTema[t] ?? []))]),
      }));

  // Requisitos: los que leyó el agente o, si no, el extracto del boletín (sin PDF).
  const lineas = await conLimite(
    Promise.all(
      elegidas.map(async ({ a }) => {
        const leidas = hallazgos.requisitos.get(a.id);
        if (leidas) return leidas;
        return requisitos ? requisitos(a.id.slice("bdns:".length)).catch(() => []) : [];
      }),
    ),
    MS_REQUISITOS,
  ).catch(() => elegidas.map(({ a }) => hallazgos.requisitos.get(a.id) ?? []));

  return {
    fichas: elegidas.map(({ a, porQue }, i) =>
      fichaDeBdns(a, { comunidad: r.ubicacion.comunidad, porQue, requisitos: lineas[i] }),
    ),
    motivo: null,
    pregunta: null,
  };
}
