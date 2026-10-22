// Clean text, hash and section cut for the S4 indexing job (FR-004, FR-005, FR-010).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

// ~12k tokens at ~4 characters per token (FR-005).
export const MAX_CARACTERES = 48_000;

const etiquetas = (lista: string) => new Set(lista.split(" "));
const QUITAR = etiquetas("script style noscript template svg iframe nav header footer aside");
const BLOQUES = etiquetas("p div section article ul ol li dl dt dd table tr blockquote pre address");
const TITULOS = etiquetas("h1 h2 h3 h4 h5 h6");
const VACIOS = etiquetas("area base br col embed hr img input link meta param source track wbr");
// Where the main content is, in order of preference.
const REGIONES: [RegExp, string][] = [
  [/<main[\s>]/i, "main"],
  [/role=["']main["']/i, "role=main"],
  [/id=["']main-content["']/i, "id=main-content"],
];

function esRegionPorAtributo(e: HTMLRewriterTypes.Element, region: string): boolean {
  const [atributo, valor] = region.split("=");
  return e.getAttribute(atributo) === valor;
}

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü", ccedil: "ç",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü", Ccedil: "Ç",
  agrave: "à", egrave: "è", ograve: "ò", Agrave: "À", Egrave: "È", Ograve: "Ò", middot: "·",
  iquest: "¿", iexcl: "¡", ordm: "º", ordf: "ª", euro: "€", deg: "°", laquo: "«", raquo: "»",
  hellip: "…", times: "×", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•",
};

// Lines that change on every visit and say nothing about the aid.
// "Nodo: sweb741:8080:" names the server that rendered a valencia.es page.
const VOLATIL = /(?:[uú]ltima\s+(?:actualizaci[oó]n|modificaci[oó]n|revisi[oó]n)|fecha\s+de\s+(?:actualizaci[oó]n|modificaci[oó]n)|actualizad[oa]\s+(?:el|a)\b|^nodo:\s*\S+:\d+)/i;

function decodificar(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n] ?? m);
}

function normalizar(texto: string): string {
  return texto
    .replace(/[   ]/g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t\r\f\v]+/g, " ").trim())
    .filter((l) => l !== "" && l !== "##" && !VOLATIL.test(l))
    .join("\n");
}

// Main text of a page: no menus, footers, scripts or last-update lines; headings as "## ".
export function textoDeHtml(html: string): string {
  const region = REGIONES.find(([existe]) => existe.test(html))?.[1] ?? "body";
  let dentro = 0;
  let quitado = 0;
  let salida = "";
  const escribir = (s: string) => {
    if (dentro > 0 && quitado === 0) salida += s;
  };

  // An element takes a single end-tag handler, so each element is handled once here.
  new HTMLRewriter()
    .on("*", {
      element(e) {
        const tag = e.tagName;
        const esRegion = region === "body" ? tag === "body" : region === "main" ? tag === "main" : esRegionPorAtributo(e, region);
        // Survey and cookie pop-ups (class "modal") are not page content.
        const esQuitado = QUITAR.has(tag) || /(^|\s)modal(\s|$)/.test(e.getAttribute("class") ?? "");
        const esTituloHtml = TITULOS.has(tag);
        const esBloque = BLOQUES.has(tag);

        if (tag === "br") escribir("\n");
        if (tag === "td" || tag === "th") escribir(" ");
        if (esRegion) dentro++;
        if (esQuitado) quitado++;
        if (esBloque) escribir("\n");
        if (esTituloHtml) escribir("\n## ");

        if (e.selfClosing || VACIOS.has(tag) || !(esRegion || esQuitado || esBloque || esTituloHtml)) return;
        e.onEndTag(() => {
          if (esBloque || esTituloHtml) escribir("\n");
          if (esQuitado) quitado--;
          if (esRegion) dentro--;
        });
      },
    })
    .onDocument({
      text(t) {
        escribir(t.text);
      },
    })
    .transform(html);

  return normalizar(decodificar(salida));
}

export async function textoDePdf(datos: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(datos);
  const { text } = await extractText(pdf, { mergePages: true });
  return normalizar(text);
}

export function hashTexto(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

const CLAVES = /beneficiari|requisit|plazo|documentaci/i;

// A heading: "## " from HTML, or a short PDF line in capitals, ending in ":" or numbered.
function esTitulo(linea: string): boolean {
  if (linea.startsWith("## ")) return true;
  if (linea.length > 80) return false;
  const letras = linea.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  return (
    (letras.length >= 4 && letras === letras.toUpperCase()) ||
    /:$/.test(linea) ||
    /^(?:art[íi]culo|base|cap[íi]tulo)\s+\S+/i.test(linea) ||
    /^\d+(?:\.\d+)*[.)]?\s+[A-ZÁÉÍÓÚÑ]/.test(linea)
  );
}

// Only the sections on beneficiaries, requisites, deadline and documents (FR-005).
export function secciones(texto: string): string {
  const salida: string[] = [];
  let incluir = false;
  for (const linea of texto.split("\n")) {
    if (esTitulo(linea)) incluir = CLAVES.test(linea);
    if (incluir) salida.push(linea);
  }
  return salida.join("\n");
}

// At most `max` characters, cut at the last line break that fits.
export function recortar(texto: string, max = MAX_CARACTERES): string {
  if (texto.length <= max) return texto;
  const corte = texto.lastIndexOf("\n", max);
  return texto.slice(0, corte > 0 ? corte : max);
}

// Saves the text as <dir>/<hash>.txt (once) and returns the hash (FR-010).
export function guardarTexto(dir: string, texto: string): string {
  const hash = hashTexto(texto);
  const archivo = join(dir, `${hash}.txt`);
  if (!existsSync(archivo)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(archivo, texto);
  }
  return hash;
}
