// Antes de enseñar un enlace, comprobar que existe. Solo se quita si está roto
// sin duda (404, 410 o el dominio no existe): muchas sedes bloquean a los robots
// (403) o tardan, y eso no significa que la página no esté.
import type { Enlaces } from "./convocatoria";

const ESPERA_MS = 3000;
const CACHE_MS = 60 * 60_000;
const cache = new Map<string, { vivo: boolean; hasta: number }>();

// La BDNS siempre tiene su ficha y sus documentos; así no se gasta su límite.
const SIN_COMPROBAR = /(^|\.)infosubvenciones\.es$/;

async function pedir(url: string, method: "HEAD" | "GET"): Promise<number> {
  const res = await fetch(url, {
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(ESPERA_MS),
    headers: { "user-agent": "Mozilla/5.0 (compatible; buscador-ayudas/1.0)" },
  });
  await res.body?.cancel();
  return res.status;
}

export async function enlaceVivo(url: string): Promise<boolean> {
  if (SIN_COMPROBAR.test(new URL(url).hostname)) return true;
  const guardado = cache.get(url);
  if (guardado && guardado.hasta > Date.now()) return guardado.vivo;
  let vivo = true;
  try {
    let estado = await pedir(url, "HEAD");
    // Hay servidores que no aceptan HEAD: se confirma con GET.
    if (estado === 404 || estado === 405 || estado === 501) estado = await pedir(url, "GET");
    vivo = estado !== 404 && estado !== 410;
  } catch (error) {
    // Node lo pone en `cause.code`; Bun, en `code`.
    const e = error as { code?: string; cause?: { code?: string } };
    vivo = (e.cause?.code ?? e.code) !== "ENOTFOUND";
  }
  cache.set(url, { vivo, hasta: Date.now() + CACHE_MS });
  return vivo;
}

// Los mismos enlaces sin los rotos. La ficha de la BDNS se queda siempre.
export async function comprobarEnlaces(e: Enlaces): Promise<Enlaces> {
  const claves = ["solicitud", "sede", "convocatoria", "bases", "pdf"] as const;
  const vivos = await Promise.all(claves.map((k) => (e[k] ? enlaceVivo(e[k]!) : false)));
  const r = { ...e };
  claves.forEach((k, i) => {
    if (!vivos[i]) r[k] = null;
  });
  return r;
}
