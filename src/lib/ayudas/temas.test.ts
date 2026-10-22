import { describe, expect, test } from "bun:test";
import { relevancia, sinOrganismo, temasQueEncajan, type Tema } from "./temas";

// Títulos reales de la BDNS (22/10/2026).
const ASCENSORES =
  "RESOLUCIÓN de  Vicep. Primera y Conselleria de Vivienda, Empleo, Juventud e Igualdad de aprobación de bases reguladoras de subvenc. para la reparación o sustitución de ascensores dañados a consecuencia de la DANA 2024 y su convocatoria 2026.";
const FACHADAS =
  "RESOLUCIÓN de Vicepr. Primera y Conselleria de Vivienda, Empleo, Juventud e Igualdad que apruebam bases reguladoras de subvenciones para  limpieza y reparación  fachadas dañadas DANA 2024 y convocar subvenc 2026";
const BONO_ALQUILER =
  "Resolución de 18 de agosto de 2026, de la Vicepresidencia Primera y Conselleria de Vivienda, Empleo, Juventud e Igualdad, por la que se aprueban las bases reguladoras y se convocan las ayudas del Bono Alquiler Joven para 2026";
const JOVENES_DESEMPLEADOS =
  "Convocatoria para la concesión de subvenciones destinadas a financiar la contratación de personas jóvenes desempleadas menores de treinta años en el marco de «Proyectos de primera experiencia en administraciones públicas»";
const BONO_CULTURAL =
  "ORDEN DEL MINISTERIO DE CULTURA POR LA QUE SE CONVOCA EL PROCEDIMIENTO PARA LA CONCESIÓN DE LAS AYUDAS DEL PROGRAMA BONO CULTURAL JOVEN 2026";

const JOVEN_EN_PARO: Tema[] = ["empleo", "vivienda", "juventud"];

describe("sinOrganismo", () => {
  test("quita la consellería entera, con su lista de materias", () => {
    expect(sinOrganismo(BONO_ALQUILER)).toBe(
      "resolucion de 18 de agosto de 2026 de la por la que se aprueban las bases reguladoras y se convocan las ayudas del bono alquiler joven para 2026",
    );
    expect(sinOrganismo(ASCENSORES)).not.toContain("empleo");
  });

  test("quita el ministerio en un título en mayúsculas", () => {
    expect(sinOrganismo(BONO_CULTURAL)).not.toContain("cultura por");
    expect(sinOrganismo(BONO_CULTURAL)).toContain("bono cultural joven");
  });

  test("sin organismo en el título, lo deja igual", () => {
    expect(sinOrganismo("AYUDAS PARA INSERCIÓN LABORAL")).toBe("ayudas para insercion laboral");
  });
});

describe("relevancia", () => {
  test("el nombre de la consellería no puntúa", () => {
    expect(relevancia(ASCENSORES, null, JOVEN_EN_PARO, [])).toBe(0);
    expect(relevancia(FACHADAS, null, JOVEN_EN_PARO, [])).toBe(0);
  });

  test("lo que trata la convocatoria sí puntúa", () => {
    expect(relevancia(BONO_ALQUILER, null, JOVEN_EN_PARO, [])).toBe(4);
    expect(relevancia(JOVENES_DESEMPLEADOS, null, JOVEN_EN_PARO, [])).toBe(4);
  });

  test("encaja_con no sale del nombre del organismo", () => {
    expect(temasQueEncajan(ASCENSORES, null, JOVEN_EN_PARO)).toEqual([]);
    expect(temasQueEncajan(BONO_ALQUILER, null, JOVEN_EN_PARO)).toEqual(["vivienda", "juventud"]);
  });
});
