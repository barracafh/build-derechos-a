import { ejecutarHerramienta, HERRAMIENTAS } from "@/lib/ayudas/herramientas";

// GET  → definiciones de las herramientas (formato `tools` de OpenAI).
// POST {"nombre": "buscar_ayudas", "argumentos": {...}} → resultado de ejecutarla.
// Para probar a mano y para depurar el agente; el chat las ejecuta en el servidor
// llamando directamente a ejecutarHerramienta. No se guarda nada de lo enviado.
export function GET() {
  return Response.json({ herramientas: HERRAMIENTAS });
}

export async function POST(req: Request) {
  const { nombre, argumentos } = await req.json().catch(() => ({}));
  if (typeof nombre !== "string")
    return Response.json({ error: "Falta «nombre»." }, { status: 400 });
  return Response.json(await ejecutarHerramienta(nombre, argumentos ?? {}));
}
