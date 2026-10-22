// Job e2e test (spec 004, "Job e2e test"): a fake site on Bun.serve and a fake
// HelmCode on HELMCODE_BASE_URL that counts calls; no network.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Semilla } from "../../src/datos/semillas";
import { type Almacen, type Entorno, ejecutar, urlDeDescarga } from "./index";

type Pagina = { status?: number; html?: string };
type Ref = { nombre: string; cita: string; ruta?: string; tipo?: string };
type Guion = { fallaUnaVez?: boolean; esAyuda?: boolean; naturaleza?: string; requisitos?: string[]; plazo?: string; enlaceTramite?: number; refs?: Ref[] };

const pagina = (titulo: string, cuerpo: string[], enlaces: [string, string][] = []) =>
  `<html><body><nav><a href="/menu">Menú</a></nav><main><h1>${titulo}</h1>${cuerpo.map((p) => `<p>${p}</p>`).join("")}${enlaces
    .map(([texto, ruta]) => `<a href="${ruta}">${texto}</a>`)
    .join("")}</main><footer>Pie</footer></body></html>`;
const semilla = (rutas: string[]) => `<html><body><main>${rutas.map((r) => `<a href="${r}">${r}</a>`).join("")}</main></body></html>`;
const ayuda = (titulo: string, extra: string[] = [], enlaces: [string, string][] = []) =>
  pagina(titulo, [`Requisito: ser residente para ${titulo}.`, ...extra], enlaces);

const PEI = "Prestaciones Económicas Individuales para personas con discapacidad del ejercicio";

let sitio: Record<string, Pagina>;
const guiones: Record<string, Guion> = {
  "/a/no-ayuda": { esAyuda: false },
  "/a/convocatoria": { naturaleza: "convocatoria" },
  "/a/inventada": { requisitos: ["Tener la nacionalidad española"], enlaceTramite: 9 },
  "/a/uno": { refs: [{ nombre: "Ayuda dos", cita: "Ver también la ayuda dos.", ruta: "/a/dos", tipo: "complemento" }] },
  "/a/copia": { refs: [{ nombre: "Ayuda dos", cita: "Ver también la ayuda dos.", ruta: "/a/dos", tipo: "complemento" }] },
  "/a/dos": { refs: [{ nombre: "Ayuda uno", cita: "Ver también la ayuda uno.", ruta: "/a/uno", tipo: "requisito" }] },
  "/a/nombre": { refs: [{ nombre: "Ingreso Mínimo Vital (IMV)", cita: "Hay que pedir antes el Ingreso Mínimo Vital (IMV).", tipo: "requisito" }] },
  "/a/externa": { refs: [{ nombre: "Otra web", cita: "Más información en otra web.", ruta: "http://otro.test/x" }] },
  "/a/p1": { refs: [{ nombre: "P2", cita: "Ver la ayuda P2.", ruta: "/a/p2" }] },
  "/a/p2": { refs: [{ nombre: "P3", cita: "Ver la ayuda P3.", ruta: "/a/p3" }] },
  "/a/indice": { esAyuda: false, refs: [{ nombre: "Ayuda hija", cita: "Una de ellas es la ayuda hija.", ruta: "/a/hija" }] },
  "/d/1": { plazo: "Plazo: hasta el 28/11/2025." },
  "/a/hijas": { fallaUnaVez: true },
};
const fallos = new Set<string>();

