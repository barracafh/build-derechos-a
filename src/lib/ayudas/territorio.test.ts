import { describe, expect, test } from "bun:test";
import { regionCubre, resolverUbicacion, type Ubicacion } from "./territorio";

const ok = (r: ReturnType<typeof resolverUbicacion>) => {
  if ("error" in r) throw new Error(r.error);
  return r as Ubicacion;
};

describe("resolverUbicacion", () => {
  test("València: ayuntamiento y diputación", () => {
    const u = ok(resolverUbicacion({ municipio: "València" }));
    expect(u.ineProvincia).toBe("46");
    expect(u.organosLocales).toContain(2903);
    expect(u.organosLocales).toContain(638);
    expect(u.nuts).toEqual(["ES", "ES5", "ES52", "ES523"]);
  });
  test("Gandia, un pueblo de la Safor", () => {
    const u = ok(resolverUbicacion({ municipio: "gandía" }));
    expect(u.organosLocales).toEqual(expect.arrayContaining([3835, 638]));
  });
  test("nombre corto: Castellón → Castellón de la Plana", () => {
    const u = ok(resolverUbicacion({ municipio: "Castellón" }));
    expect(u.municipio).toContain("CASTELLÓN DE LA PLANA");
    expect(u.organosLocales).toEqual(expect.arrayContaining([684, 2014]));
  });
  test("islas: solo el cabildo de su isla", () => {
    const u = ok(resolverUbicacion({ municipio: "Adeje" }));
    expect(u.isla).toBe("Tenerife");
    expect(u.nuts.at(-1)).toBe("ES709");
    expect(u.nombresLocales.join()).toContain("TENERIFE");
    expect(u.nombresLocales.join()).not.toContain("PALMA");
  });
  test("solo provincia, sin diputación en uniprovinciales", () => {
    const u = ok(resolverUbicacion({ provincia: "Madrid" }));
    expect(u.municipio).toBeNull();
    expect(u.organosLocales).toEqual([]);
  });
  test("municipio inexistente: pide la provincia", () => {
    expect(resolverUbicacion({ municipio: "Villaninguna del Monte" })).toHaveProperty("error");
  });
});

test("regionCubre no es jerárquico hacia abajo", () => {
  const nuts = ["ES", "ES5", "ES52", "ES523"];
  expect(regionCubre("ES - ESPAÑA", nuts)).toBe(true);
  expect(regionCubre("ES52 - COMUNIDAD VALENCIANA", nuts)).toBe(true);
  expect(regionCubre("ES521 - Alicante / Alacant", nuts)).toBe(false);
  expect(regionCubre("ES61 - ANDALUCIA", nuts)).toBe(false);
});
