import { describe, expect, test } from "bun:test";
import { hablaDeDana } from "./respaldo";

describe("hablaDeDana", () => {
  test("la DANA, la riada o las inundaciones de 2024", () => {
    expect(hablaDeDana("Mi casa se perdió en la DANA")).toBe(true);
    expect(hablaDeDana("Lo perdimos todo con la riada")).toBe(true);
    expect(hablaDeDana("Las inundaciones de octubre me dejaron sin coche")).toBe(true);
  });

  test("una inundación cualquiera no", () => {
    expect(hablaDeDana("Tuve una inundación en el baño y no llego a fin de mes")).toBe(false);
    expect(hablaDeDana("Vivo en Daimús")).toBe(false);
  });
});
