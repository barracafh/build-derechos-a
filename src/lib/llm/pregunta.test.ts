import { describe, expect, test } from "bun:test";
import type { Ficha, MensajeChat, Perfil } from "@/lib/tipos";
import { elegirPreguntas, TEXTO_PREGUNTA } from "./pregunta";

const vacio: Perfil = { hechos: [], necesidad: null };
const usuario = (texto: string): MensajeChat => ({ rol: "usuario", texto });
const asistente = (texto: string): MensajeChat => ({ rol: "asistente", texto });

describe("preguntas simples y formularios", () => {
  test("un saludo prepara los datos juntos para un formulario", () => {
    const r = elegirPreguntas([], vacio, [usuario("Hola")]);
    expect(r.formulario).toEqual([
      "necesidad", "municipio", "edad", "situacionLaboral", "hijos", "vivienda", "ingresos",
    ]);
    expect(r.pregunta).toBe(r.formulario.map((c) => TEXTO_PREGUNTA[c]).join("\n"));
  });

  test("recupera la conversación tras el antiguo bloque de preguntas", () => {
    const r = elegirPreguntas([], vacio, [
      usuario("Hola"),
      asistente(Object.values(TEXTO_PREGUNTA).join("\n")),
      usuario("Oye, no puedo contestarte a todo así de mal"),
    ]);
    expect(r.formulario[0]).toBe("necesidad");
    expect(r.formulario.length).toBeGreaterThan(1);
    expect(r.pregunta).not.toBeNull();
  });

  test("si conoce la necesidad, no la repite en el formulario", () => {
    const r = elegirPreguntas([], { ...vacio, necesidad: "pagar el alquiler" }, []);
    expect(r.formulario).toEqual([
      "municipio", "edad", "situacionLaboral", "hijos", "vivienda", "ingresos",
    ]);
  });

  test("permite saltarse una pregunta sin volver a pedirla", () => {
    const r = elegirPreguntas([], vacio, [
      asistente(TEXTO_PREGUNTA.necesidad),
      usuario("Prefiero no responder a esta pregunta."),
    ]);
    expect(r.formulario[0]).toBe("municipio");
    expect(r.formulario).not.toContain("necesidad");
  });

  test("sin ningún dato, agotar las preguntas no significa que no haya ayudas", () => {
    const mensajes = Object.values(TEXTO_PREGUNTA).flatMap((p) => [
      asistente(p), usuario("Prefiero no responder a esta pregunta."),
    ]);
    expect(elegirPreguntas([], vacio, mensajes).pregunta).not.toBeNull();
  });

  test("con ayudas solo pide los datos pendientes, no un perfil completo", () => {
    const fichas = [{ pendiente: ["ingresos"] }] as Ficha[];
    expect(elegirPreguntas(fichas, vacio, []).formulario).toEqual(["ingresos"]);
    const r = elegirPreguntas(fichas, vacio, [asistente(TEXTO_PREGUNTA.ingresos)]);
    expect(r.formulario).toEqual([]);
    expect(r.pregunta).toBeNull();
  });

  test("una pregunta simple conserva su texto, sin un cuestionario alrededor", () => {
    const fichas = [{ pendiente: ["ingresos"] }] as Ficha[];
    const r = elegirPreguntas(fichas, vacio, []);
    expect(r.formulario).toEqual(["ingresos"]);
    expect(r.pregunta).toBe(TEXTO_PREGUNTA.ingresos);
  });

  test("varios requisitos pendientes se agrupan sin incluir datos conocidos", () => {
    const fichas = [{ pendiente: ["ingresos", "edad", "hijos"] }] as Ficha[];
    const perfil: Perfil = {
      hechos: [{ campo: "edad", valor: "24", cita: "Tengo 24 años" }],
      necesidad: null,
    };
    expect(elegirPreguntas(fichas, perfil, []).formulario).toEqual(["ingresos", "hijos"]);
  });
});
