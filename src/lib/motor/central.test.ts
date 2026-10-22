import { describe, expect, test } from "bun:test";
import type { Perfil } from "@/lib/tipos";
import { AYUDAS_CENTRALES, coincidencias, estadoCentral, fichaCentral, fichasCentrales, palabras, SIN_PLAZO } from "./central";
import { buscarAyudas } from "./index";
import { IDS_AYUDAS } from "./catalogo";

const perfil = (necesidad: string | null, hechos: Perfil["hechos"] = []): Perfil => ({ hechos, necesidad });

// Una ayuda de prueba con la forma que escribe el job (spec 004, FR-006).
const AYUDA = {
  id: "ayuda-de-prueba-por-dependencia",
  tipo: "ayuda",
  titulo: "Ayuda por dependencia",
  administracion: "Estado",
  organismo: "IMSERSO",
  frases_usuario: ["Cómo solicito la ayuda por dependencia", "Necesito ayuda para cuidar a mi madre"],
  requisitos_clave: ["Tener reconocido el grado de dependencia."],
  pasos: ["Presentar la solicitud en servicios sociales."],
  documentacion: ["DNI"],
  plazo: null,
  enlace_info: "https://imserso.es/ayuda",
  enlace_tramite: null,
  fuente: "https://imserso.es/ayuda; https://imserso.es/guia.pdf",
  verificado: false,
  nota: "Prestaciones para personas en situación de dependencia.",
  tipoPlazo: "sin_plazo" as const,
  fechaInicio: null,
  fechaFin: null,
  plazoListado: null,
};
const HOY = new Date("2026-10-22T12:00:00Z");

describe("palabras", () => {
  test("quita acentos, signos, palabras cortas y vacías", () => {
    expect([...palabras("¿Cómo pido la pensión de incapacidad?")]).toEqual(["pension", "incapacidad"]);
  });
});

describe("fichaCentral", () => {
  test("todo sale del JSON, con fuente central, estado desconocido y sin confirmar", () => {
    const f = fichaCentral(AYUDA, perfil("ayuda por dependencia"), AYUDA.frases_usuario[0]);
    expect(f.fuente).toBe("central");
    expect(f.estado).toBe("desconocido");
    expect(f.fechaFin).toBeNull();
    expect(f.verificado).toBe(false);
    expect(f.enlace).toBe(AYUDA.enlace_info);
    expect(f.requisitos).toEqual(AYUDA.requisitos_clave);
    expect(f.porQue).toEqual(["Dices: «ayuda por dependencia».", "Suele pedirse así: «Cómo solicito la ayuda por dependencia»."]);
    expect(f.detalle?.fuentes.map((x) => x.url)).toEqual(["https://imserso.es/ayuda", "https://imserso.es/guia.pdf"]);
    expect(f.detalle?.pasos).toEqual(AYUDA.pasos);
    expect(f.detalle?.avisos.join(" ")).toContain("Nadie la ha revisado");
  });
  test("sin requisitos avisa de que están en la página oficial", () => {
    const f = fichaCentral({ ...AYUDA, requisitos_clave: [] }, perfil(null), null);
    expect(f.requisitos).toEqual([]);
    expect(f.detalle?.avisos.at(-1)).toContain("requisitos");
  });
});

