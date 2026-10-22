import { describe, expect, test } from "bun:test";
import type { AyudaEncontrada } from "@/lib/ayudas/buscar";
import type { Tema } from "@/lib/ayudas/temas";
import { temasEnTitulo } from "./bdns";

const ayuda = (titulo: string, encaja_con: Tema[]) => ({ titulo, encaja_con }) as AyudaEncontrada;

// Títulos reales de la BDNS (22/10/2026), con los temas de «Tengo 2 hijos».
describe("temasEnTitulo", () => {
  test("una ayuda escolar para los hijos se propone", () => {
    expect(
      temasEnTitulo(ayuda("AYUDA MATERIAL ESCOLAR, CONVOCATORIA 2026-2027", ["familia", "educacion"])),
    ).toEqual(["educacion"]);
  });

  test("una beca para adultos no es educación de los hijos", () => {
    expect(
      temasEnTitulo(
        ayuda(
          "RESOLUCIÓN, del director general de Labora Servicio Valenciano de Empleo y Formación, por la que se aprueba la convocatoria para la concesión de becas y ayudas para las personas trabajadoras desempleadas",
          ["familia", "educacion"],
        ),
      ),
    ).toEqual([]);
    expect(
      temasEnTitulo(
        ayuda(
          "Resolución, de 5 de octubre de 2026, de la Subsecretaría de Transportes y Movilidad, por la que se hace pública la convocatoria de becas para la formación en el Instituto Geográfico Nacional",
          ["familia", "educacion"],
        ),
      ),
    ).toEqual([]);
  });

  test("el nombre de la consellería no cuenta como tema", () => {
    expect(
      temasEnTitulo(
        ayuda(
          "RESOLUCIÓN de Vicepr. Primera y Conselleria de Vivienda, Empleo, Juventud e Igualdad que apruebam bases reguladoras de subvenciones para  limpieza y reparación  fachadas dañadas DANA 2024 y convocar subvenc 2026",
          ["vivienda", "juventud"],
        ),
      ),
    ).toEqual([]);
  });
});
