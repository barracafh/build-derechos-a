import { buscarAyudas } from "@/lib/buscar";

// POST {"texto": "…"} devuelve las ayudas del catálogo que podrían encajar.
// No se guarda ni se registra lo que escribe la persona.
export async function POST(req: Request) {
  const { texto } = await req.json().catch(() => ({}));
  if (typeof texto !== "string" || !texto.trim() || texto.length > 2000)
    return Response.json(
      { error: "Cuéntanos tu situación en un texto de hasta 2.000 caracteres." },
      { status: 400 },
    );
  return Response.json(buscarAyudas(texto), {
    headers: { "cache-control": "no-store" },
  });
}
