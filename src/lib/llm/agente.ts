// El LLM con herramientas: lee la conversación, llama a buscar_ayudas y
// ver_requisitos (lib/ayudas) y termina con el mismo JSON que perfil.ts. Lo que
// devuelven las herramientas se guarda en `hallazgos` para montar las fichas con
// datos oficiales, no con lo que escriba el modelo.
import type { AyudaEncontrada, ResultadoBuscar } from "@/lib/ayudas/buscar";
import { ejecutarHerramienta, HERRAMIENTAS } from "@/lib/ayudas/herramientas";
import type { Requisitos } from "@/lib/ayudas/requisitos";
import type { MensajeAgente, RespuestaAgente } from "@/lib/ia";
import type { MensajeChat } from "@/lib/tipos";
import { construirMensajes } from "./perfil";

export type Agente = (
  messages: MensajeAgente[],
  tools: readonly object[],
) => Promise<RespuestaAgente>;

export type Ejecutar = (nombre: string, argumentos: unknown) => Promise<unknown>;

export type Hallazgos = {
  busqueda: ResultadoBuscar | null;
  // Error de ubicación de la última búsqueda (municipio ambiguo o desconocido).
  errorUbicacion: { error: string; opciones?: string[] } | null;
  ayudas: Map<string, AyudaEncontrada>;
  requisitos: Map<string, string[]>;
};

export const nuevosHallazgos = (): Hallazgos => ({
  busqueda: null,
  errorUbicacion: null,
  ayudas: new Map(),
  requisitos: new Map(),
});

const RONDAS = 4;
const LLAMADAS_POR_RONDA = 3;
const MAX_FRAGMENTO = 1500;

// Líneas literales del apartado de beneficiarios o requisitos, para la ficha.
export function lineasDeRequisitos(r: Requisitos): string[] {
  if ("error" in r) return [];
  const parte = r.fragmentos.find((f) =>
    /beneficiari|requisit|destinatari|solicitantes/i.test(f.apartado),
  );
  return (parte?.texto ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3)
    .slice(0, 8);
}

// Lo justo para decidir: el modelo no necesita el detalle de los descartes.
function paraElModelo(nombre: string, r: unknown): unknown {
  if (!r || typeof r !== "object" || "error" in r) return r;
  if (nombre === "buscar_ayudas") {
    const b = r as ResultadoBuscar;
    return {
      ubicacion: b.ubicacion,
      ayudas: b.ayudas.map((a) => ({
        id: a.id,
        titulo: a.titulo,
        organismo: a.organismo,
        nivel: a.nivel,
        estado: a.estado,
        plazo: a.plazo,
        encaja_con: a.encaja_con,
        palabras_en_titulo: a.palabras_en_titulo,
        aviso: a.aviso,
      })),
      quedan_por_revisar: b.resumen.quedan_por_revisar,
      // Aún no se pueden pedir: el código las enseña aparte, no van en "elegidos".
      recurrentes: (b.recurrentes ?? []).map((x) => ({ titulo: x.titulo, texto: x.texto })),
    };
  }
  if (nombre === "ver_requisitos") {
    const lista = (r as { ayudas: Requisitos[] }).ayudas;
    return {
      ayudas: lista.map((q) =>
        "error" in q
          ? q
          : {
              id: q.id,
              titulo: q.titulo,
              fragmentos: q.fragmentos.map((f) => ({ ...f, texto: f.texto.slice(0, MAX_FRAGMENTO) })),
              aviso: q.aviso,
            },
      ),
    };
  }
  return r;
}

function guardar(h: Hallazgos, nombre: string, r: unknown) {
  if (!r || typeof r !== "object") return;
  if (nombre === "buscar_ayudas") {
    if ("error" in r) {
      h.errorUbicacion = r as Hallazgos["errorUbicacion"];
      return;
    }
    const b = r as ResultadoBuscar;
    h.busqueda = b;
    h.errorUbicacion = null;
    for (const a of b.ayudas) h.ayudas.set(a.id, a);
  } else if (nombre === "ver_requisitos" && "ayudas" in r) {
    for (const q of (r as { ayudas: Requisitos[] }).ayudas) {
      const lineas = lineasDeRequisitos(q);
      if (!("error" in q) && lineas.length) h.requisitos.set(q.id, lineas);
    }
  }
}

// Devuelve el texto final del modelo (null si se quedó sin rondas). Los
// hallazgos se escriben en el objeto que se pasa, para no perderlos si quien
// llama corta por tiempo.
export async function conversarConHerramientas(
  mensajes: MensajeChat[],
  agente: Agente,
  hallazgos: Hallazgos,
  ejecutar: Ejecutar = ejecutarHerramienta,
  anteriores: string[] = [],
): Promise<string | null> {
  const historia: MensajeAgente[] = construirMensajes(mensajes, { herramientas: true, anteriores });
  for (let ronda = 1; ronda <= RONDAS; ronda++) {
    const r = await agente(historia, HERRAMIENTAS);
    if (!r.tool_calls.length) return r.content;
    historia.push({ role: "assistant", content: r.content, tool_calls: r.tool_calls });
    const resultados = await Promise.all(
      r.tool_calls.map(async (t, i) => {
        if (i >= LLAMADAS_POR_RONDA || ronda === RONDAS)
          return { error: "No quedan llamadas: responde ya con el JSON." };
        let args: unknown = t.function.arguments;
        if (t.function.name === "buscar_ayudas") {
          // El catálogo ya va en el sistema: de la búsqueda solo interesa la BDNS.
          try {
            args = { ...JSON.parse(t.function.arguments || "{}"), catalogo: false };
          } catch {
            // ejecutarHerramienta devuelve el error de JSON.
          }
        }
        const res = await ejecutar(t.function.name, args);
        guardar(hallazgos, t.function.name, res);
        return paraElModelo(t.function.name, res);
      }),
    );
    r.tool_calls.forEach((t, i) =>
      historia.push({ role: "tool", tool_call_id: t.id, content: JSON.stringify(resultados[i]) }),
    );
  }
  return null;
}
