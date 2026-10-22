import { zonaPorTerritorio } from "@/lib/ayudas/territorio";

// Lugares que la herramienta reconoce en el texto. Solo sirven para saber si
// la persona vive en la Comunitat Valenciana o fuera de ella. Si no está en las
// listas, se busca entre los municipios y provincias de España.

export const LUGARES_CV = [
  "valencia",
  "castello",
  "castellon",
  "alicante",
  "alacant",
  "safor",
  "gandia",
  "torrent",
  "paterna",
  "sagunto",
  "elche",
  "elx",
  "benidorm",
  "alzira",
  "xativa",
  "orihuela",
];

export const LUGARES_FUERA = [
  "madrid",
  "barcelona",
  "sevilla",
  "malaga",
  "bilbao",
  "zaragoza",
  "murcia",
  "galicia",
  "andalucia",
  "cataluna",
  "mallorca",
  "canarias",
];

/** Quita tildes y pasa a minúsculas, letra por letra, para no mover posiciones. */
export function normalizarLetra(c: string): string {
  if (/\s/.test(c)) return " ";
  const n = c
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return n.length === 1 ? n : (n[0] ?? " ");
}

export const normalizar = (t: string) =>
  Array.from({ length: t.length }, (_, i) => normalizarLetra(t[i])).join("");

export type Zona = "cv" | "fuera" | null;

export function zonaDe(lugar: string): Zona {
  const l = normalizar(lugar);
  if (LUGARES_CV.some((x) => l.includes(x))) return "cv";
  if (LUGARES_FUERA.some((x) => l.includes(x))) return "fuera";
  return zonaPorTerritorio(lugar);
}
