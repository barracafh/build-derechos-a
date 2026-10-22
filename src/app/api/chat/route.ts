import { buscarAyudas } from "@/lib/ayudas/buscar";
import { comprobarEnlaces } from "@/lib/ayudas/enlaces";
import { requisitosDelExtracto } from "@/lib/ayudas/requisitos";
import { completar, completarConHerramientas } from "@/lib/ia";
import { responder } from "@/lib/llm";
import type { EventoChat, MensajeChat } from "@/lib/tipos";

// POST {"mensajes": MensajeChat[], "perfil"?: Perfil, "ayudas"?: string[]} → NDJSON de EventoChat que acaba en la Respuesta (spec 003).
// No se guarda ni se registra lo que escribe la persona.

// El LLM con herramientas (60 s como mucho) o, si falla rápido, sin ellas, y
// después la BDNS: el reparto está en lib/llm/index.ts.
export const maxDuration = 120;

const error400 = (m: string) => Response.json({ error: m }, { status: 400 });

function validos(m: unknown): m is MensajeChat[] {
  return (
    Array.isArray(m) &&
    m.length >= 1 &&
    m.length <= 60 &&
    m.every(
      (x) =>
        x &&
        (x.rol === "usuario" || x.rol === "asistente") &&
        typeof x.texto === "string" &&
        x.texto.trim().length > 0 &&
        x.texto.length <= 2000,
    )
  );
}

export async function POST(req: Request) {
  const cuerpo = await req.json().catch(() => null);
  if (!validos(cuerpo?.mensajes))
    return error400(
      "Envía entre 1 y 60 mensajes de hasta 2.000 caracteres cada uno.",
    );
  // Solo rol y texto. `perfil` y `ayudas` (las del turno anterior) se validan en responder.
  const mensajes: MensajeChat[] = cuerpo.mensajes.map((m: MensajeChat) => ({
    rol: m.rol,
    texto: m.texto,
  }));
  if (!mensajes.some((m) => m.rol === "usuario"))
    return error400("Falta un mensaje de la persona.");

  // Una línea JSON por evento: las fases según avanzan y, al final, la respuesta.
  const cuerpoStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enviar = (e: EventoChat) =>
        controller.enqueue(new TextEncoder().encode(`${JSON.stringify(e)}\n`));
      // Sin razonar: con razonamiento, cada llamada tarda 25-30 s y el agente no
      // cabe en su tiempo.
      const respuesta = await responder(mensajes, {
        completar: (m) => completar(m, { razonar: false }),
        hoy: new Date(),
        agente: (m, tools) => completarConHerramientas(m, tools, { razonar: false }),
        buscar: buscarAyudas,
        requisitos: requisitosDelExtracto,
        comprobar: comprobarEnlaces,
        anterior: cuerpo.perfil,
        ayudasAnteriores: cuerpo.ayudas,
        alAvanzar: (paso) => enviar({ paso }),
      });
      enviar({ respuesta });
      controller.close();
    },
  });
  return new Response(cuerpoStream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
