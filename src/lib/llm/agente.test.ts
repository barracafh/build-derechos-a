import { describe, expect, test } from "bun:test";
import type { ArgsBuscar, AyudaEncontrada, ResultadoBuscar } from "@/lib/ayudas/buscar";
import type { MensajeAgente, RespuestaAgente } from "@/lib/ia";
import type { MensajeChat } from "@/lib/tipos";
import { busquedaDelPerfil, nombrePropio } from "./bdns";
import { responder } from "./index";

const hoy = new Date("2026-10-22T10:00:00+02:00");
const usuario = (texto: string): MensajeChat => ({ rol: "usuario", texto });
const TEXTO = "Tengo 24 años, estoy en paro y vivo de alquiler en Gandia.";

function ayuda(n: number, extra: Partial<AyudaEncontrada> = {}): AyudaEncontrada {
  return {
    id: `bdns:${n}`,
    titulo: `Ayudas al alquiler ${n}`,
    organismo: "AYUNTAMIENTO DE GANDIA",
    nivel: "Local",
    estado: "abierta",
    plazo: "Plazo abierto hasta el 30 de octubre de 2026.",
    fin_plazo: "2026-10-30",
    finalidad: "Vivienda",
    encaja_con: ["vivienda"],
    palabras_en_titulo: [],
    para_quien: ["PERSONAS FÍSICAS QUE NO DESARROLLAN ACTIVIDAD ECONÓMICA"],
    ambito: [],
    aviso: null,
    enlace: `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${n}`,
    enlaces: {
      solicitud: "https://sede.gandia.es/tramite/alquiler",
      sede: null,
      convocatoria: "https://bop.dival.es/anuncio",
      bases: "https://sede.gandia.es/bases.pdf",
      pdf: null,
      ficha: `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${n}`,
    },
    fuente: "bdns",
    ...extra,
  };
}

function resultado(ayudas: AyudaEncontrada[]): ResultadoBuscar {
  return {
    ubicacion: {
      municipio: "Gandia",
      provincia: "Valencia/València",
      comunidad: "Comunitat Valenciana",
      isla: null,
      organismos_locales_consultados: ["Ayuntamiento de Gandia", "DIPUTACIÓN PROVINCIAL DE VALENCIA"],
    },
    fecha_consulta: "22 de octubre de 2026",
    ayudas,
    resumen: { pagina: 1, convocatorias_revisadas: ayudas.length, descartadas: [], cerradas_ocultas: 0, quedan_por_revisar: 0 },
    no_consultado: ["Ayudas para autónomos y empresas (indica autonomo: true si aplica)."],
    respaldo: null,
    origen_datos: "Origen de los datos: Intervención General de la Administración del Estado (BDNS)",
  };
}

const PERFIL = {
  hechos: [
    { campo: "edad", valor: "24", cita: "24 años" },
    { campo: "situacionLaboral", valor: "en paro", cita: "estoy en paro" },
    { campo: "vivienda", valor: "alquiler", cita: "vivo de alquiler" },
    { campo: "municipio", valor: "Gandia", cita: "Gandia" },
  ],
  necesidad: null,
};

// Un agente falso: pide buscar_ayudas en la primera ronda y responde `final` después.
function agenteFalso(final: unknown, llamada = { municipio: "Gandia", temas: ["vivienda"] }) {
  const rondas: MensajeAgente[][] = [];
  const agente = async (messages: MensajeAgente[]): Promise<RespuestaAgente> => {
    rondas.push([...messages]);
    if (rondas.length === 1)
      return {
        content: null,
        tool_calls: [
          { id: "t1", type: "function", function: { name: "buscar_ayudas", arguments: JSON.stringify(llamada) } },
        ],
      };
    return { content: JSON.stringify(final), tool_calls: [] };
  };
  return { agente, rondas };
}

const nuncaCompletar = async (): Promise<string> => {
  throw new Error("no debería llamarse");
};

