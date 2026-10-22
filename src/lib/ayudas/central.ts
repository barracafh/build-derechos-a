// Ayudas centrales (src/datos/central.json, el almacén del job nocturno) para
// las herramientas del agente: dónde aplican, su estado y sus enlaces. La
// lectura del JSON y el estado son los de lib/motor/central; aquí solo se
// adaptan al formato de buscar_ayudas y ver_requisitos.
import { normalizar } from "@/lib/lugares";
import { AYUDAS_CENTRALES, estadoCentral, SIN_PLAZO, type AyudaCentral } from "@/lib/motor/central";
import type { Enlaces } from "./convocatoria";
import type { ResultadoPlazo } from "./plazo";
import { palabrasEnTitulo, relevancia, temasQueEncajan, type Tema } from "./temas";
import type { Ubicacion } from "./territorio";

export { AYUDAS_CENTRALES, VERSION_CENTRAL, type AyudaCentral } from "@/lib/motor/central";

const PROVINCIAS_CV = ["03", "12", "46"];

export const centralPorId = (id: string): AyudaCentral | null =>
  AYUDAS_CENTRALES.find((a) => a.id === id) ?? null;

// Las del Estado, en toda España; las de la Generalitat, en la Comunitat
// Valenciana; las locales son del Ajuntament de València.
export function centralAplicaEn(a: AyudaCentral, u: Ubicacion): boolean {
  if (a.administracion === "Estado") return true;
  if (a.administracion === "Comunitat Valenciana" || a.administracion.startsWith("Generalitat"))
    return PROVINCIAS_CV.includes(u.ineProvincia);
  return u.ineProvincia === "46" && normalizar(u.municipio ?? "").trim() === "valencia";
}

// El mismo estado que la ficha (lib/motor/central), con el texto del plazo.
export function estadoAyudaCentral(a: AyudaCentral, hoy: string): ResultadoPlazo {
  const { estado, fechaFin } = estadoCentral(a, new Date(`${hoy}T12:00:00Z`));
  const texto = [a.plazoListado?.texto, a.plazo].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
  const inicio = a.fechaInicio ?? a.plazoListado?.inicio ?? null;
  if (estado === "abierta") return { estado: "abierta", motivo: texto || `Abierta hasta el ${fechaFin}.`, fin: fechaFin };
  if (estado === "cerrada") return { estado: "cerrada", motivo: texto || "Plazo terminado.", fin: fechaFin };
  // «Relativo» (tres meses desde el nacimiento, desde la baja…) no es «en
  // cualquier momento»: depende de la fecha de cada persona.
  if (a.tipoPlazo === "relativo")
    return {
      estado: "por_confirmar",
      motivo: texto
        ? `El plazo cuenta desde un hecho de cada persona y suele ser corto: si encaja, que la pida cuanto antes. Según la página oficial: «${texto}»`
        : "El plazo cuenta desde un hecho de cada persona y suele ser corto: si encaja, que la pida cuanto antes y lo confirme en la página oficial.",
      fin: null,
    };
  if (estado === "permanente")
    return {
      estado: "sin_plazo_fijo",
      motivo: texto ? `Según la página oficial: «${texto}»` : "Sin plazo fijo según la página oficial.",
      fin: null,
    };
  if (inicio && hoy < inicio)
    return { estado: "proximamente", motivo: `Abre el ${inicio.split("-").reverse().join("/")}.`, fin: fechaFin };
  return {
    estado: "por_confirmar",
    motivo: texto ? `Según la página oficial: «${texto}». Confírmalo.` : `${SIN_PLAZO} Confírmalo en la sede.`,
    fin: null,
  };
}

export const enlacesCentral = (a: AyudaCentral): Enlaces => ({
  solicitud: a.enlace_tramite,
  sede: null,
  convocatoria: null,
  bases: null,
  pdf: null,
  ficha: a.enlace_info,
});

// Temas que encajan: los del título y, de las frases con que la gente la pide,
// solo los que salen en dos o más (una sola, «tengo asbestosis por el trabajo»,
// no hace de «Amianto» una ayuda de empleo).
export function temasCentral(a: AyudaCentral, temas: Tema[]): Tema[] {
  const frases = a.frases_usuario ?? [];
  return temas.filter(
    (t) =>
      temasQueEncajan(a.titulo, null, [t]).length > 0 ||
      frases.filter((f) => temasQueEncajan(f, null, [t]).length > 0).length >= 2,
  );
}

// Como `relevancia`, con los temas de arriba y las palabras clave también en las frases.
export function puntosCentral(a: AyudaCentral, temas: Tema[], palabras: string[]): number {
  const enTitulo = relevancia(a.titulo, null, temas, palabras);
  const deFrases = temasCentral(a, temas).filter((t) => !temasQueEncajan(a.titulo, null, [t]).length).length;
  const frases = (a.frases_usuario ?? []).join(" · ");
  const palabrasFrases = palabrasEnTitulo(frases, palabras).filter((p) => !palabrasEnTitulo(a.titulo, [p]).length);
  return enTitulo + deFrases + palabrasFrases.length * 2;
}

export const AVISO_CENTRAL =
  "Sacada de la página oficial por un programa y sin revisar: dilo y remite al enlace oficial.";
