import { describe, expect, test } from "bun:test";
import { calcularEstado, leerDuracion, sumarHabiles, type DatosPlazo } from "./plazo";

const HOY = "2026-10-22"; // jueves
const plazo = (p: Partial<DatosPlazo>): DatosPlazo => ({
  inicio: null,
  fin: null,
  abierto: null,
  textoInicio: null,
  textoFin: null,
  publicaciones: [],
  ...p,
});

describe("con fechas", () => {
  test("abierta entre inicio y fin, ambos incluidos", () => {
    expect(calcularEstado(plazo({ inicio: "2026-10-01", fin: "2026-10-22" }), HOY).estado).toBe("abierta");
    expect(calcularEstado(plazo({ inicio: "2026-10-22", fin: "2026-11-01" }), HOY).estado).toBe("abierta");
  });
  test("cerrada si el fin ya pasó, aunque `abierto` sea true", () => {
    expect(calcularEstado(plazo({ inicio: "2026-09-01", fin: "2026-10-21", abierto: true }), HOY).estado).toBe("cerrada");
  });
  test("próximamente si aún no empieza", () => {
    expect(calcularEstado(plazo({ inicio: "2026-10-30", fin: "2026-11-27" }), HOY).estado).toBe("proximamente");
  });
  test("solo fin futuro y sin pista de inicio: por confirmar", () => {
    expect(calcularEstado(plazo({ fin: "2026-11-06", textoInicio: "no procede" }), HOY).estado).toBe("por_confirmar");
  });
});

describe("sin fechas", () => {
  test("`abierto` solo significa sin plazo fijo", () => {
    expect(calcularEstado(plazo({ abierto: true }), HOY).estado).toBe("sin_plazo_fijo");
  });
  test("«Sin plazo de solicitud» no se puede solicitar", () => {
    const p = plazo({ textoInicio: "SIN PLAZO DE SOLICITUD", textoFin: "SIN PLAZO DE SOLICITUD" });
    expect(calcularEstado(p, HOY).estado).toBe("no_solicitable");
  });
  test("solo texto sin fecha de publicación: por confirmar, nunca abierta", () => {
    const p = plazo({ textoInicio: "Dia siguiente publicacion BOJA", textoFin: "10 días naturales" });
    expect(calcularEstado(p, HOY).estado).toBe("por_confirmar");
  });
});

describe("plazo contado desde la publicación", () => {
  const boe = (fecha: string) => [{ fecha, diario: "BOE" }];
  const veinteHabiles = {
    textoInicio: "El día siguiente al de la publicación del extracto de la convocatoria en BOE",
    textoFin: "20 días hábiles",
  };

  test("20 días hábiles publicados hoy: abierta", () => {
    const r = calcularEstado(plazo({ ...veinteHabiles, publicaciones: boe("2026-10-21") }), HOY);
    expect(r.estado).toBe("abierta");
    expect(r.fin).toBe("2026-11-18");
  });
  test("publicada hoy: el plazo empieza mañana", () => {
    expect(calcularEstado(plazo({ ...veinteHabiles, publicaciones: boe(HOY) }), HOY).estado).toBe("proximamente");
  });
  test("muy lejos del fin: cerrada", () => {
    expect(calcularEstado(plazo({ ...veinteHabiles, publicaciones: boe("2026-07-01") }), HOY).estado).toBe("cerrada");
  });
  test("cerca del fin con festivos posibles: por confirmar", () => {
    // 20 hábiles desde el 22/09 → como pronto 20/10; como tarde 30/10.
    expect(calcularEstado(plazo({ ...veinteHabiles, publicaciones: boe("2026-09-22") }), HOY).estado).toBe("por_confirmar");
  });
  test("días sin calificar se cuentan como naturales para el mínimo", () => {
    const p = plazo({ textoInicio: "PUBLICACION BOP", textoFin: "30 Dias", publicaciones: boe("2026-09-25") });
    // 30 naturales desde el 25/09 = 25/10: hoy aún dentro con seguridad.
    expect(calcularEstado(p, HOY)).toMatchObject({ estado: "abierta", fin: "2026-10-25" });
  });
  test("un mes desde la publicación", () => {
    const p = plazo({
      textoInicio: "Des de l'endemà de la publicació en el diari oficial",
      textoFin: "1 Mesos",
      publicaciones: boe("2026-10-01"),
    });
    expect(calcularEstado(p, HOY)).toMatchObject({ estado: "abierta", fin: "2026-11-01" });
  });
  test("«bono» en el texto no se toma por un boletín", () => {
    const p = plazo({ textoFin: "Bono de 15 días", publicaciones: boe("2026-10-20") });
    expect(calcularEstado(p, HOY).estado).toBe("por_confirmar");
  });
});

describe("duraciones escritas", () => {
  test.each([
    ["Quince días hábiles a partir del siguiente", 15, "habiles"],
    ["15 dies hàbils a partir de l'endemà", 15, "habiles"],
    ["Diez días (10) naturales a contar desde", 10, "naturales"],
    ["QUINCE DÍAS DESPUES", 15, "dias"],
    ["1 Mesos", 1, "meses"],
  ])("%s", (texto, n, unidad) => {
    expect(leerDuracion(texto)).toEqual({ n, unidad } as never);
  });
  test("los hábiles saltan fines de semana", () => {
    expect(sumarHabiles("2026-10-23", 1)).toBe("2026-10-26"); // viernes → lunes
  });
});
