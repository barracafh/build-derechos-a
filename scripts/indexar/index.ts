// The S4 indexing job: seeds → aid pages → one LLM call per changed page → src/datos/central.json.
// Run: bun run indexar [--backfill] [--dry-run] [--limit N]

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import catalogoPack from "../../datos/catalogo-tramites-ayudas.json";
import type { Mensaje } from "../../src/lib/ia";
import { type Semilla, semillas as semillasDelRepo } from "../../src/datos/semillas";
import { type Ayuda, decidir, fusionar, similitud, urlsDeCatalogo } from "./dedup";
import { type Referencia, componerEntrada, extraer } from "./extraer";
import { type Enlace, guardarTexto, hashTexto, leerHtml, textoDePdf } from "./texto";
import { canonica, codigos } from "./url";

const RAIZ = join(import.meta.dir, "..", "..");
export const MAX_LLAMADAS = 30;
export const MAX_PROFUNDIDAD = 2;
const MAX_PDFS = 3;
const TIMEOUT_MS = 10_000;

const OFICIALES = ["gob.es", "gva.es", "valencia.es", "boe.es", "seg-social.es", "sepe.es", "imserso.es"];
const esDe = (host: string, dominio: string) => host === dominio || host.endsWith(`.${dominio}`);
export const esOficial = (host: string) => OFICIALES.some((d) => esDe(host, d));

type ItemCatalogo = { id: string; titulo: string; enlace_info: string | null; enlace_tramite: string | null; fuente: string | null };

export type Rastreo = {
  id?: string;
  hash?: string;
  etag?: string;
  modificado?: string;
  consultado: string;
  // Pages read but not stored: covered by the catalogue or BDNS, or not an aid.
  cubiertaPor?: "bdns" | "catalogo";
  noEsAyuda?: true;
};

export type Pendiente = { url: string; profundidad: number; administracion: Ayuda["administracion"] };

export type Almacen = {
  version: string;
  ambito: string;
  aviso: string;
  items: Ayuda[];
  rastreo: Record<string, Rastreo>;
  pendientes: Pendiente[];
};

export type Opciones = { backfill?: boolean; dryRun?: boolean; limite?: number; maxLlamadas?: number };

export type Entorno = {
  semillas: Semilla[];
  catalogo: { items: ItemCatalogo[] };
  completar?: (m: Mensaje[]) => Promise<string>;
  archivoAlmacen: string;
  carpetaTextos: string;
  ahora: Date;
  // Milliseconds between two requests to the same host.
  pausaMs: number;
  oficial: (host: string) => boolean;
  registrar: (linea: string) => void;
};

export type Resumen = { llamadas: number; escrito: boolean; registro: string[] };

const ALMACEN_VACIO = (): Almacen => ({
  version: "",
  ambito: "Ayudas sin API (prestaciones, bonos, deducciones y ayudas sociales) para residentes en València",
  aviso: "Extraído de páginas oficiales por un proceso automático. No verificado por una persona: revisa siempre la página oficial.",
  items: [],
  rastreo: {},
  pendientes: [],
});

function leerAlmacen(archivo: string): Almacen {
  if (!existsSync(archivo)) return ALMACEN_VACIO();
  return { ...ALMACEN_VACIO(), ...JSON.parse(readFileSync(archivo, "utf8")) };
}

// Stable JSON: items by id, rastreo by URL, so that a run without changes leaves the file as it was.
function serializar(a: Almacen): string {
  const rastreo = Object.fromEntries(Object.entries(a.rastreo).sort(([x], [y]) => x.localeCompare(y)));
  const items = [...a.items].sort((x, y) => x.id.localeCompare(y.id));
  const pendientes = [...a.pendientes].sort((x, y) => x.url.localeCompare(y.url));
  return `${JSON.stringify({ ...a, items, rastreo, pendientes }, null, 2)}\n`;
}

const slug = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/, "");

function administracionDe(url: string): Ayuda["administracion"] {
  const host = new URL(url).hostname;
  if (esDe(host, "gva.es")) return "Comunitat Valenciana";
  if (esDe(host, "valencia.es")) return "Local";
  return "Estado";
}

// Polite fetch: one request per second per host, a timeout, and conditional headers.
function crearDescarga(pausaMs: number) {
  const ultima = new Map<string, number>();
  return async (url: string, cabeceras: Record<string, string> = {}) => {
    const host = new URL(url).host;
    const espera = (ultima.get(host) ?? 0) + pausaMs - Date.now();
    if (espera > 0) await Bun.sleep(espera);
    ultima.set(host, Date.now());
    return fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; derechos-indexar)", "accept-language": "es-ES,es;q=0.9", ...cabeceras },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
  };
}

