// Herramientas para el agente del chat, en el formato de la API de OpenAI que
// habla HelmCode (`tools` en /chat/completions). El agente las llama y el
// servidor las ejecuta con `ejecutarHerramienta`.
import { buscarAyudas, type ArgsBuscar } from "./buscar";
import { verRequisitos } from "./requisitos";
import { TEMAS, type Tema } from "./temas";

export const HERRAMIENTAS = [
  {
    type: "function",
    function: {
      name: "buscar_ayudas",
      description:
        "Busca ayudas públicas (Estado, comunidad autónoma, diputación o cabildo y ayuntamiento) a las que una persona de un municipio de España podría optar. " +
        "Consulta en vivo la Base de Datos Nacional de Subvenciones, un catálogo de prestaciones (IMV, desempleo, bono social…) y la renta mínima de la comunidad autónoma. " +
        "Devuelve cada ayuda con su estado calculado por fechas: «abierta» solo si las fechas lo demuestran; «por_confirmar» si no se puede asegurar; " +
        "«sin_plazo_fijo» si se puede pedir en cualquier momento; «proximamente» si aún no empieza. Las cerradas se ocultan salvo que se pidan. " +
        "Llámala cuando sepas al menos el municipio o la provincia. Si devuelve `error` con `opciones`, pregunta al ciudadano cuál es. " +
        "Si `quedan_por_revisar` > 0 y hacen falta más, vuelve a llamar con `pagina` + 1.",
      parameters: {
        type: "object",
        properties: {
          municipio: {
            type: "string",
            description: "Municipio donde vive, tal como lo dice (p. ej. «Gandia», «Castellón», «La Laguna»).",
          },
          provincia: {
            type: "string",
            description: "Provincia, si se sabe o si el municipio es ambiguo (p. ej. «Valencia», «Tenerife»).",
          },
          temas: {
            type: "array",
            items: { type: "string", enum: [...TEMAS] },
            description: "Necesidades que ha contado: ordenan qué convocatorias se revisan primero.",
          },
          palabras: {
            type: "array",
            items: { type: "string" },
            description: "Hasta 6 palabras clave concretas que deberían salir en el título (p. ej. «alquiler», «comedor», «gafas»).",
          },
          autonomo: {
            type: "boolean",
            description: "true si trabaja por cuenta propia: incluye ayudas para autónomos.",
          },
          incluir_cerradas: {
            type: "boolean",
            description: "true para ver también las convocatorias cerradas (por defecto se ocultan).",
          },
          pagina: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            description: "Página de resultados: cada página revisa 10 convocatorias más.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_requisitos",
      description:
        "Devuelve el texto oficial literal de hasta 3 ayudas: quién puede pedirlas y requisitos, cuantía, plazo y documentación, con sus enlaces (dónde se piden, convocatoria, bases). " +
        "Usa los `ids` que devuelve buscar_ayudas (p. ej. «bdns:936148», «renta:madrid» o «catalogo:ingreso-minimo-vital»); pide todas las que necesites en una sola llamada. " +
        "Llámala solo para las ayudas que vayas a explicar (puede descargar un PDF). Cita frases del texto; no añadas requisitos que no aparezcan.",
      parameters: {
        type: "object",
        properties: {
          ids: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 3,
            description: "Identificadores devueltos por buscar_ayudas.",
          },
        },
        required: ["ids"],
        additionalProperties: false,
      },
    },
  },
] as const;

export type NombreHerramienta = (typeof HERRAMIENTAS)[number]["function"]["name"];

const texto = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

function leerArgsBuscar(a: Record<string, unknown>): ArgsBuscar | { error: string } {
  const args: ArgsBuscar = {
    municipio: texto(a.municipio, 100),
    provincia: texto(a.provincia, 100),
    temas: Array.isArray(a.temas)
      ? a.temas.filter((t): t is Tema => TEMAS.includes(t as Tema))
      : undefined,
    palabras: Array.isArray(a.palabras)
      ? a.palabras.map((p) => texto(p, 40)).filter((p): p is string => !!p).slice(0, 6)
      : undefined,
    autonomo: a.autonomo === true,
    incluir_cerradas: a.incluir_cerradas === true,
    pagina: Number.isInteger(a.pagina) ? Math.min(10, Math.max(1, a.pagina as number)) : 1,
    // Solo lo pone el servidor (agente del chat), no está en la definición.
    catalogo: a.catalogo === false ? false : undefined,
  };
  if (!args.municipio && !args.provincia)
    return { error: "Falta el municipio o la provincia: pregúntalo antes de buscar." };
  return args;
}

// Ejecuta una llamada del agente. `argumentos` puede llegar como objeto o como
// el texto JSON de `tool_calls[].function.arguments`. Nunca lanza: los fallos
// vuelven como { error } para que el agente se lo explique al ciudadano.
export async function ejecutarHerramienta(nombre: string, argumentos: unknown): Promise<unknown> {
  let a: unknown = argumentos;
  if (typeof a === "string") {
    try {
      a = JSON.parse(a || "{}");
    } catch {
      return { error: "Los argumentos no son JSON válido." };
    }
  }
  if (!a || typeof a !== "object") a = {};
  const obj = a as Record<string, unknown>;
  try {
    switch (nombre) {
      case "buscar_ayudas": {
        const args = leerArgsBuscar(obj);
        return "error" in args ? args : await buscarAyudas(args);
      }
      case "ver_requisitos": {
        // `id` suelto también vale, por si el modelo usa la forma antigua.
        const ids = [...new Set([...(Array.isArray(obj.ids) ? obj.ids : []), obj.id])]
          .map((x) => texto(x, 60))
          .filter((x): x is string => !!x)
          .slice(0, 3);
        if (!ids.length) return { error: "Faltan los ids de las ayudas." };
        return { ayudas: await Promise.all(ids.map((id) => verRequisitos(id))) };
      }
      default:
        return { error: `Herramienta desconocida: ${nombre}` };
    }
  } catch {
    return { error: "No se pudo consultar ahora. Di que no puedes confirmarlo y enlaza la sede oficial." };
  }
}