describe("estadoCentral", () => {
  const F = { ...AYUDA, tipoPlazo: "fechas" as const };
  test("sin_plazo es desconocido y la ficha lo dice", () => {
    expect(estadoCentral(AYUDA, HOY)).toEqual({ estado: "desconocido", fechaFin: null });
    expect(fichaCentral(AYUDA, perfil(null), null, HOY).detalle?.plazo).toEqual([SIN_PLAZO]);
  });
  test("permanente, relativo y de_oficio son permanente y muestran la cita", () => {
    for (const tipoPlazo of ["permanente", "relativo", "de_oficio"] as const) {
      const a = { ...AYUDA, tipoPlazo, plazo: "En cualquier momento." };
      expect(estadoCentral(a, HOY)).toEqual({ estado: "permanente", fechaFin: null });
      expect(fichaCentral(a, perfil(null), null, HOY).detalle?.plazo).toEqual(["En cualquier momento."]);
    }
  });
  test("fechas: cerrada antes de abrir, abierta dentro, cerrada después", () => {
    expect(estadoCentral({ ...F, fechaInicio: "2026-11-01", fechaFin: "2026-11-30" }, HOY)).toEqual({ estado: "cerrada", fechaFin: "2026-11-30" });
    expect(estadoCentral({ ...F, fechaInicio: "2026-10-01", fechaFin: "2026-10-22" }, HOY)).toEqual({ estado: "abierta", fechaFin: "2026-10-22" });
    expect(estadoCentral({ ...F, fechaInicio: "2026-10-01", fechaFin: "2026-10-21" }, HOY)).toEqual({ estado: "cerrada", fechaFin: "2026-10-21" });
    expect(estadoCentral({ ...F, fechaFin: "2026-12-31" }, HOY)).toEqual({ estado: "abierta", fechaFin: "2026-12-31" });
  });
  test("fechas sin fechaFin: el estado del listado, o desconocido", () => {
    const l = { texto: "Solicitud: 04-10-2025 - · Cerrado", inicio: null, fin: null, estado: "Cerrado" };
    expect(estadoCentral({ ...F, plazoListado: l }, HOY).estado).toBe("cerrada");
    expect(estadoCentral({ ...F, plazoListado: { ...l, estado: "Abierto" } }, HOY).estado).toBe("abierta");
    expect(estadoCentral({ ...F, plazoListado: { ...l, estado: null } }, HOY).estado).toBe("desconocido");
  });
  test("un item viejo sin tipoPlazo se deduce de sus fechas", () => {
    expect(estadoCentral({ ...AYUDA, tipoPlazo: undefined, fechaFin: "2026-10-21" }, HOY).estado).toBe("cerrada");
    expect(estadoCentral({ ...AYUDA, tipoPlazo: undefined }, HOY).estado).toBe("desconocido");
  });
  test("la ficha lleva el estado y el texto del listado en el plazo", () => {
    const l = { texto: "Solicitud: 01-10-2026 - 30-11-2026 · Abierto", inicio: "2026-10-01", fin: "2026-11-30", estado: "Abierto" };
    const f = fichaCentral({ ...F, fechaInicio: l.inicio, fechaFin: l.fin, plazoListado: l, plazo: "Hasta el 30 de noviembre." }, perfil(null), null, HOY);
    expect(f.estado).toBe("abierta");
    expect(f.fechaFin).toBe("2026-11-30");
    expect(f.detalle?.plazo).toEqual([l.texto, "Hasta el 30 de noviembre."]);
  });
});

describe("coincidencias", () => {
  test("sin necesidad no propone nada", () => {
    expect(coincidencias(null)).toEqual([]);
    expect(coincidencias("")).toEqual([]);
  });
  test("el almacén del repo carga y no repite ids del catálogo", () => {
    expect(Array.isArray(AYUDAS_CENTRALES)).toBe(true);
    for (const a of AYUDAS_CENTRALES) expect(IDS_AYUDAS).not.toContain(a.id);
  });
});

describe("fichasCentrales", () => {
  test("no repite ids ya propuestos", () => {
    const ids = new Set(AYUDAS_CENTRALES.map((a) => a.id));
    expect(fichasCentrales(perfil("pensión de incapacidad no contributiva"), ids, HOY)).toEqual([]);
  });
  test("fuera de la Comunitat Valenciana solo salen las del Estado", () => {
    const fuera = fichasCentrales(perfil("pensión de incapacidad no contributiva", [{ campo: "municipio", valor: "Madrid", cita: "Madrid" }]), new Set(), HOY);
    expect(fuera.every((f) => f.administracion === "Estado")).toBe(true);
  });
});

describe("buscarAyudas con la fuente central", () => {
  test("las del catálogo van primero y las 4 personas de SETUP.md siguen teniendo catálogo", async () => {
    const perfiles: Perfil[] = [
      perfil("alquiler", [{ campo: "edad", valor: "24", cita: "24" }, { campo: "situacionLaboral", valor: "en paro", cita: "paro" }, { campo: "vivienda", valor: "alquiler", cita: "alquiler" }, { campo: "municipio", valor: "València", cita: "València" }]),
      perfil("ayudas", [{ campo: "situacionLaboral", valor: "autónomo", cita: "autónoma" }, { campo: "hijos", valor: "2", cita: "2 hijos" }, { campo: "ingresos", valor: "bajos", cita: "bajos" }, { campo: "municipio", valor: "Castelló", cita: "Castelló" }]),
      perfil("factura de la luz", [{ campo: "edad", valor: "70", cita: "70" }, { campo: "pension", valor: "mínima", cita: "mínima" }]),
      perfil("colegio", [{ campo: "hijos", valor: "tres o más", cita: "3 hijos" }, { campo: "municipio", valor: "València", cita: "València" }]),
    ];
    for (const p of perfiles) {
      const { fichas } = await buscarAyudas(p);
      expect(fichas.some((f) => f.fuente === "catalogo")).toBe(true);
      const primeraCentral = fichas.findIndex((f) => f.fuente === "central");
      const ultimaCatalogo = fichas.map((f) => f.fuente).lastIndexOf("catalogo");
      if (primeraCentral !== -1) expect(primeraCentral).toBeGreaterThan(ultimaCatalogo);
    }
  });
});
