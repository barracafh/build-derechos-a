// Re-runs the job on a fixed set of pages into a temporary folder and prints how
// much of each aid was filled (FR-026). Uses the real LLM: needs .env.local.
// Run: bun scripts/indexar/medir.ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import catalogo from "../../datos/catalogo-tramites-ayudas.json";
import { semillas } from "../../src/datos/semillas";
import { type Almacen, ejecutar, esOficial } from "./index";

const PAGINAS = [
  "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/12778",
  "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10938",
  "https://imserso.es/pnc-prestaciones-subvenciones/pnc-incapacidad",
  "https://imserso.es/pnc-prestaciones-subvenciones/presentaciones-sistema-autonomia-atencion-dependencia",
  "https://sede.gva.es/es/detall-tramit?id_proc=G104345",
];
// Pages read per run, references included: keeps the cost of a measurement bounded.
const LIMITE = Number(process.argv[2] ?? 8);

const CAMPOS = ["organismo", "requisitos_clave", "exclusiones", "pasos", "documentacion", "plazo", "cuantia", "ambito", "enlace_tramite"] as const;
const lleno = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "");

const dir = mkdtempSync(join(tmpdir(), "medir-"));
const inicio = Date.now();
const { llamadas, registro } = await ejecutar(
  { backfill: true, urls: PAGINAS, limite: LIMITE },
  {
    semillas,
    catalogo,
    archivoAlmacen: join(dir, "central.json"),
    carpetaTextos: join(dir, "textos"),
    ahora: new Date(),
    pausaMs: 1000,
    oficial: esOficial,
    registrar: () => {},
  },
);
const segundos = (Date.now() - inicio) / 1000;
const almacen: Almacen = await Bun.file(join(dir, "central.json")).json();

console.log(`\n${llamadas} LLM call(s) in ${segundos.toFixed(0)} s (${(segundos / Math.max(llamadas, 1)).toFixed(0)} s per page)\n`);
for (const a of almacen.items) {
  const llenos = CAMPOS.filter((c) => lleno(a[c]));
  const descartes = registro.find((l) => l.startsWith(`page ${a.enlace_info}:`) && l.includes("quote"));
  console.log(`${a.id}${a.incompleta ? "  [incompleta]" : ""}`);
  console.log(`  filled ${llenos.length}/${CAMPOS.length}: ${llenos.join(", ")}`);
  console.log(`  empty: ${CAMPOS.filter((c) => !lleno(a[c])).join(", ") || "-"}`);
  if (a.plazo) console.log(`  plazo: ${a.plazo} · fechaFin: ${a.fechaFin ?? "-"}`);
  if (a.plazoListado) console.log(`  listing: ${JSON.stringify(a.plazoListado)}`);
  if (descartes) console.log(`  ${descartes}`);
}
const fuera = Object.entries(almacen.rastreo).filter(([, r]) => r.noEsAyuda || r.cubiertaPor);
for (const [url, r] of fuera) console.log(`not stored: ${url} (${r.noEsAyuda ? "not an aid" : `covered by ${r.cubiertaPor}`})`);
for (const l of registro.filter((l) => /failed|no JSON|rejected|not resolved/.test(l))) console.log(`log: ${l}`);
console.log(`\nstore: ${join(dir, "central.json")}`);
