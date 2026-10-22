import type { CampoPerfil, Ficha, Perfil } from "@/lib/tipos";

// La pregunta la elige el código, no el modelo: es el dato que falta y que más
// ayudas ayudaría a confirmar o descartar (spec 003, FR-005).

export const TEXTO_PREGUNTA: Record<CampoPerfil, string> = {
  edad: "¿Cuántos años tienes?",
  municipio: "¿En qué municipio vives?",
  situacionLaboral: "¿Trabajas ahora o estás en paro?",
  vivienda: "¿Vives de alquiler, en una casa tuya o de otra forma?",
  hijos: "¿Tienes hijos? ¿Cuántos?",
  ingresos: "¿Cuánto dinero entra en tu casa cada mes, más o menos?",
  pension: "¿Cobras alguna pensión?",
  discapacidad: "¿Tienes alguna discapacidad?",
};

export function elegirPregunta(fichas: Ficha[], perfil: Perfil): string | null {
  const conocidos = new Set(perfil.hechos.map((h) => h.campo));
  const cuenta = new Map<CampoPerfil, number>();
  for (const f of fichas)
    for (const c of f.pendiente)
      if (!conocidos.has(c)) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  let mejor: CampoPerfil | null = null;
  for (const [campo, n] of cuenta)
    if (mejor === null || n > (cuenta.get(mejor) ?? 0)) mejor = campo;
  return mejor ? TEXTO_PREGUNTA[mejor] : null;
}
