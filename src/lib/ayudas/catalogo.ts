// Ayudas del catálogo curado (datos/catalogo-tramites-ayudas.json). Cubre lo que
// la BDNS no tiene: IMV, desempleo, bono social… El estado sale del texto de
// plazo del propio catálogo (verificado a 18/10/2026), nunca se supone.
import catalogo from "../../../datos/catalogo-tramites-ayudas.json";
import { calcularEstado, type DatosPlazo, type ResultadoPlazo } from "./plazo";
import type { Tema } from "./temas";
import type { Ubicacion } from "./territorio";

type Entrada = (typeof catalogo.items)[number];

const PROVINCIAS_CV = ["03", "12", "46"];

// Temas de cada ayuda y fechas del plazo copiadas de su campo `plazo`.
const EXTRA: Record<string, { temas: Tema[]; plazo?: Partial<DatosPlazo> }> = {
  "ingreso-minimo-vital": { temas: ["servicios_sociales", "familia"] },
  "subsidio-desempleo": { temas: ["empleo"] },
  "complemento-ayuda-infancia": { temas: ["familia", "servicios_sociales"] },
  "renta-valenciana-inclusion": { temas: ["servicios_sociales"] },
  "bono-social-electrico": { temas: ["energia", "mayores", "servicios_sociales"] },
  "bono-alquiler-joven": {
    temas: ["vivienda", "juventud"],
    plazo: { inicio: "2026-08-24", fin: "2026-09-11" },
  },
  "ayudas-comedor-escolar": { temas: ["educacion", "familia"] },
  "xarxa-llibres": {
    temas: ["educacion", "familia"],
    plazo: { inicio: "2026-06-18", fin: "2026-11-10" },
  },
};

export const ayudasCatalogo = catalogo.items.filter((i) => i.tipo === "ayuda");

export function entradaCatalogo(id: string): Entrada | null {
  return ayudasCatalogo.find((i) => i.id === id) ?? null;
}

export function aplicaEn(e: Entrada, u: Ubicacion): boolean {
  if (e.administracion === "Estado") return true;
  if (e.administracion === "Generalitat Valenciana") return PROVINCIAS_CV.includes(u.ineProvincia);
  return false;
}

export function estadoCatalogo(e: Entrada, hoy: string): ResultadoPlazo {
  const extra = EXTRA[e.id]?.plazo;
  if (extra)
    return calcularEstado(
      { inicio: null, fin: null, abierto: null, textoInicio: null, textoFin: null, publicaciones: [], ...extra },
      hoy,
    );
  if (e.plazo && /en cualquier momento/i.test(e.plazo))
    return { estado: "sin_plazo_fijo", motivo: e.plazo, fin: null };
  return {
    estado: "por_confirmar",
    motivo: e.plazo ? `Según el catálogo: «${e.plazo}»` : "El catálogo no fija un plazo: confírmalo en la sede.",
    fin: null,
  };
}

export const temasCatalogo = (id: string): Tema[] => EXTRA[id]?.temas ?? [];

export const CATALOGO_VERSION = catalogo.version;
