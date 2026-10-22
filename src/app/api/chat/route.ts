import { buscarAyudas } from "@/lib/motor";
import { elegirPregunta } from "@/lib/llm/pregunta";
import { hablaDeDana, perfilDeTexto } from "@/lib/llm/respaldo";
import type { MensajeChat, Perfil, Respuesta } from "@/lib/tipos";

// POST {"mensajes": MensajeChat[]} → Respuesta (spec 003).
// No se guarda ni se registra lo que escribe la persona.
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
  const mensajes: MensajeChat[] = cuerpo.mensajes;
  const delUsuario = mensajes.filter((m) => m.rol === "usuario");
  if (delUsuario.length === 0) return error400("Falta un mensaje de la persona.");
  const texto = delUsuario.map((m) => m.texto).join("\n");

  const perfil: Perfil = perfilDeTexto(texto);
  const fecha = new Date().toISOString().slice(0, 10);

  // Las ayudas de la DANA no están en el catálogo: se remite a la sede.
  if (hablaDeDana(texto)) {
    const r: Respuesta = {
      perfil,
      fichas: [],
      cobertura: {
        consultado: [],
        noConsultado: [
          "Ayudas por la DANA de 2024: míralas en https://sede.gva.es",
        ],
        respaldo: true,
        fechaConsulta: fecha,
      },
      pregunta: null,
    };
    return Response.json(r, { headers: { "cache-control": "no-store" } });
  }

  const { fichas, cobertura } = await buscarAyudas(perfil);
  const r: Respuesta = {
    perfil,
    fichas,
    cobertura,
    pregunta: elegirPregunta(fichas, perfil),
  };
  return Response.json(r, { headers: { "cache-control": "no-store" } });
}