// Every link of a seed page, absolute, with its text (seeds list results outside <main> too).
function enlacesDeSemilla(html: string, base: string): Enlace[] {
  const enlaces: Enlace[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(m[1].replaceAll("&amp;", "&"), base).href;
      enlaces.push({ url, texto: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
    } catch {}
  }
  return enlaces;
}

const paginasDe = (s: Semilla) => {
  if (!s.paginacion) return [s.url];
  return Array.from({ length: s.paginacion.max }, (_, i) => {
    const u = new URL(s.url);
    u.searchParams.set(s.paginacion!.parametro, String(i + 1));
    return u.href;
  });
};

type EnCola = Pendiente & { semilla?: string };
type Relacion = { desde: string; tipo: Referencia["tipo"]; cita: string } & ({ url: string } | { id: string });

export async function ejecutar(opciones: Opciones, entorno: Entorno): Promise<Resumen> {
  const { semillas, catalogo, archivoAlmacen, carpetaTextos, ahora, oficial } = entorno;
  const registro: string[] = [];
  const log = (linea: string) => {
    registro.push(linea);
    entorno.registrar(linea);
  };
  const hoy = ahora.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const descargar = crearDescarga(entorno.pausaMs);
  const maxLlamadas = opciones.backfill ? Number.POSITIVE_INFINITY : (opciones.maxLlamadas ?? MAX_LLAMADAS);

  const anterior = leerAlmacen(archivoAlmacen);
  const almacen: Almacen = structuredClone(anterior);
  const items = new Map(almacen.items.map((a) => [a.id, a]));
  const urlsCatalogo = urlsDeCatalogo(catalogo);
  const textosNuevos = new Map<string, string>();

  // 1. Seeds → aid links.
  const cola: EnCola[] = [];
  const enCola = new Set<string>();
  const textosDeSemilla: Enlace[] = [];
  const encolar = (e: EnCola) => {
    if (enCola.has(e.url) || urlsCatalogo.has(e.url)) return;
    enCola.add(e.url);
    cola.push(e);
  };
  for (const s of semillas) {
    let fallo = false;
    let encontrados = 0;
    for (const pagina of paginasDe(s)) {
      try {
        const res = await descargar(pagina);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        for (const e of enlacesDeSemilla(await res.text(), pagina)) {
          if (!s.patron.test(e.url) || s.excluir?.test(e.url)) continue;
          const url = canonica(e.url);
          textosDeSemilla.push({ texto: e.texto, url });
          encontrados++;
          encolar({ url, profundidad: 1, administracion: s.administracion, semilla: s.id });
        }
      } catch (error) {
        fallo = true;
        log(`seed ${s.id}: ${pagina} failed (${(error as Error).message}); its aids are kept`);
        break;
      }
    }
    if (!fallo && encontrados === 0) throw new Error(`seed ${s.id} returned no aid links: the page may have changed its design`);
  }
  for (const p of almacen.pendientes) encolar(p);
  almacen.pendientes = [];

  // 2. Aid pages, breadth first; references add pages up to MAX_PROFUNDIDAD.
  let llamadas = 0;
  let procesadas = 0;
  const desaparecidas = new Set<string>();
  const relaciones: Relacion[] = [];
  const porHash = new Map(Object.entries(almacen.rastreo).flatMap(([url, r]) => (r.hash && r.id ? [[r.hash, { url, id: r.id }]] : [])));
  const alias = () => new Map(Object.entries(almacen.rastreo).flatMap(([url, r]) => (r.id ? [[url, r.id]] : [])));

  for (let i = 0; i < cola.length; i++) {
    const { url, profundidad, administracion } = cola[i];
    if (opciones.limite !== undefined && procesadas >= opciones.limite) break;
    procesadas++;
    const previo = almacen.rastreo[url];
    const cabeceras: Record<string, string> = {};
    if (previo?.etag) cabeceras["if-none-match"] = previo.etag;
    if (previo?.modificado) cabeceras["if-modified-since"] = previo.modificado;

    let res: Response;
    try {
      res = await descargar(url, cabeceras);
    } catch (error) {
      log(`page ${url}: ${(error as Error).message}; kept as it was`);
      continue;
    }
    if (res.status === 304) continue;
    if (res.status === 404 || res.status === 410) {
      desaparecidas.add(url);
      continue;
    }
    if (!res.ok) {
      log(`page ${url}: HTTP ${res.status}; kept as it was`);
      continue;
    }
    const html = await res.text();
    const { texto, enlaces } = leerHtml(html, url);
    const hash = hashTexto(texto);
    const cabecerasNuevas = {
      ...(res.headers.get("etag") ? { etag: res.headers.get("etag")! } : {}),
      ...(res.headers.get("last-modified") ? { modificado: res.headers.get("last-modified")! } : {}),
    };

    // Same text as last time: nothing to do, and the file stays the same.
    if (previo?.hash === hash) continue;
    // Same text under another URL: an alias of that aid.
    const igual = porHash.get(hash);
    if (igual && igual.url !== url) {
      almacen.rastreo[url] = { id: igual.id, hash, ...cabecerasNuevas, consultado: hoy };
      continue;
    }
    // A page with a BDNS number is a grant call: spec 002 covers it.
    const codigosPagina = { ...codigos(html, url), idProc: codigos("", url).idProc };
    if (codigosPagina.bdns.length > 0) {
      almacen.rastreo[url] = { hash, ...cabecerasNuevas, consultado: hoy, cubiertaPor: "bdns" };
      log(`page ${url}: BDNS ${codigosPagina.bdns.join(", ")}, covered by BDNS`);
      continue;
    }
    if (llamadas >= maxLlamadas) {
      almacen.pendientes.push({ url, profundidad, administracion });
      continue;
    }

    // PDFs linked as rules, guide or call: their requisite sections go to the model.
    const pdfs = enlaces.filter((e) => /\.pdf(\b|$)/i.test(e.url));
    const textosPdf: string[] = [];
    for (const pdf of pdfs.filter((e) => /bases|convocatoria|gu[ií]a|resumen|requisit/i.test(`${e.texto} ${e.url}`)).slice(0, MAX_PDFS)) {
      try {
        const r = await descargar(pdf.url);
        if (r.ok) textosPdf.push(await textoDePdf(new Uint8Array(await r.arrayBuffer())));
      } catch (error) {
        log(`pdf ${pdf.url}: ${(error as Error).message}`);
      }
    }

    const titulo = texto.split("\n").find((l) => l.startsWith("## "))?.slice(3) ?? null;
    const entrada = componerEntrada(texto, textosPdf);
    let lectura: Awaited<ReturnType<typeof extraer>>;
    try {
      llamadas++;
      lectura = await extraer({ url, titulo, texto: entrada, enlaces }, entorno.completar);
    } catch (error) {
      log(`page ${url}: LLM failed (${(error as Error).message}); retried next run`);
      continue;
    }
    if (!lectura) {
      log(`page ${url}: the LLM returned no JSON; retried next run`);
      continue;
    }
    const { extraccion: x, descartes } = lectura;
    if (descartes.length > 0) log(`page ${url}: ${descartes.length} quote(s) not in the text, dropped`);
    for (const t of [texto, ...textosPdf]) textosNuevos.set(hashTexto(t), t);
    const textos = [hash, ...textosPdf.map(hashTexto)];

    if (!x.esAyuda) {
      almacen.rastreo[url] = { hash, ...cabecerasNuevas, consultado: hoy, noEsAyuda: true };
      continue;
    }
    if (x.naturaleza === "convocatoria") {
      almacen.rastreo[url] = { hash, ...cabecerasNuevas, consultado: hoy, cubiertaPor: "bdns" };
      log(`page ${url}: a grant call, covered by BDNS`);
      continue;
    }
    if (!x.titulo) {
      log(`page ${url}: rejected, no title`);
      continue;
    }

    const codigo = codigosPagina.sia[0] ? `sia${codigosPagina.sia[0]}` : codigosPagina.idProc[0]?.toLowerCase();
    const nueva: Ayuda = {
      id: [slug(x.titulo), codigo].filter(Boolean).join("-"),
      tipo: "ayuda",
      titulo: x.titulo,
      administracion: profundidad === 1 ? administracion : administracionDe(url),
      organismo: x.organismo,
      frases_usuario: x.frases_usuario,
      requisitos_clave: x.requisitos_clave,
      pasos: x.pasos,
      documentacion: x.documentacion,
      plazo: x.plazo,
      enlace_info: url,
      enlace_tramite: x.enlace_tramite,
      fuente: [url, ...pdfs.map((p) => p.url)].join(" ; "),
      verificado: false,
      nota: x.nota,
      relacionados: [],
      naturaleza: x.naturaleza,
      codigos: codigosPagina,
      documentos: pdfs.map((p) => ({ titulo: p.texto, url: p.url })),
      textos,
      relaciones: [],
      consultado: hoy,
    };

    const decision = decidir(nueva, [...items.values()], urlsCatalogo, alias());
    let id: string;
    if (decision.tipo === "catalogo") {
      almacen.rastreo[url] = { hash, ...cabecerasNuevas, consultado: hoy, cubiertaPor: "catalogo" };
      continue;
    } else if (decision.tipo === "fusionar") {
      id = decision.id;
      items.set(id, fusionar(items.get(id)!, nueva));
    } else {
      id = nueva.id;
      for (let n = 2; items.has(id); n++) id = `${nueva.id}-${n}`;
      if (decision.posibleDuplicado) log(`aid ${id}: possible duplicate of ${decision.posibleDuplicado}`);
      items.set(id, { ...nueva, id, ...(decision.posibleDuplicado ? { posibleDuplicado: decision.posibleDuplicado } : {}) });
    }
    almacen.rastreo[url] = { id, hash, ...cabecerasNuevas, consultado: hoy };
    porHash.set(hash, { url, id });

    // References: a link → that page; a name only → the catalogue, the store or a seed link.
    for (const r of x.referencias) {
      let destino = r.url ? canonica(r.url) : null;
      if (!destino) {
        const porNombre = (titulo: string) => similitud(titulo, r.nombre) >= 0.8;
        const delCatalogo = catalogo.items.find((c) => porNombre(c.titulo));
        if (delCatalogo) {
          relaciones.push({ desde: id, tipo: r.tipo, cita: r.cita, id: delCatalogo.id });
          continue;
        }
        const delAlmacen = [...items.values()].find((a) => porNombre(a.titulo));
        if (delAlmacen) {
          relaciones.push({ desde: id, tipo: r.tipo, cita: r.cita, id: delAlmacen.id });
          continue;
        }
        destino = textosDeSemilla.find((e) => porNombre(e.texto))?.url ?? null;
      }
      if (!destino) {
        log(`aid ${id}: reference "${r.nombre}" not resolved`);
        continue;
      }
      relaciones.push({ desde: id, tipo: r.tipo, cita: r.cita, url: destino });
      if (urlsCatalogo.has(destino) || almacen.rastreo[destino]) continue;
      if (!oficial(new URL(destino).hostname)) {
        log(`aid ${id}: reference ${destino} is not an official site, not followed`);
        continue;
      }
      if (profundidad + 1 > MAX_PROFUNDIDAD) continue;
      encolar({ url: destino, profundidad: profundidad + 1, administracion: administracionDe(destino) });
    }
  }

  // 3. Re-link references once every page of the run is known (FR-018).
  const idDeCatalogo = (url: string) =>
    (catalogo.items as ItemCatalogo[]).find((c) =>
      [c.enlace_info, c.enlace_tramite, ...(c.fuente ?? "").split(";")].some((u) => u && canonicaSegura(u.trim()) === url),
    )?.id;
  for (const rel of relaciones) {
    const destino = "id" in rel ? rel.id : (almacen.rastreo[rel.url]?.id ?? idDeCatalogo(rel.url));
    const origen = items.get(rel.desde);
    if (!destino || !origen || destino === rel.desde) continue;
    const relacionados = (origen.relacionados as string[]) ?? [];
    const lista = (origen.relaciones as { id: string; tipo: string; cita: string }[]) ?? [];
    if (!relacionados.includes(destino)) relacionados.push(destino);
    if (!lista.some((l) => l.id === destino && l.tipo === rel.tipo)) lista.push({ id: destino, tipo: rel.tipo, cita: rel.cita });
    items.set(rel.desde, { ...origen, relacionados, relaciones: lista });
  }

  // 4. An aid whose every known URL is gone is removed (FR-011).
  for (const [id] of items) {
    const urls = Object.entries(almacen.rastreo).filter(([, r]) => r.id === id).map(([u]) => u);
    if (urls.length > 0 && urls.every((u) => desaparecidas.has(u))) {
      items.delete(id);
      for (const u of urls) delete almacen.rastreo[u];
      log(`aid ${id}: every page is gone, removed`);
    }
  }

  almacen.items = [...items.values()];
  const cambio = serializar({ ...almacen, version: "" }) !== serializar({ ...anterior, version: "" });
  if (cambio) almacen.version = hoy;
  log(`${llamadas} LLM call(s), ${almacen.items.length} aid(s), ${almacen.pendientes.length} pending`);

  if (opciones.dryRun || !cambio) return { llamadas, escrito: false, registro };
  for (const t of textosNuevos.values()) guardarTexto(carpetaTextos, t);
  writeFileSync(archivoAlmacen, serializar(almacen));
  return { llamadas, escrito: true, registro };
}

function canonicaSegura(url: string): string | null {
  try {
    return canonica(url);
  } catch {
    return null;
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const limite = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : undefined;
  const resumen = await ejecutar(
    { backfill: args.includes("--backfill"), dryRun: args.includes("--dry-run"), limite },
    {
      semillas: semillasDelRepo,
      catalogo: catalogoPack,
      archivoAlmacen: join(RAIZ, "src", "datos", "central.json"),
      carpetaTextos: join(RAIZ, "src", "datos", "textos"),
      ahora: new Date(),
      pausaMs: 1000,
      oficial: esOficial,
      registrar: (l) => console.log(l),
    },
  );
  console.log(resumen.escrito ? "src/datos/central.json written" : "nothing written");
}
