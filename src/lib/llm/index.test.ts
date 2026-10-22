import { describe, expect, test } from "bun:test";
import type { Mensaje } from "@/lib/ia";
import type { MensajeChat, Respuesta } from "@/lib/tipos";
import { VERSION_CENTRAL } from "@/lib/motor/central";
import { responder } from "./index";

const hoy = new Date("2026-10-22T10:00:00+02:00");
const usuario = (texto: string): MensajeChat => ({ rol: "usuario", texto });
const ids = (r: Respuesta) => r.fichas.map((f) => f.id);
const usoRespaldo = (r: Respuesta) =>
  r.cobertura.noConsultado.some((t) => t.startsWith("La lectura de tu mensaje"));

// Un LLM falso que responde siempre lo mismo y cuenta sus llamadas.
function llmFalso(respuesta: unknown) {
  const llamadas: Mensaje[][] = [];
  const completar = async (messages: Mensaje[]) => {
    llamadas.push(messages);
    return typeof respuesta === "string" ? respuesta : JSON.stringify(respuesta);
  };
  return { completar, llamadas };
}

const fallaSiempre = async (): Promise<string> => {
  throw new Error("HelmCode respondió 503");
};

// Los 4 perfiles de SETUP.md. El LLM falso se equivoca a propósito (ids inventados,
// ayudas que un dato descarta, citas que no existen): el código tiene que corregirlo.
describe("perfiles de prueba con el LLM", () => {
  test("joven de 24 años en paro, de alquiler en València, sin hijos", async () => {
    const texto = "Tengo 24 años, estoy en paro y vivo de alquiler en València. No tengo hijos.";
    const { completar, llamadas } = llmFalso({
      hechos: [
        { campo: "edad", valor: "24", cita: "24 años" },
        { campo: "situacionLaboral", valor: "en paro", cita: "estoy en paro" },
        { campo: "vivienda", valor: "alquiler", cita: "vivo de alquiler" },
        { campo: "municipio", valor: "València", cita: "València" },
        { campo: "hijos", valor: "0", cita: "No tengo hijos" },
      ],
      necesidad: null,
      elegidos: [
        { id: "bono-alquiler-joven", citas: ["24 años", "vivo de alquiler"] },
        { id: "subsidio-desempleo", citas: ["estoy en paro"] },
        { id: "ingreso-minimo-vital", citas: ["estoy en paro"] },
        { id: "ayudas-comedor-escolar", citas: ["No tengo hijos"] },
        { id: "bono-alquiler-valencia", citas: ["vivo de alquiler"] },
      ],
    });
    const r = await responder([usuario(texto)], { completar, hoy });

    expect(llamadas).toHaveLength(1);
    // Ordenadas por estado: sin fecha límite, sin confirmar, cerrada.
    expect(ids(r)).toEqual(["ingreso-minimo-vital", "subsidio-desempleo", "bono-alquiler-joven"]);
    const bono = r.fichas.find((f) => f.id === "bono-alquiler-joven")!;
    expect(bono.estado).toBe("cerrada");
    expect(bono.porQue).toEqual(["Dices: «24 años».", "Dices: «vivo de alquiler»."]);
    expect(bono.pendiente).toEqual(["ingresos"]);
    expect(bono.detalle?.pasos.length).toBeGreaterThan(0);
    expect(bono.detalle?.ambito).toBe("Comunitat Valenciana");
    expect(r.formulario[0]).toBe("ingresos");
    expect(usoRespaldo(r)).toBe(false);
  });

  test("madre autónoma con 2 hijos en Castelló, ingresos bajos", async () => {
    const texto = "Soy autónoma, tengo 2 hijos y vivo en Castelló. Gano muy poco.";
    const { completar } = llmFalso({
      hechos: [
        { campo: "situacionLaboral", valor: "autónomo", cita: "Soy autónoma" },
        { campo: "hijos", valor: "2", cita: "2 hijos" },
        { campo: "municipio", valor: "Castelló", cita: "Castelló" },
        { campo: "ingresos", valor: "bajos", cita: "Gano muy poco" },
      ],
      necesidad: "Gano muy poco",
      elegidos: [
        { id: "complemento-ayuda-infancia", citas: ["2 hijos", "Gano muy poco"] },
        { id: "ingreso-minimo-vital", citas: ["Gano muy poco"] },
        { id: "ayudas-comedor-escolar", citas: ["2 hijos"] },
        { id: "xarxa-llibres", citas: ["2 hijos"] },
        { id: "bono-alquiler-joven", citas: ["vivo de alquiler"] },
      ],
    });
    const r = await responder([usuario(texto)], { completar, hoy });

    expect(ids(r)).toEqual([
      "xarxa-llibres",
      "ingreso-minimo-vital",
      "complemento-ayuda-infancia",
      "ayudas-comedor-escolar",
    ]);
    expect(r.perfil.necesidad).toBe("Gano muy poco");
    expect(r.cobertura.noConsultado).toContain("Ayudas de tu ayuntamiento");
    expect(r.cobertura.noConsultado).toContain("Ayudas para personas que trabajan por cuenta propia");
  });

  test("jubilado de 70 años en la Safor, pensión mínima, luz cara", async () => {
    const texto =
      "Tengo 70 años, estoy jubilado con la pensión mínima en un pueblo de la Safor y la factura de la luz me sale muy cara.";
    const { completar } = llmFalso({
      hechos: [
        { campo: "edad", valor: "70", cita: "70 años" },
        { campo: "situacionLaboral", valor: "jubilado", cita: "estoy jubilado" },
        { campo: "pension", valor: "mínima", cita: "la pensión mínima" },
        { campo: "municipio", valor: "la Safor", cita: "un pueblo de la Safor" },
      ],
      necesidad: "la factura de la luz me sale muy cara",
      elegidos: [
        { id: "bono-social-electrico", citas: ["la factura de la luz me sale muy cara"] },
        { id: "bono-alquiler-joven", citas: ["70 años"] },
      ],
    });
    const r = await responder([usuario(texto)], { completar, hoy });

    expect(ids(r)).toEqual(["bono-social-electrico"]);
    expect(r.fichas[0].estado).toBe("permanente");
  });

  test("familia con 3 hijos en edad escolar en València", async () => {
    const texto = "Somos una familia con 3 hijos en edad escolar y vivimos en València.";
    const { completar } = llmFalso({
      hechos: [
        { campo: "hijos", valor: "3", cita: "3 hijos" },
        { campo: "municipio", valor: "València", cita: "vivimos en València" },
      ],
      necesidad: null,
      elegidos: [
        { id: "ayudas-comedor-escolar", citas: ["3 hijos en edad escolar"] },
        { id: "xarxa-llibres", citas: ["3 hijos en edad escolar"] },
        { id: "complemento-ayuda-infancia", citas: ["3 hijos"] },
        { id: "ingreso-minimo-vital", citas: ["no llegamos a fin de mes"] },
      ],
    });
    const r = await responder([usuario(texto)], { completar, hoy });

    expect(ids(r)).toEqual(["xarxa-llibres", "complemento-ayuda-infancia", "ayudas-comedor-escolar"]);
    const libros = r.fichas[0];
    expect(libros).toMatchObject({ estado: "abierta", fechaFin: "2026-11-10", pendiente: [] });
    expect(r.formulario[0]).toBe("ingresos");
  });
});

