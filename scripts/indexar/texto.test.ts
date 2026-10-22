import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_CARACTERES, enmascarar, guardarTexto, hashTexto, recortar, secciones, textoDeHtml, textoDePdf } from "./texto";

const DIR = join(import.meta.dir, "grabaciones");
const html = (archivo: string) => readFileSync(join(DIR, archivo), "utf8");

describe("textoDeHtml", () => {
  test("keeps the main content and drops menus, footers, scripts and styles", () => {
    const texto = textoDeHtml(`<html><head><style>p{}</style></head><body>
      <header>MENU</header><nav>NAV</nav>
      <main><h1>Subsidio</h1><nav>NAV EN MAIN</nav><p>Hola&nbsp;<b>mundo</b> &amp; m&aacute;s</p><script>x()</script></main>
      <aside>LATERAL</aside><footer>PIE</footer></body></html>`);
    expect(texto).toBe("## Subsidio\nHola mundo & más");
  });

  test("uses #main-content when there is no <main>", () => {
    expect(textoDeHtml(`<body><div id="cab">CAB</div><div id="main-content"><p>Dentro</p></div><p>Fuera</p></body>`)).toBe("Dentro");
  });

  test("falls back to <body>", () => {
    expect(textoDeHtml(`<body><p>Uno</p><p>Dos</p></body>`)).toBe("Uno\nDos");
  });

  test("drops last-update lines", () => {
    expect(textoDeHtml(`<main><p>Requisitos</p><p>Última actualización: 21/10/2026</p><p>Fecha de actualización 3 de octubre</p><p>Nodo: sweb741:8080:</p></main>`)).toBe(
      "Requisitos",
    );
  });

  test("reads the requisites of a recorded page", () => {
    const texto = textoDeHtml(html("imserso.pnc-jubilacion.html"));
    expect(texto).toContain("Jubilación");
    expect(texto).not.toContain("<");
    expect(texto).not.toContain("readspeaker");
  });

  test("drops survey pop-ups", () => {
    const texto = textoDeHtml(html("seg-social.imv.html"));
    expect(texto).toContain("## Ingreso Mínimo Vital");
    expect(texto).not.toContain("Encuesta de satisfacción");
  });
});

describe("hashTexto", () => {
  test("is the SHA-256 hex of the text", () => {
    expect(hashTexto("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  for (const pagina of ["sepe.subsidio", "imserso.pnc-jubilacion", "gva.G97829", "seg-social.imv", "valencia.itinerarios-inclusion"]) {
    test(`${pagina}: the same page fetched twice hashes the same`, () => {
      const primera = html(`${pagina}.html`);
      const segunda = html(`${pagina}.segunda.html`);
      expect(primera).not.toBe(segunda);
      expect(hashTexto(textoDeHtml(primera))).toBe(hashTexto(textoDeHtml(segunda)));
    });
  }

  test("different pages hash differently", () => {
    expect(hashTexto(textoDeHtml(html("imserso.pnc-jubilacion.html")))).not.toBe(hashTexto(textoDeHtml(html("imserso.pnc-incapacidad.html"))));
  });
});

describe("textoDePdf", () => {
  test("reads the text of a recorded PDF", async () => {
    const texto = await textoDePdf(new Uint8Array(readFileSync(join(DIR, "pnc-resumen.sintetico.pdf"))));
    expect(texto).toContain("REQUISITOS:");
    expect(texto).toContain("A) Ser mayor de 65 años en la fecha de la solicitud");
  });
});

describe("secciones", () => {
  test("keeps the sections on beneficiaries, requisites, deadline and documents", () => {
    const texto = ["## Qué es", "Una ayuda.", "## Requisitos", "Ser mayor de edad.", "## Cuantía", "100 euros.", "## Plazo de solicitud", "Todo el año.", "## Documentación", "DNI."].join("\n");
    expect(secciones(texto)).toBe(["## Requisitos", "Ser mayor de edad.", "## Plazo de solicitud", "Todo el año.", "## Documentación", "DNI."].join("\n"));
  });

  test("finds uppercase and colon headings in a recorded PDF", async () => {
    const texto = await textoDePdf(new Uint8Array(readFileSync(join(DIR, "pnc-resumen.sintetico.pdf"))));
    const corte = secciones(texto);
    expect(corte).toContain("A) Ser mayor de 18 años y menor de 65 años en la fecha de la solicitud");
    expect(corte).toContain("A) Ser mayor de 65 años en la fecha de la solicitud");
    expect(corte).not.toContain("GUÍA RESUMEN");
    expect(corte.length).toBeLessThan(texto.length);
  });

  test("returns an empty string when no heading matches", () => {
    expect(secciones("## Qué es\nUna ayuda.")).toBe("");
  });
});

describe("recortar", () => {
  test("leaves short text alone and cuts long text at a line break", () => {
    expect(recortar("corto")).toBe("corto");
    const largo = Array.from({ length: 20_000 }, (_, i) => `línea ${i}`).join("\n");
    const corte = recortar(largo);
    expect(corte.length).toBeLessThanOrEqual(MAX_CARACTERES);
    expect(largo.startsWith(corte)).toBe(true);
    expect(largo[corte.length]).toBe("\n");
  });
});

describe("guardarTexto", () => {
  const dir = mkdtempSync(join(tmpdir(), "textos-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test("writes <hash>.txt once and returns the hash", () => {
    const hash = guardarTexto(dir, "Requisitos\nSer mayor de edad.");
    expect(hash).toBe(hashTexto("Requisitos\nSer mayor de edad."));
    expect(readFileSync(join(dir, `${hash}.txt`), "utf8")).toBe("Requisitos\nSer mayor de edad.");
    expect(guardarTexto(dir, "Requisitos\nSer mayor de edad.")).toBe(hash);
    expect(existsSync(join(dir, `${hash}.txt`))).toBe(true);
  });
});

describe("enmascarar", () => {
  // Built at run time so that the repo holds no literal contact data.
  const tel = (...partes: string[]) => partes.join(" ");
  const correo = ["buzon", "imserso.es"].join("@");
  test("hides emails and phone numbers, and leaves dates, amounts and codes alone", () => {
    expect(enmascarar(`Escriba a ${correo} o llame al ${tel("917", "033", "000")} o al ${tel("+34", "900", "927", "567")} o al ${tel("963", "52", "54", "78")}.`)).toBe(
      "Escriba a [email] o llame al [teléfono] o al [teléfono] o al [teléfono].",
    );
    expect(enmascarar("Código SIA: 3152996. 8.803,20 € del 04-10-2025 al 28/11/2025, id 65850d68.")).toBe(
      "Código SIA: 3152996. 8.803,20 € del 04-10-2025 al 28/11/2025, id 65850d68.",
    );
  });

  test("saved texts are masked; the file keeps the hash of the text that was read", () => {
    const dir = mkdtempSync(join(tmpdir(), "mascara-"));
    const texto = `Llame al 012 o al ${tel("963", "866", "000")}.`;
    const hash = guardarTexto(dir, texto);
    expect(hash).toBe(hashTexto(texto));
    expect(readFileSync(join(dir, `${hash}.txt`), "utf8")).toBe("Llame al 012 o al [teléfono].");
    rmSync(dir, { recursive: true, force: true });
  });
});