describe("responder con herramientas", () => {
  test("el agente busca, elige una convocatoria y la ficha sale de la BDNS", async () => {
    const llamadas: { nombre: string; args: unknown }[] = [];
    const ejecutar = async (nombre: string, args: unknown) => {
      llamadas.push({ nombre, args });
      return resultado([ayuda(1), ayuda(2)]);
    };
    const { agente, rondas } = agenteFalso({
      ...PERFIL,
      elegidos: [
        { id: "bdns:2", citas: ["vivo de alquiler"] },
        { id: "bdns:999", citas: ["vivo de alquiler"] },
        { id: "subsidio-desempleo", citas: ["estoy en paro"] },
      ],
    });
    let buscadas = 0;
    const r = await responder([usuario(TEXTO)], {
      completar: nuncaCompletar,
      hoy,
      agente,
      ejecutar,
      buscar: async () => (buscadas++, resultado([])),
      requisitos: async (n) => [`Requisito literal de ${n}`],
    });

    expect(llamadas).toEqual([
      { nombre: "buscar_ayudas", args: { municipio: "Gandia", temas: ["vivienda"], catalogo: false } },
    ]);
    // Solo la búsqueda adelantada mientras el LLM lee.
    expect(buscadas).toBe(1);
    // El resultado vuelve al modelo como mensaje "tool".
    expect(rondas[1].at(-1)).toMatchObject({ role: "tool", tool_call_id: "t1" });
    expect(r.fichas.map((f) => f.id).sort()).toEqual(["bdns:2", "subsidio-desempleo"]);
    const f = r.fichas.find((x) => x.id === "bdns:2")!;
    expect(f).toMatchObject({
      fuente: "bdns",
      administracion: "Local",
      estado: "abierta",
      fechaFin: "2026-10-30",
      verificado: true,
      requisitos: ["Requisito literal de 2"],
      porQue: ["Dices: «vivo de alquiler»."],
    });
    expect(f.detalle?.ambito).toBe("Gandia");
    expect(f.enlace).toBe("https://bop.dival.es/anuncio");
    expect(f.detalle?.enlaceTramite).toBe("https://sede.gandia.es/tramite/alquiler");
    expect(f.detalle?.fuentes.map((x) => x.url)).toEqual([
      "https://bop.dival.es/anuncio",
      ayuda(2).enlace,
      "https://sede.gandia.es/bases.pdf",
    ]);
    expect(r.cobertura.consultado.at(-1)).toContain("Base de Datos Nacional de Subvenciones");
    expect(r.cobertura.noConsultado).not.toContain("Convocatorias publicadas en la BDNS");
    expect(r.cobertura.noConsultado).toContain("Ayudas para autónomos y empresas.");
  });

  test("si el LLM no elige convocatorias, salen las que encajan con plazo comprobado", async () => {
    const ayudas = [
      ayuda(1, { estado: "por_confirmar" }),
      ayuda(2, { estado: "cerrada" }),
      ayuda(3, { encaja_con: [] }),
      // Comparte tema («vivienda») pero es para propietarios de edificios.
      ayuda(6, { titulo: "Subvenciones para el informe de evaluación del edificio de uso residencial" }),
      ayuda(9, {
        titulo:
          "RESOLUCIÓN de la Conselleria de Vivienda, Empleo, Juventud e Igualdad que aprueba subvenciones para limpieza de fachadas",
        encaja_con: ["vivienda", "juventud"],
      }),
      ayuda(4),
      ayuda(5, { estado: "sin_plazo_fijo", nivel: "Comunidad autónoma", organismo: "CONSELLERIA DE VIVIENDA" }),
    ];
    const { agente } = agenteFalso({ ...PERFIL, elegidos: [] });
    const r = await responder([usuario(TEXTO)], {
      completar: nuncaCompletar,
      hoy,
      agente,
      ejecutar: async () => resultado(ayudas),
      buscar: async () => resultado([]),
    });
    expect(r.fichas.map((f) => f.id)).toEqual(["bdns:4", "bdns:5"]);
    const autonomica = r.fichas[1];
    expect(autonomica.estado).toBe("permanente");
    expect(autonomica.detalle?.ambito).toBe("Comunitat Valenciana");
    // Sin texto del boletín, no se inventan requisitos: se remite a las bases.
    expect(r.fichas[0].requisitos[0]).toStartWith("No hemos podido leer los requisitos");
    expect(r.fichas[0].porQue[0]).toBe("Dices: «vivo de alquiler».");
  });

  test("si el agente falla rápido, lee con completar y busca con el perfil", async () => {
    const pedidas: ArgsBuscar[] = [];
    const r = await responder([usuario(TEXTO)], {
      completar: async () => JSON.stringify({ ...PERFIL, elegidos: [] }),
      hoy,
      agente: async () => {
        throw new Error("HelmCode respondió 400");
      },
      buscar: async (args) => (pedidas.push(args), resultado([ayuda(7)])),
    });
    expect(pedidas).toHaveLength(1);
    expect(pedidas[0]).toMatchObject({ municipio: "Gandia", catalogo: false });
    expect(pedidas[0].temas?.sort()).toEqual(["empleo", "juventud", "vivienda"]);
    expect(r.fichas.map((f) => f.id)).toContain("bdns:7");
  });

  test("si el agente se queda sin tiempo, no reintenta y usa las reglas", async () => {
    let completadas = 0;
    const r = await responder([usuario(TEXTO)], {
      completar: async () => (completadas++, "{}"),
      hoy,
      msAgente: 20,
      agente: () => new Promise(() => {}),
      buscar: async () => resultado([ayuda(8)]),
    });
    expect(completadas).toBe(0);
    expect(r.cobertura.noConsultado.some((t) => t.startsWith("La lectura de tu mensaje"))).toBe(true);
    // Las reglas encuentran «Gandia» en la frase y la búsqueda se hace igual.
    expect(r.fichas.map((f) => f.id)).toContain("bdns:8");
  });

  test("sin municipio no busca y lo pregunta", async () => {
    let buscadas = 0;
    const r = await responder([usuario("Estoy en paro y vivo de alquiler")], {
      completar: async () =>
        JSON.stringify({
          hechos: [{ campo: "situacionLaboral", valor: "en paro", cita: "Estoy en paro" }],
          necesidad: null,
          elegidos: [],
        }),
      hoy,
      buscar: async () => (buscadas++, resultado([])),
    });
    expect(buscadas).toBe(0);
    expect(r.formulario).toContain("municipio");
    expect(r.cobertura.noConsultado).toContain(
      "Convocatorias publicadas en la BDNS: falta saber tu municipio",
    );
  });

  test("municipio ambiguo: pregunta cuál, con las opciones", async () => {
    const r = await responder([usuario("Vivo en Villanueva")], {
      completar: async () =>
        JSON.stringify({
          hechos: [{ campo: "municipio", valor: "Villanueva", cita: "Villanueva" }],
          necesidad: null,
          elegidos: [],
        }),
      hoy,
      buscar: async () => ({ error: "Varios", opciones: ["Villanueva (A)", "Villanueva (B)", "Villanueva (C)"] }),
    });
    expect(r.pregunta).toBe("¿En cuál vives: Villanueva (A), Villanueva (B) o Villanueva (C)?");
    expect(r.fichas.filter((f) => f.fuente === "bdns")).toEqual([]);
  });
});