describe("responder", () => {
  test("ningún texto del LLM llega a una ficha salvo las citas", async () => {
    const { completar } = llmFalso({
      elegidos: [
        {
          id: "ingreso-minimo-vital",
          titulo: "IMV de 2.000 € al mes",
          enlace: "https://estafa.example",
          requisitos: ["Ninguno"],
          citas: ["no tengo ingresos"],
        },
      ],
    });
    const r = await responder([usuario("no tengo ingresos")], { completar, hoy });
    expect(r.fichas[0].titulo).not.toContain("2.000");
    expect(r.fichas[0].enlace).toStartWith("https://www.seg-social.es/");
    expect(JSON.stringify(r)).not.toContain("estafa");
    expect(JSON.stringify(r)).not.toContain("Ninguno");
  });

  test("fuera de la Comunitat no propone ayudas de la Generalitat", async () => {
    const { completar } = llmFalso({
      hechos: [{ campo: "municipio", valor: "Madrid", cita: "en Madrid" }],
      elegidos: [
        { id: "renta-valenciana-inclusion", citas: ["no tengo ingresos"] },
        { id: "ingreso-minimo-vital", citas: ["no tengo ingresos"] },
      ],
    });
    const r = await responder([usuario("Vivo en Madrid y no tengo ingresos")], { completar, hoy });
    expect(ids(r)).toEqual(["ingreso-minimo-vital"]);
  });

  test("DANA: sin fichas, sin LLM y con la sede de la Generalitat", async () => {
    const { completar, llamadas } = llmFalso({ elegidos: [] });
    const r = await responder([usuario("Mi casa se perdió en la DANA")], { completar, hoy });
    expect(llamadas).toHaveLength(0);
    expect(r.fichas).toEqual([]);
    expect(r.pregunta).toBeNull();
    expect(r.cobertura.noConsultado.join(" ")).toContain("https://sede.gva.es");
  });

  test("la cobertura dice qué se consultó y qué no", async () => {
    const { completar } = llmFalso({ elegidos: [] });
    const r = await responder([usuario("hola")], { completar, hoy });
    expect(r.cobertura).toEqual({
      consultado: [
        "Catálogo de trámites y ayudas (Estado, Generalitat y Ajuntament de València), a 18/10/2026",
        `Ayudas leídas de páginas oficiales por un proceso automático, a ${VERSION_CENTRAL}`,
      ],
      noConsultado: ["Convocatorias publicadas en la BDNS"],
      respaldo: true,
      fechaConsulta: "2026-10-22",
    });
    // Sin ningún dato ni necesidad, el formulario empieza por qué necesita.
    expect(r.formulario[0]).toBe("necesidad");
  });
});

