// Duplicate detection for the S4 indexing job (FR-008, FR-009).

import { type Codigos, canonica, codigos } from "./url";

// An aid in the store: the catalogue item keys plus the S4 extras.
export type Ayuda = {
  id: string;
  titulo: string;
  organismo: string | null;
  enlace_info: string;
  enlace_tramite: string | null;
  // URLs joined with " ; ", as in the catalogue.
  fuente: string;
  codigos: Codigos;
  textos?: string[];
  posibleDuplicado?: string;
} & Record<string, unknown>;

export type Decision = { tipo: "catalogo" } | { tipo: "fusionar"; id: string } | { tipo: "insertar"; posibleDuplicado?: string };

type ItemCatalogo = { enlace_info: string | null; enlace_tramite: string | null; fuente: string | null };

export const UMBRAL_SIMILITUD = 0.8;

const separar = (fuente: string | null) => (fuente ?? "").split(";").map((u) => u.trim()).filter(Boolean);

function canonicaSegura(url: string): string | null {
  try {
    return canonica(url);
  } catch {
    return null;
  }
}

// Every catalogue URL, canonical: an aid found there is already covered.
export function urlsDeCatalogo(catalogo: { items: ItemCatalogo[] }): Set<string> {
  const urls = catalogo.items.flatMap((i) => [i.enlace_info, i.enlace_tramite, ...separar(i.fuente)]);
  return new Set(urls.flatMap((u) => (u ? [canonicaSegura(u)] : [])).filter((u): u is string => u !== null));
}

// Only codes that name one procedure merge: the SIA code and the id_proc of the aid's own URL.
// BOE ids are shared laws, BDNS numbers are calls, and id_proc links in a page's menu are other procedures.
function claves(a: Ayuda): string[] {
  return [...a.codigos.sia.map((c) => `sia:${c}`), ...codigos("", a.enlace_info).idProc.map((c) => `id_proc:${c}`)];
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function trigramas(texto: string): Set<string> {
  const t = ` ${normalizar(texto)} `;
  const salida = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) salida.add(t.slice(i, i + 3));
  return salida;
}

// Trigram Jaccard similarity of two texts, from 0 to 1.
export function similitud(a: string, b: string): number {
  const ta = trigramas(a);
  const tb = trigramas(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let comunes = 0;
  for (const t of ta) if (tb.has(t)) comunes++;
  return comunes / (ta.size + tb.size - comunes);
}

const nombre = (a: Ayuda) => `${a.titulo} ${a.organismo ?? ""}`;

// What to do with a newly extracted aid. `alias` maps known canonical URLs to aid ids (rastreo).
export function decidir(nueva: Ayuda, existentes: Ayuda[], urlsCatalogo: Set<string>, alias = new Map<string, string>()): Decision {
  const url = canonica(nueva.enlace_info);
  if (urlsCatalogo.has(url)) return { tipo: "catalogo" };

  const porAlias = alias.get(url);
  if (porAlias) return { tipo: "fusionar", id: porAlias };

  const porUrl = existentes.find((e) => canonica(e.enlace_info) === url);
  if (porUrl) return { tipo: "fusionar", id: porUrl.id };

  const mias = new Set(claves(nueva));
  const porCodigo = existentes.find((e) => claves(e).some((c) => mias.has(c)));
  if (porCodigo) return { tipo: "fusionar", id: porCodigo.id };

  let parecida: { id: string; valor: number } | undefined;
  for (const e of existentes) {
    const valor = similitud(nombre(nueva), nombre(e));
    if (valor >= UMBRAL_SIMILITUD && (!parecida || valor > parecida.valor)) parecida = { id: e.id, valor };
  }
  return parecida ? { tipo: "insertar", posibleDuplicado: parecida.id } : { tipo: "insertar" };
}

const unir = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])];

// The newer read wins for content; id, first official link, codes, sources and texts are kept and joined.
export function fusionar(existente: Ayuda, nueva: Ayuda): Ayuda {
  return {
    ...existente,
    ...nueva,
    id: existente.id,
    enlace_info: existente.enlace_info,
    fuente: unir(separar(existente.fuente), separar(nueva.fuente)).join(" ; "),
    codigos: {
      sia: unir(existente.codigos.sia, nueva.codigos.sia),
      idProc: unir(existente.codigos.idProc, nueva.codigos.idProc),
      bdns: unir(existente.codigos.bdns, nueva.codigos.bdns),
      boe: unir(existente.codigos.boe, nueva.codigos.boe),
    },
    ...(existente.textos || nueva.textos ? { textos: unir(existente.textos, nueva.textos) } : {}),
  };
}
