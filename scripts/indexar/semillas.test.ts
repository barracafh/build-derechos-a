import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semillas } from "../../src/datos/semillas";
import grabaciones from "./grabaciones/index.json";

const DIR = join(import.meta.dir, "grabaciones");

function enlaces(html: string, base: string): string[] {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&"));
  return hrefs.flatMap((h) => {
    try {
      return [new URL(h, base).href];
    } catch {
      return [];
    }
  });
}

describe("semillas", () => {
  test("ids are unique and every seed has a recording", () => {
    const ids = semillas.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(grabaciones.paginas.some((p) => p.semilla === id && p.archivo.endsWith(".semilla.html"))).toBe(true);
    }
  });

  for (const s of semillas) {
    test(`${s.id}: the recorded seed lists aid links`, () => {
      const pagina = grabaciones.paginas.find((p) => p.semilla === s.id && p.archivo.endsWith(".semilla.html"))!;
      const html = readFileSync(join(DIR, pagina.archivo), "utf8");
      const ayudas = new Set(
        enlaces(html, pagina.url).filter((u) => s.patron.test(u) && !s.excluir?.test(u)),
      );
      expect(ayudas.size).toBeGreaterThan(0);
    });
  }

  test("every recorded aid page matches its seed pattern", () => {
    for (const p of grabaciones.paginas.filter((p) => !p.archivo.endsWith(".semilla.html"))) {
      const s = semillas.find((x) => x.id === p.semilla)!;
      expect(s.patron.test(p.url)).toBe(true);
    }
  });
});
