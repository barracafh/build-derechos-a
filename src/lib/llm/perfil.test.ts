import { describe, expect, test } from "bun:test";
import { IDS_AYUDAS } from "@/lib/motor/catalogo";
import type { MensajeChat } from "@/lib/tipos";
import { construirMensajes, leerRespuesta } from "./perfil";

const usuario = (texto: string): MensajeChat => ({ rol: "usuario", texto });
const mensajes = [usuario("Tengo 24 años y  estoy en paro. Vivo de alquiler en València.")];
const leer = (datos: unknown, ms = mensajes) => leerRespuesta(JSON.stringify(datos), ms);

describe("construirMensajes", () => {
  test("manda las ayudas como lista cerrada y toda la conversación", () => {
    const conversacion: MensajeChat[] = [
      usuario("Hola"),
      { rol: "asistente", texto: "¿Cuántos años tienes?" },
      usuario("24"),
    ];
    const [sistema, ...resto] = construirMensajes(conversacion);
    expect(sistema.role).toBe("system");
    expect(IDS_AYUDAS).toHaveLength(8);
    for (const id of IDS_AYUDAS) expect(sistema.content).toContain(`"id":"${id}"`);
    expect(sistema.content).not.toContain('"id":"renovacion-dni"');
    expect(resto).toEqual([
      {
        role: "user",
        content:
          "Conversación hasta ahora:\n\nPersona: Hola\nAsistente: ¿Cuántos años tienes?\nPersona: 24\n\nDevuelve solo el objeto JSON.",
      },
    ]);
  });
});

describe("leerRespuesta", () => {
  test("sin objeto JSON devuelve null", () => {
    expect(leerRespuesta("No sé", mensajes)).toBeNull();
    expect(leerRespuesta("{roto", mensajes)).toBeNull();
    expect(leerRespuesta("[1, 2]", mensajes)).toBeNull();
  });

  test("acepta el JSON dentro de un bloque de código", () => {
    const texto = '```json\n{"hechos":[],"necesidad":null,"elegidos":[]}\n```';
    expect(leerRespuesta(texto, mensajes)).toEqual({
      perfil: { hechos: [], necesidad: null },
      elegidos: [],
    });
  });

  test("descarta hechos con campo, valor o cita que no valen", () => {
    const lectura = leer({
      hechos: [
        { campo: "edad", valor: 24, cita: "24 AÑOS" },
        { campo: "situacionLaboral", valor: "En Paro", cita: "estoy en paro" },
        { campo: "vivienda", valor: "alquiler", cita: "vivo de alquiler" },
        { campo: "municipio", valor: "València", cita: "en Madrid" },
        { campo: "dni", valor: "no-aplica", cita: "24 años" },
        { campo: "vivienda", valor: "chalet", cita: "vivo de alquiler" },
        { campo: "hijos", valor: "-1", cita: "24 años" },
        { campo: "hijos", valor: "2", cita: "24 años" },
        { campo: "ingresos", valor: "  ", cita: "estoy en paro" },
      ],
    });
    expect(lectura!.perfil.hechos).toEqual([
      { campo: "edad", valor: "24", cita: "24 AÑOS" },
      { campo: "situacionLaboral", valor: "en paro", cita: "estoy en paro" },
      { campo: "vivienda", valor: "alquiler", cita: "vivo de alquiler" },
    ]);
  });

  test("los valores cerrados no miran tildes y se guardan como la opción", () => {
    const conversacion = [usuario("Soy autonoma y vivo en una habitacion")];
    const lectura = leer(
      {
        hechos: [
          { campo: "situacionLaboral", valor: "autonomo", cita: "Soy autonoma" },
          { campo: "vivienda", valor: "Habitacion", cita: "vivo en una habitacion" },
        ],
      },
      conversacion,
    );
    expect(lectura!.perfil.hechos.map((h) => h.valor)).toEqual(["autónomo", "habitación"]);
  });

  test("las citas ignoran mayúsculas y espacios, pero solo valen las del usuario", () => {
    const conversacion: MensajeChat[] = [
      { rol: "asistente", texto: "¿Vives en València?" },
      usuario("Tengo 24 años"),
    ];
    const lectura = leer(
      {
        hechos: [
          { campo: "edad", valor: "24", cita: "tengo   24 años" },
          { campo: "municipio", valor: "València", cita: "Vives en València" },
        ],
      },
      conversacion,
    );
    expect(lectura!.perfil.hechos.map((h) => h.campo)).toEqual(["edad"]);
  });

  test("un número que no está en su cita no vale", () => {
    const lectura = leer({ hechos: [{ campo: "edad", valor: "70", cita: "Tengo 24" }] });
    expect(lectura!.perfil.hechos).toEqual([]);
  });

  test("el último dato válido de cada campo gana", () => {
    const conversacion = [usuario("Tengo 24 años"), usuario("Perdón, tengo 25")];
    const lectura = leer(
      {
        hechos: [
          { campo: "edad", valor: "24", cita: "24 años" },
          { campo: "edad", valor: "25", cita: "tengo 25" },
          { campo: "edad", valor: "99", cita: "inventada" },
        ],
      },
      conversacion,
    );
    expect(lectura!.perfil.hechos).toEqual([{ campo: "edad", valor: "25", cita: "tengo 25" }]);
  });

  test("necesidad solo si es una cita literal", () => {
    expect(leer({ necesidad: "estoy en paro" })!.perfil.necesidad).toBe("estoy en paro");
    expect(leer({ necesidad: "busca trabajo" })!.perfil.necesidad).toBeNull();
  });

  test("descarta elegidos fuera de la lista, sin cita o repetidos", () => {
    const lectura = leer({
      elegidos: [
        { id: "subsidio-desempleo", citas: ["estoy en paro", "inventada", "estoy en paro"] },
        { id: "ayuda-inventada", citas: ["estoy en paro"] },
        { id: "renovacion-dni", citas: ["estoy en paro"] },
        { id: "ingreso-minimo-vital", citas: ["inventada"] },
        { id: "subsidio-desempleo", citas: ["vivo de alquiler"] },
        { id: "bono-alquiler-joven", titulo: "Bono de 2.000 €", citas: ["vivo de alquiler"] },
      ],
    });
    expect(lectura!.elegidos).toEqual([
      { id: "subsidio-desempleo", citas: ["estoy en paro"] },
      { id: "bono-alquiler-joven", citas: ["vivo de alquiler"] },
    ]);
  });
});