// Si el LLM no responde bien, el texto se lee con reglas: los 4 perfiles siguen
// dando sus ayudas y cada cita sale literal del texto.
describe("respaldo sin LLM", () => {
  const buscar = (texto: string) =>
    responder([usuario(texto)], { completar: fallaSiempre, hoy });

  test("joven en paro con alquiler en València", async () => {
    const t = "Tengo 24 años, estoy en paro y vivo de alquiler en València";
    const r = await buscar(t);
    expect(usoRespaldo(r)).toBe(true);
    expect(ids(r)).toContain("bono-alquiler-joven");
    expect(r.perfil.hechos.find((h) => h.campo === "edad")?.cita).toBe("Tengo 24");
    for (const h of r.perfil.hechos) expect(t).toContain(h.cita);
  });

  test("jubilado con luz cara", async () => {
    const r = await buscar("Soy jubilado, tengo 70 años, cobro la pensión mínima y la luz es muy cara");
    expect(ids(r)).toContain("bono-social-electrico");
  });

  test("familia con 3 hijos en edad escolar", async () => {
    const r = await buscar("Tengo 3 hijos en edad escolar y vivo en València");
    expect(ids(r)).toContain("xarxa-llibres");
  });

  test("madre con hijos en Castelló e ingresos bajos", async () => {
    const r = await buscar("Tengo 2 hijos en Castelló y ingresos bajos");
    expect(ids(r)).toContain("complemento-ayuda-infancia");
  });
});

describe("reintentos", () => {
  const texto = "No puedo pagar la factura de la luz";
  const bien = { elegidos: [{ id: "bono-social-electrico", citas: ["la factura de la luz"] }] };
  const cuelga = Symbol("cuelga");

  // Cada llamada usa la siguiente respuesta: un Error se lanza y `cuelga` no responde nunca.
  function llmPorTurnos(respuestas: unknown[]) {
    let llamadas = 0;
    const completar = async () => {
      const respuesta = respuestas[llamadas++];
      if (respuesta === cuelga) return new Promise<string>(() => {});
      if (respuesta instanceof Error) throw respuesta;
      return typeof respuesta === "string" ? respuesta : JSON.stringify(respuesta);
    };
    return { completar, llamadas: () => llamadas };
  }
  const pedir = (completar: () => Promise<string>) =>
    responder([usuario(texto)], { completar, hoy, msPorIntento: 20 });

  test.each([
    ["lanza un error", new Error("HelmCode respondió 502")],
    ["no trae JSON", "Lo siento, no puedo."],
    ["tarda demasiado", cuelga],
  ])("si el primer intento %s, el segundo vale", async (_, primera) => {
    const llm = llmPorTurnos([primera, bien]);
    const r = await pedir(llm.completar);
    expect(llm.llamadas()).toBe(2);
    expect(r.fichas[0].porQue).toEqual(["Dices: «la factura de la luz»."]);
    expect(usoRespaldo(r)).toBe(false);
  });

  test("un JSON válido sin fichas no se reintenta", async () => {
    const llm = llmPorTurnos([{ elegidos: [] }, bien]);
    const r = await pedir(llm.completar);
    expect(llm.llamadas()).toBe(1);
    expect(r.fichas).toEqual([]);
  });

  test("si fallan los dos intentos, usa el respaldo", async () => {
    const llm = llmPorTurnos([cuelga, "nada", bien]);
    const r = await pedir(llm.completar);
    expect(llm.llamadas()).toBe(2);
    expect(usoRespaldo(r)).toBe(true);
    expect(ids(r)).toContain("bono-social-electrico");
  });
});
