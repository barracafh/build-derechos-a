import { describe, expect, test } from "bun:test";
import type { Perfil } from "@/lib/tipos";
import { fichasDelCatalogo } from "./catalogo";

const conIngresos = (valor: string): Perfil => ({
  hechos: [{ campo: "ingresos", valor, cita: valor }],
  necesidad: null,
});
const HOY = new Date("2026-10-22T12:00:00Z");

describe("ingresos en tramos", () => {
  test("hasta 1.200 € al mes propone el IMV y cita el tramo", () => {
    const imv = fichasDelCatalogo(conIngresos("de 600 a 1.200 €"), HOY).find((f) => f.id === "ingreso-minimo-vital");
    expect(imv?.porQue).toContain("Dices que en tu casa entran de 600 a 1.200 € al mes.");
  });

  test("más de 1.800 € al mes no propone el IMV", () => {
    const ids = fichasDelCatalogo(conIngresos("más de 1.800 €"), HOY).map((f) => f.id);
    expect(ids).not.toContain("ingreso-minimo-vital");
  });

  test("«bajos», sin cantidad, sigue valiendo", () => {
    const imv = fichasDelCatalogo(conIngresos("bajos"), HOY).find((f) => f.id === "ingreso-minimo-vital");
    expect(imv?.porQue).toContain("Dices que tus ingresos son bajos.");
  });
});
