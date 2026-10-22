import type { CampoPerfil, Ficha, MensajeChat, Perfil } from "@/lib/tipos";

// La pregunta la elige el código, no el modelo (spec 003, FR-005). Va guiando a
// la persona, un dato cada vez, hasta tener el perfil que filtra las ayudas.

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

// Cuando no se ha entendido nada todavía.
export const PREGUNTA_INICIAL =
  "Cuéntame un poco de ti: ¿qué necesitas? Por ejemplo, pagar el alquiler, la luz o los libros del colegio.";

// Los datos que deciden las ayudas del catálogo, en el orden en que se piden
// cuando ninguna ficha pide uno en concreto.
const BASICOS: CampoPerfil[] = [
  "municipio",
  "edad",
  "situacionLaboral",
  "hijos",
  "vivienda",
  "ingresos",
];

// 1. Lo que piden más fichas. 2. Los datos básicos que faltan. Nunca se repite
// una pregunta ya hecha: si la persona no la contestó, se pasa a la siguiente.
export function elegirPregunta(
  fichas: Ficha[],
  perfil: Perfil,
  mensajes: MensajeChat[],
): string | null {
  const hechas = new Set(mensajes.filter((m) => m.rol === "asistente").map((m) => m.texto));
  const nada = perfil.hechos.length === 0 && !perfil.necesidad && fichas.length === 0;
  if (nada && !hechas.has(PREGUNTA_INICIAL)) return PREGUNTA_INICIAL;

  const conocidos = new Set(perfil.hechos.map((h) => h.campo));
  const libre = (c: CampoPerfil) => !conocidos.has(c) && !hechas.has(TEXTO_PREGUNTA[c]);
  const cuenta = new Map<CampoPerfil, number>();
  for (const f of fichas)
    for (const c of f.pendiente) if (libre(c)) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  let mejor: CampoPerfil | null = null;
  for (const [campo, n] of cuenta)
    if (mejor === null || n > (cuenta.get(mejor) ?? 0)) mejor = campo;
  mejor ??= BASICOS.find(libre) ?? null;
  return mejor ? TEXTO_PREGUNTA[mejor] : null;
}
