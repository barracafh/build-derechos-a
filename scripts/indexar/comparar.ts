// T005 check with the real LLM: extract 2 catalogue aids from their recorded pages
// and print the result next to the catalogue entry. Needs HELMCODE_API_KEY and
// HELMCODE_MODEL in .env.local. Run: bun scripts/indexar/comparar.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import catalogo from "../../datos/catalogo-tramites-ayudas.json";
import { componerEntrada, extraer } from "./extraer";
import { leerHtml } from "./texto";

const CASOS = [
  { id: "subsidio-desempleo", archivo: "sepe.subsidio.html", url: "https://www.sepe.es/HomeSepe/prestaciones-desempleo/subsidio-desempleo.html" },
  {
    id: "ingreso-minimo-vital",
    archivo: "seg-social.imv.html",
    url: "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/65850d68-8d06-4645-bde7-05374ee42ac7",
  },
];

const CAMPOS = ["titulo", "organismo", "requisitos_clave", "pasos", "documentacion", "plazo"] as const;

for (const caso of CASOS) {
  const html = readFileSync(join(import.meta.dir, "grabaciones", caso.archivo), "utf8");
  const { texto, enlaces } = leerHtml(html, caso.url);
  const titulo = texto.split("\n").find((l) => l.startsWith("## "))?.slice(3) ?? null;
  const lectura = await extraer({ url: caso.url, titulo, texto: componerEntrada(texto, []), enlaces });
  const item = catalogo.items.find((i) => i.id === caso.id)!;

  console.log(`\n=== ${caso.id} (${caso.archivo}) ===`);
  if (!lectura) {
    console.log("The model did not return a JSON object.");
    continue;
  }
  const { extraccion, descartes } = lectura;
  console.log(`esAyuda: ${extraccion.esAyuda} · naturaleza: ${extraccion.naturaleza} · enlace_tramite: ${extraccion.enlace_tramite}`);
  for (const campo of CAMPOS) {
    console.log(`\n-- ${campo}\n   catalogue: ${JSON.stringify(item[campo])}\n   extracted: ${JSON.stringify(extraccion[campo])}`);
  }
  console.log(`\n-- frases_usuario: ${JSON.stringify(extraccion.frases_usuario)}`);
  console.log(`-- referencias: ${JSON.stringify(extraccion.referencias)}`);
  console.log(`-- quotes dropped (not in the text): ${JSON.stringify(descartes)}`);
}