function sitioInicial(): Record<string, Pagina> {
  const s: Record<string, Pagina> = {
    "/s1": {
      html: semilla([
        "/a/uno", "/a/copia", "/a/dos", "/a/no-ayuda", "/a/convocatoria", "/a/bdns", "/a/catalogo",
        "/a/sia", "/a/pei25", "/a/pei24", "/a/inventada", "/a/nombre", "/a/externa", "/a/p1",
        "/a/indice", "/a/detalle", "/a/vacia", "/a/hijas",
      ]),
    },
    "/s4": {
      html: `<html><body><main><a href="/d/1"><div>Conselleria</div><div>Ayuda con plazo</div><div>Solicitud: <span>04-10-2025</span><span> - </span><span>28-11-2025</span></div><div>Cerrado</div></a></main></body></html>`,
    },
    "/s2": { html: semilla(["/b/sia"]) },
    "/s3": { html: semilla(["/c/uno"]) },
    "/a/uno": { html: ayuda("Ayuda uno", ["Ver también la ayuda dos."], [["Ayuda dos", "/a/dos"]]) },
    "/a/dos": { html: ayuda("Ayuda dos", ["Ver también la ayuda uno."], [["Ayuda uno", "/a/uno"]]) },
    "/a/no-ayuda": { html: ayuda("Contacto") },
    "/a/convocatoria": { html: ayuda("Convocatoria de becas 2026") },
    "/a/bdns": { html: ayuda("Subvención municipal", ["Código BDNS: 812345"]) },
    "/a/catalogo": { html: ayuda("Ingreso Mínimo Vital") },
    "/a/sia": { html: ayuda("Pensión de jubilación", ["Código SIA: 1234567"]) },
    "/b/sia": { html: ayuda("Jubilación no contributiva", ["Código SIA: 1234567"]) },
    "/a/pei25": { html: ayuda(`${PEI} 2025`) },
    "/a/pei24": { html: ayuda(`${PEI} 2024`) },
    "/a/inventada": { html: ayuda("Ayuda con citas inventadas", [], [["Solicitar", "/solicitar"]]) },
    "/a/nombre": { html: ayuda("Renta de inclusión", ["Hay que pedir antes el Ingreso Mínimo Vital (IMV)."]) },
    "/a/externa": { html: ayuda("Ayuda con enlace externo", ["Más información en otra web."], [["Otra web", "http://otro.test/x"]]) },
    "/a/p1": { html: ayuda("Ayuda P1", ["Ver la ayuda P2."], [["P2", "/a/p2"]]) },
    "/a/p2": { html: ayuda("Ayuda P2", ["Ver la ayuda P3."], [["P3", "/a/p3"]]) },
    "/a/p3": { html: ayuda("Ayuda P3") },
    "/c/uno": { html: ayuda("Ayuda municipal") },
    "/a/indice": { html: pagina("Prestaciones", ["Hay varias prestaciones. Una de ellas es la ayuda hija."], [["Ayuda hija", "/a/hija"]]) },
    "/a/hija": { html: ayuda("Ayuda hija") },
    "/a/detalle": { html: pagina("Ayuda con subpágina", ["Información general."], [["Requisitos y plazos", "/a/detalle/requisitos"], ["Noticias", "/noticias"]]) },
    "/a/detalle/requisitos": { html: pagina("Requisitos", ["Requisito: tener 18 años para la ayuda con subpágina."]) },
    "/a/vacia": { html: pagina("Ayuda sin datos", ["Texto general sin requisitos."]) },
    "/a/hijas": { html: pagina("Ayuda con régimen", ["Prestación económica."], [["Régimen General", "/a/hijas/general"]]) },
    "/a/hijas/general": { html: pagina("Régimen General", ["Requisito: estar afiliado para la ayuda con régimen."]) },
    "/d/1": { html: ayuda("Ayuda con plazo", ["Plazo: hasta el 28/11/2025."]) },
  };
  s["/a/copia"] = s["/a/uno"];
  return s;
}

const pedidas: string[] = [];
let llamadasLlm = 0;
let sinCambios = 0;
let base = "";

// Builds the model's answer from the page it was sent: quotes come from that text.
function contestar(contenido: string): string {
  const url = contenido.match(/^URL: (.+)$/m)![1];
  const ruta = new URL(url).pathname;
  const texto = contenido.split("Texto de la página:\n")[1].split("\n\nEnlaces de la página:")[0];
  const enlaces = [...contenido.matchAll(/^\[(\d+)\] .* — (.+)$/gm)].map((m) => ({ n: Number(m[1]), url: m[2] }));
  const g = guiones[ruta] ?? {};
  return JSON.stringify({
    esAyuda: g.esAyuda ?? true,
    naturaleza: g.naturaleza ?? "prestacion",
    titulo: null,
    organismo: null,
    frases_usuario: ["necesito ayuda"],
    requisitos_clave: g.requisitos ?? texto.split("\n").filter((l) => l.startsWith("Requisito:")).slice(0, 1),
    pasos: [],
    documentacion: [],
    plazo: g.plazo ?? null,
    nota: null,
    enlace_tramite: g.enlaceTramite ?? null,
    referencias: (g.refs ?? []).map((r) => ({
      nombre: r.nombre,
      cita: r.cita,
      tipo: r.tipo ?? "relacionada",
      enlace: r.ruta ? (enlaces.find((e) => e.url === new URL(r.ruta!, base).href)?.n ?? null) : null,
    })),
  });
}

