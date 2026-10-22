import { expect, test } from "bun:test";
import { htmlATexto, partirExtracto } from "./requisitos";

// Extracto real del BOE (BDNS 936148, becas del IGN), abreviado.
const EXTRACTO =
  "<p>Primero. – Personas beneficiarias.</p><p>Podrán ser beneficiarias las personas físicas que reúnan los siguientes requisitos:</p>" +
  "<p>a) Poseer la nacionalidad española.</p><p>Segundo. – Objeto.</p><p>Convocar becas para la formación.</p>" +
  "<p>Cuarto. - Importe</p><p>La asignación económica mensual de la beca es de 1.200 euros.</p>" +
  "<p>Quinto. - Plazo de presentación de solicitudes</p><p>Veinte días hábiles desde el día siguiente a la publicación.</p>";

test("parte el extracto en sus apartados con texto literal", () => {
  const partes = partirExtracto(htmlATexto(EXTRACTO));
  expect(partes.map((p) => p.apartado)).toEqual([
    "Personas beneficiarias",
    "Objeto",
    "Importe",
    "Plazo de presentación de solicitudes",
  ]);
  expect(partes[0].texto).toContain("a) Poseer la nacionalidad española.");
  expect(partes[2].texto).toContain("1.200 euros");
});
