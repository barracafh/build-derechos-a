import { completar } from "@/lib/ia";
import { responder } from "@/lib/llm";
import type { MensajeChat } from "@/lib/tipos";

// POST {"mensajes": MensajeChat[]} → Respuesta (spec 003).
// No se guarda ni se registra lo que escribe la persona.

// Dos intentos al LLM de 20 s como mucho, más el margen de los reintentos por 429.
export const maxDuration = 60;

const error400 = (m: string) => Response.json({ error: m }, { status: 400 });

function validos(m: unknown): m is MensajeChat[] {
  return (
    Array.isArray(m) &&
    m.length >= 1 &&
    m.length <= 20 &&
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
      "Envía entre 1 y 20 mensajes de hasta 2.000 caracteres cada uno.",
    );
  // Solo rol y texto: cualquier otro campo del cuerpo se ignora.
  const mensajes: MensajeChat[] = cuerpo.mensajes.map((m: MensajeChat) => ({
    rol: m.rol,
    texto: m.texto,
  }));
  if (!mensajes.some((m) => m.rol === "usuario"))
    return error400("Falta un mensaje de la persona.");

  const r = await responder(mensajes, { completar, hoy: new Date() });
  return Response.json(r, { headers: { "cache-control": "no-store" } });
}