let servidor: ReturnType<typeof Bun.serve>;
let dir: string;

beforeAll(() => {
  servidor = Bun.serve({
    port: 0,
    async fetch(req) {
      const { pathname } = new URL(req.url);
      if (pathname === "/v1/chat/completions") {
        llamadasLlm++;
        const cuerpo = await req.json();
        const ruta = new URL(cuerpo.messages[1].content.match(/^URL: (.+)$/m)[1]).pathname;
        if (guiones[ruta]?.fallaUnaVez && !fallos.has(ruta)) {
          fallos.add(ruta);
          return new Response("error", { status: 502 });
        }
        return Response.json({ choices: [{ message: { content: contestar(cuerpo.messages[1].content) } }] });
      }
      pedidas.push(pathname);
      const p = sitio[pathname];
      if (!p) return new Response("no", { status: 404 });
      if (p.status && p.status !== 200) return new Response("error", { status: p.status });
      const etag = `"${Bun.hash(p.html!).toString(16)}"`;
      if (req.headers.get("if-none-match") === etag) {
        sinCambios++;
        return new Response(null, { status: 304 });
      }
      return new Response(p.html, { headers: { "content-type": "text/html", etag } });
    },
  });
  base = `http://localhost:${servidor.port}`;
  process.env.HELMCODE_BASE_URL = `${base}/v1`;
  process.env.HELMCODE_API_KEY = "test";
  process.env.HELMCODE_MODEL = "test";
  dir = mkdtempSync(join(tmpdir(), "indexar-"));
});

afterAll(() => {
  servidor.stop(true);
  rmSync(dir, { recursive: true, force: true });
});

