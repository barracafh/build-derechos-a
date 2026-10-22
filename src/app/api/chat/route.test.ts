import { describe, expect, test } from "bun:test";
import { POST } from "./route";
import type { Respuesta } from "@/lib/tipos";

const pedir = (cuerpo: unknown) =>
  POST(
    new Request("http://x/api/chat", {
      method: "POST",
      body: JSON.stringify(cuerpo),
    }),
  );
const buscar = async (texto: string) =>
  (await (await pedir({ mensajes: [{ rol: "usuario", texto }] })).json()) as Respuesta;

describe("/api/chat", () => {
  test("400 con cuerpo no válido", async () => {
    expect((await pedir({})).status).toBe(400);
    expect((await pedir({ mensajes: [] })).status).toBe(400);
    expect((await pedir({ mensajes: [{ rol: "x", texto: "a" }] })).status).toBe(400);
    const largo = Array.from({ length: 21 }, () => ({ rol: "usuario", texto: "a" }));
    expect((await pedir({ mensajes: largo })).status).toBe(400);
    expect(
      (await pedir({ mensajes: [{ rol: "usuario", texto: "a".repeat(2001) }] })).status,
    ).toBe(400);
  });

  test("joven en paro con alquiler en València", async () => {
    const r = await buscar("Tengo 24 años, estoy en paro y vivo de alquiler en València");
    const ids = r.fichas.map((f) => f.id);
    expect(ids).toContain("bono-alquiler-joven");
    expect(r.perfil.hechos.find((h) => h.campo === "edad")?.cita).toBe("Tengo 24");
  });

  test("jubilado con luz cara", async () => {
    const r = await buscar("Soy jubilado, tengo 70 años, cobro la pensión mínima y la luz es muy cara");
    expect(r.fichas.map((f) => f.id)).toContain("bono-social-electrico");
  });

  test("familia con 3 hijos en edad escolar", async () => {
    const r = await buscar("Tengo 3 hijos en edad escolar y vivo en València");
    expect(r.fichas.map((f) => f.id)).toContain("xarxa-llibres");
  });

  test("madre con hijos en Castelló e ingresos bajos", async () => {
    const r = await buscar("Tengo 2 hijos en Castelló y ingresos bajos");
    expect(r.fichas.map((f) => f.id)).toContain("complemento-ayuda-infancia");
  });

  test("DANA: sin fichas y enlace a la sede", async () => {
    const r = await buscar("Mi casa se perdió en la DANA");
    expect(r.fichas).toEqual([]);
    expect(r.cobertura.noConsultado.join(" ")).toContain("sede.gva.es");
  });

  test("cada cita sale literal del texto", async () => {
    const t = "Tengo 24 años, estoy en paro y vivo de alquiler en València";
    const r = await buscar(t);
    for (const h of r.perfil.hechos) expect(t).toContain(h.cita);
  });
});
