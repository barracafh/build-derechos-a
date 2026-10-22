import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonica, codigos } from "./url";

const grabacion = (archivo: string) => readFileSync(join(import.meta.dir, "grabaciones", archivo), "utf8");

describe("canonica", () => {
  test("lowercases the host and drops the fragment", () => {
    expect(canonica("https://WWW.SEPE.ES/HomeSepe/prestaciones-desempleo/subsidio-desempleo.html#requisitos")).toBe(
      "https://www.sepe.es/HomeSepe/prestaciones-desempleo/subsidio-desempleo.html",
    );
  });

  test("drops tracking parameters and keeps the rest", () => {
    expect(canonica("https://imserso.es/pnc-prestaciones-subvenciones/pnc-jubilacion?utm_source=x&utm_medium=y&fbclid=z&gclid=w")).toBe(
      "https://imserso.es/pnc-prestaciones-subvenciones/pnc-jubilacion",
    );
    expect(canonica("https://sede.gva.es/es/detall-tramit?id_proc=G97829&utm_campaign=x")).toBe(
      "https://sede.gva.es/es/detall-tramit?id_proc=G97829",
    );
  });

  test("drops the trailing slash but keeps the root", () => {
    expect(canonica("https://imserso.es/pnc-prestaciones-subvenciones/")).toBe("https://imserso.es/pnc-prestaciones-subvenciones");
    expect(canonica("https://imserso.es/")).toBe("https://imserso.es/");
  });

  test("gva.es: the Valencian variant and the unprefixed procedure page are the Spanish page", () => {
    const es = "https://sede.gva.es/es/detall-tramit?id_proc=G97829";
    expect(canonica("https://sede.gva.es/va/detall-tramit?id_proc=G97829")).toBe(es);
    expect(canonica("https://sede.gva.es/ca/detall-tramit?id_proc=G97829")).toBe(es);
    expect(canonica("https://sede.gva.es/detall-tramit?id_proc=G97829")).toBe(es);
    expect(canonica("https://habitatge.gva.es/va/web/vivienda-y-calidad-en-la-edificacion/ayudas")).toBe(
      "https://habitatge.gva.es/es/web/vivienda-y-calidad-en-la-edificacion/ayudas",
    );
  });

  test("valencia.es: no lang parameter", () => {
    expect(canonica("https://sede.valencia.es/sede/registro/procedimiento/BS.MA.60?lang=1")).toBe(
      "https://sede.valencia.es/sede/registro/procedimiento/BS.MA.60",
    );
    expect(canonica("https://www.valencia.es/cas/tramites/certificado-de-padron?lang=2&x=1")).toBe(
      "https://www.valencia.es/cas/tramites/certificado-de-padron?x=1",
    );
  });

  test("lang is kept outside valencia.es", () => {
    expect(canonica("https://example.gob.es/a?lang=es")).toBe("https://example.gob.es/a?lang=es");
  });

  test("two spellings of one page give the same URL", () => {
    expect(canonica("https://SEDE.gva.es/va/detall-tramit/?id_proc=G94985&utm_source=a#top")).toBe(
      canonica("https://sede.gva.es/detall-tramit?id_proc=G94985"),
    );
  });
});

describe("codigos", () => {
  test("reads the SIA code and the GVA procedure id from a recorded GVA page", () => {
    const c = codigos(grabacion("gva.G97829.html"), "https://sede.gva.es/es/detall-tramit?id_proc=G97829");
    expect(c.sia).toEqual(["3152996"]);
    expect(c.idProc).toContain("G97829");
  });

  test("ignores 'SIA' without a number", () => {
    expect(codigos("Movemos los avisos debajo de los códigos SIA y GVA").sia).toEqual([]);
  });

  test("reads BOE ids from text and links", () => {
    const c = codigos(grabacion("sepe.semilla.html"));
    expect(c.boe).toContain("BOE-A-2024-10235");
  });

  test("reads BDNS numbers from text and from infosubvenciones links", () => {
    const c = codigos(
      'Código BDNS: 812345. Ver <a href="https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/935684">ficha</a> y <a href="https://www.infosubvenciones.es/bdnstrans/api/convocatorias?vpd=GE&amp;numConv=777777">API</a>',
    );
    expect(c.bdns).toEqual(["812345", "935684", "777777"]);
  });

  test("returns empty lists when there are no codes", () => {
    expect(codigos("Texto sin códigos")).toEqual({ sia: [], idProc: [], bdns: [], boe: [] });
  });
});