const semillas = (): Semilla[] => [
  { id: "s1", url: `${base}/s1`, patron: /^http:\/\/localhost:\d+\/a\//, administracion: "Estado" },
  { id: "s2", url: `${base}/s2`, patron: /^http:\/\/localhost:\d+\/b\//, administracion: "Comunitat Valenciana" },
  { id: "s3", url: `${base}/s3`, patron: /^http:\/\/localhost:\d+\/c\//, administracion: "Local" },
  { id: "s4", url: `${base}/s4`, patron: /^http:\/\/localhost:\d+\/d\//, administracion: "Comunitat Valenciana" },
];

function entorno(nombre: string, cambios: Partial<Entorno> = {}): Entorno {
  return {
    semillas: semillas(),
    catalogo: { items: [{ id: "ingreso-minimo-vital", titulo: "Ingreso Mínimo Vital (IMV)", enlace_info: `${base}/a/catalogo`, enlace_tramite: null, fuente: null }] },
    archivoAlmacen: join(dir, `${nombre}.json`),
    carpetaTextos: join(dir, `${nombre}-textos`),
    ahora: new Date("2026-10-22T10:00:00+02:00"),
    pausaMs: 0,
    oficial: (host) => host === "localhost",
    registrar: () => {},
    ...cambios,
  };
}

const leer = (e: Entorno): Almacen => JSON.parse(readFileSync(e.archivoAlmacen, "utf8"));
const porUrl = (a: Almacen, ruta: string) => a.items.find((i) => i.enlace_info === `${base}${ruta}`);

describe("indexar job", () => {
  const e = () => entorno("principal");
  let primera: Almacen;
  let registro: string[];

  test("first run: one call per new page, the rest decided by code", async () => {
    sitio = sitioInicial();
    llamadasLlm = 0;
    const r = await ejecutar({}, e());
    registro = r.registro;
    primera = leer(e());
    // uno, dos, no-ayuda, convocatoria, sia, pei25, pei24, inventada, nombre, externa, p1, indice, detalle,
    // vacia, hijas (failed once, retried), p2, hija, b/sia, c/uno, d/1.
    expect(llamadasLlm).toBe(21);
    expect(r.llamadas).toBe(20);
    expect(primera.items.map((i) => new URL(i.enlace_info).pathname).sort()).toEqual(
      [
        "/a/detalle", "/a/dos", "/a/externa", "/a/hija", "/a/hijas", "/a/inventada", "/a/nombre", "/a/p1", "/a/p2",
        "/a/pei24", "/a/pei25", "/a/sia", "/a/uno", "/a/vacia", "/c/uno", "/d/1",
      ].sort(),
    );
    const normalizado = readFileSync(e().archivoAlmacen, "utf8").replaceAll(base, "http://sitio");
    expect(normalizado).toMatchSnapshot();
  });

  test("same page under two URLs: one aid, the second is an alias", () => {
    expect(primera.rastreo[`${base}/a/copia`].id).toBe(porUrl(primera, "/a/uno")!.id);
  });

  test("same SIA code on two sites: one aid", () => {
    const sia = porUrl(primera, "/a/sia")!;
    expect(sia.fuente).toContain(`${base}/b/sia`);
    expect(primera.items.some((i) => i.enlace_info === `${base}/b/sia`)).toBe(false);
  });

  test("near-identical title without a code is flagged, not merged", () => {
    expect(porUrl(primera, "/a/pei24")!.posibleDuplicado).toBe(porUrl(primera, "/a/pei25")!.id);
    expect(registro.some((l) => l.includes("possible duplicate"))).toBe(true);
  });

  test("catalogue URL is not fetched nor written", () => {
    expect(pedidas).not.toContain("/a/catalogo");
    expect(primera.rastreo[`${base}/a/catalogo`]).toBeUndefined();
  });

  test("a quote not in the text leaves the field empty; an invented link becomes null", () => {
    const x = porUrl(primera, "/a/inventada")!;
    expect(x.requisitos_clave).toEqual([]);
    expect(x.enlace_tramite).toBeNull();
  });

  test("a non-aid page and grant calls are not written; BDNS pages need no call", () => {
    expect(primera.rastreo[`${base}/a/no-ayuda`].noEsAyuda).toBe(true);
    expect(primera.rastreo[`${base}/a/convocatoria`].cubiertaPor).toBe("bdns");
    expect(primera.rastreo[`${base}/a/bdns`].cubiertaPor).toBe("bdns");
  });

  test("references: both aids end up related, a name resolves to the catalogue, cycles stop", () => {
    const uno = porUrl(primera, "/a/uno")!;
    const dos = porUrl(primera, "/a/dos")!;
    expect(uno.relaciones).toEqual([{ id: dos.id, tipo: "complemento", cita: "Ver también la ayuda dos." }]);
    expect(dos.relacionados).toEqual([uno.id]);
    expect(porUrl(primera, "/a/nombre")!.relacionados).toEqual(["ingreso-minimo-vital"]);
    expect(pedidas.filter((p) => p === "/a/uno").length).toBe(1);
  });

  test("references: a non-official host is logged and not fetched; depth 3 is not fetched", () => {
    expect(registro.some((l) => l.includes("otro.test") && l.includes("not followed"))).toBe(true);
    expect(pedidas).toContain("/a/p2");
    expect(pedidas).not.toContain("/a/p3");
  });

  test("an overview page is not written, but its references are followed", () => {
    expect(primera.rastreo[`${base}/a/indice`].noEsAyuda).toBe(true);
    expect(porUrl(primera, "/a/hija")).toBeDefined();
  });

  test("the aid's own detail subpages are read in the same call", () => {
    const d = porUrl(primera, "/a/detalle")!;
    expect(d.requisitos_clave).toEqual(["Requisito: tener 18 años para la ayuda con subpágina."]);
    expect(d.fuente).toContain(`${base}/a/detalle/requisitos`);
    expect(pedidas).not.toContain("/noticias");
  });

  test("child pages under the aid's own path are read even without a keyword; a failed LLM call is retried once", () => {
    const h = porUrl(primera, "/a/hijas")!;
    expect(h.requisitos_clave).toEqual(["Requisito: estar afiliado para la ayuda con régimen."]);
    expect(h.fuente).toContain(`${base}/a/hijas/general`);
  });

  test("an aid with no requisites and no deadline is marked incomplete", () => {
    expect(porUrl(primera, "/a/vacia")!.incompleta).toBe(true);
    expect(porUrl(primera, "/a/uno")!.incompleta).toBeUndefined();
  });

  test("the listing's application period is kept, and fechaFin comes from the plazo quote", () => {
    const d = porUrl(primera, "/d/1")!;
    expect(d.plazoListado).toEqual({ texto: "Solicitud: 04-10-2025 - 28-11-2025", inicio: "2025-10-04", fin: "2025-11-28", estado: "Cerrado" });
    expect(d.plazo).toBe("Plazo: hasta el 28/11/2025.");
    expect(d.tipoPlazo).toBe("fechas");
    expect(d.fechaInicio).toBe("2025-10-04");
    expect(d.fechaFin).toBe("2025-11-28");
    expect(porUrl(primera, "/a/uno")!.tipoPlazo).toBe("sin_plazo");
  });

  test("texts are saved by hash", () => {
    expect(readdirSync(e().carpetaTextos).length).toBeGreaterThan(10);
  });

  test("second run: no calls, conditional requests answered 304, and an empty diff", async () => {
    const antes = readFileSync(e().archivoAlmacen, "utf8");
    llamadasLlm = 0;
    sinCambios = 0;
    const r = await ejecutar({}, e());
    expect(llamadasLlm).toBe(0);
    expect(sinCambios).toBeGreaterThan(10);
    expect(r.escrito).toBe(false);
    expect(readFileSync(e().archivoAlmacen, "utf8")).toBe(antes);
  });

  test("a changed page makes one call; a 404 removes its aid; a failing seed keeps its aids", async () => {
    sitio["/a/dos"] = { html: ayuda("Ayuda dos", ["Ver también la ayuda uno.", "Nuevo párrafo."], [["Ayuda uno", "/a/uno"]]) };
    sitio["/a/pei24"] = { status: 404 };
    sitio["/s3"] = { status: 500 };
    llamadasLlm = 0;
    const r = await ejecutar({}, e());
    const tercera = leer(e());
    expect(llamadasLlm).toBe(1);
    expect(porUrl(tercera, "/a/pei24")).toBeUndefined();
    expect(porUrl(tercera, "/c/uno")).toBeDefined();
    expect(r.registro.some((l) => l.includes("seed s3"))).toBe(true);
  });
});

describe("indexar job limits", () => {
  test("a seed with no aid links fails the run and writes nothing", async () => {
    sitio = { "/s1": { html: semilla([]) } };
    const e = entorno("vacia", { semillas: [semillas()[0]] });
    await expect(ejecutar({}, e)).rejects.toThrow("no aid links");
    expect(existsSync(e.archivoAlmacen)).toBe(false);
  });

  test("40 new texts make 30 calls; the rest wait for the next run", async () => {
    const rutas = Array.from({ length: 40 }, (_, i) => `/a/n${i}`);
    sitio = { "/s1": { html: semilla(rutas) } };
    for (const r of rutas) sitio[r] = { html: ayuda(`Ayuda número ${r}`) };
    const e = entorno("tope", { semillas: [semillas()[0]] });
    llamadasLlm = 0;
    await ejecutar({}, e);
    expect(llamadasLlm).toBe(30);
    expect(leer(e).pendientes.length).toBe(10);
    llamadasLlm = 0;
    await ejecutar({}, e);
    expect(llamadasLlm).toBe(10);
    expect(leer(e).items.length).toBe(40);
  });

  test("a fixed list of URLs skips the seeds", async () => {
    sitio = sitioInicial();
    pedidas.length = 0;
    const e = entorno("lista");
    llamadasLlm = 0;
    await ejecutar({ urls: [`${base}/c/uno`] }, e);
    expect(llamadasLlm).toBe(1);
    expect(pedidas).toEqual(["/c/uno"]);
    expect(leer(e).items.map((i) => i.enlace_info)).toEqual([`${base}/c/uno`]);
  });

  test("--dry-run --limit 3 reads 3 pages and writes nothing", async () => {
    const rutas = ["/a/x1", "/a/x2", "/a/x3", "/a/x4"];
    sitio = { "/s1": { html: semilla(rutas) } };
    for (const r of rutas) sitio[r] = { html: ayuda(`Ayuda ${r}`) };
    const e = entorno("prueba", { semillas: [semillas()[0]] });
    llamadasLlm = 0;
    const r = await ejecutar({ dryRun: true, limite: 3 }, e);
    expect(llamadasLlm).toBe(3);
    expect(r.escrito).toBe(false);
    expect(existsSync(e.archivoAlmacen)).toBe(false);
  });
});

describe("urlDeDescarga", () => {
  test("asks seg-social.es for the Spanish page and leaves other sites alone", () => {
    expect(urlDeDescarga("https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10938")).toBe(
      "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10938?changeLanguage=es",
    );
    expect(urlDeDescarga("https://imserso.es/pnc")).toBe("https://imserso.es/pnc");
  });
});
