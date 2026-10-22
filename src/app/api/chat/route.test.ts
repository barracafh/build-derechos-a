import { describe, expect, test } from "bun:test";
import { POST } from "./route";

// Solo casos 400: no llegan al LLM, así que no usan la red. Las respuestas se
// prueban en src/lib/llm/index.test.ts con un LLM falso.
const pedir = (cuerpo: unknown) =>
  POST(
    new Request("http://x/api/chat", {
      method: "POST",
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    }),
  );

describe("/api/chat", () => {
  test("400 con cuerpo no válido", async () => {
    expect((await pedir("hola")).status).toBe(400);
    expect((await pedir({})).status).toBe(400);
    expect((await pedir({ mensajes: [] })).status).toBe(400);
    expect((await pedir({ mensajes: ["hola"] })).status).toBe(400);
    expect((await pedir({ mensajes: [{ rol: "x", texto: "a" }] })).status).toBe(400);
    expect((await pedir({ mensajes: [{ rol: "usuario", texto: "   " }] })).status).toBe(400);
    const largo = Array.from({ length: 61 }, () => ({ rol: "usuario", texto: "a" }));
    expect((await pedir({ mensajes: largo })).status).toBe(400);
    expect(
      (await pedir({ mensajes: [{ rol: "usuario", texto: "a".repeat(2001) }] })).status,
    ).toBe(400);
  });

  test("400 sin ningún mensaje de la persona", async () => {
    const res = await pedir({ mensajes: [{ rol: "asistente", texto: "hola" }] });
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });
});