describe("busquedaDelPerfil", () => {
  test("temas y citas salen de los hechos y de la necesidad", () => {
    const b = busquedaDelPerfil({
      hechos: [
        { campo: "municipio", valor: "Adeje", cita: "Adeje" },
        { campo: "situacionLaboral", valor: "autónomo", cita: "soy autónoma" },
        { campo: "hijos", valor: "2", cita: "dos hijos" },
        { campo: "ingresos", valor: "bajos", cita: "gano poco" },
      ],
      necesidad: "no puedo pagar la luz",
    })!;
    expect(b.args).toMatchObject({ municipio: "Adeje", autonomo: true, catalogo: false });
    expect(b.args.temas?.sort()).toEqual(
      ["educacion", "emprendimiento", "energia", "familia", "servicios_sociales"].sort(),
    );
    expect(b.citasPorTema.familia).toEqual(["dos hijos"]);
    expect(b.citasPorTema.energia).toEqual(["no puedo pagar la luz"]);
  });

  test("sin municipio no hay búsqueda", () => {
    expect(busquedaDelPerfil({ hechos: [], necesidad: "alquiler" })).toBeNull();
  });

  test("nombrePropio", () => {
    expect(nombrePropio("AYUNTAMIENTO DE LA VALL D'UIXÓ")).toBe("Ayuntamiento de la Vall d'Uixó");
    expect(nombrePropio("DIPUTACIÓN PROVINCIAL DE VALENCIA")).toBe("Diputación Provincial de Valencia");
  });
});
