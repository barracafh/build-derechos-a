// Necesidades del ciudadano → palabras de los títulos y finalidades de la BDNS.
// Sirven para ordenar qué fichas se revisan primero, no para descartar.
import { normalizar } from "./nombres";

export const TEMAS = [
  "vivienda",
  "empleo",
  "educacion",
  "familia",
  "mayores",
  "discapacidad",
  "energia",
  "transporte",
  "salud",
  "servicios_sociales",
  "juventud",
  "cultura_deporte",
  "emprendimiento",
] as const;
export type Tema = (typeof TEMAS)[number];

const PALABRAS: Record<Tema, string[]> = {
  vivienda: ["alquiler", "vivienda", "hipoteca", "rehabilit", "alojamiento", "habitatge", "lloguer"],
  empleo: ["empleo", "contratacion", "desemplead", "paro", "trabajo", "ocupacio", "practicas", "insercion"],
  educacion: ["beca", "estudi", "comedor", "libro", "material escolar", "matricula", "universit", "alumn", "escolar", "formacion", "menjador", "llibres"],
  familia: ["familia", "natalidad", "nacimiento", "hijo", "infancia", "menor", "conciliacion", "crianza", "maternidad", "paternidad"],
  mayores: ["mayores", "envejec", "pension", "jubilad", "tercera edad", "persones majors"],
  discapacidad: ["discapacidad", "dependencia", "autonomia personal", "accesibilidad", "diversitat funcional", "diversidad funcional"],
  energia: ["energ", "suministro", "electric", "calefaccion", "eficiencia", "autoconsumo", "placas solares", "fotovolt"],
  transporte: ["transporte", "movilidad", "vehiculo", "bicicleta", "bono bus", "abono"],
  salud: ["salud", "sanitari", "tratamiento", "gafas", "dental", "audifono", "celiac"],
  servicios_sociales: ["emergencia", "social", "vulnerab", "exclusion", "inclusion", "necesidades basicas", "pobreza", "renta minima", "victima"],
  juventud: ["joven", "juventud", "jove", "erasmus", "carne joven"],
  cultura_deporte: ["cultura", "deport", "artes", "musica", "premio", "concurso", "creacion"],
  emprendimiento: ["autonom", "emprend", "negocio", "comercio", "pyme", "empresa"],
};

const FINALIDADES: Record<Tema, string[]> = {
  vivienda: ["vivienda"],
  empleo: ["empleo", "desempleo"],
  educacion: ["educacion"],
  familia: ["servicios sociales", "otras prestaciones"],
  mayores: ["servicios sociales", "otras prestaciones"],
  discapacidad: ["servicios sociales", "sanidad"],
  energia: ["energia"],
  transporte: ["transporte"],
  salud: ["sanidad"],
  servicios_sociales: ["servicios sociales", "otras prestaciones"],
  juventud: [],
  cultura_deporte: ["cultura"],
  emprendimiento: ["comercio", "industria", "empleo"],
};

export function relevancia(
  titulo: string,
  finalidad: string | null,
  temas: Tema[],
  palabras: string[],
): number {
  const t = normalizar(titulo);
  const f = normalizar(finalidad ?? "");
  let puntos = 0;
  for (const tema of temas) {
    if (PALABRAS[tema].some((p) => t.includes(p))) puntos += 2;
    if (f && FINALIDADES[tema].some((p) => f.includes(p))) puntos += 1;
  }
  for (const p of palabras) if (p && t.includes(normalizar(p))) puntos += 3;
  return puntos;
}

// Temas cuyo vocabulario aparece en el título o la finalidad: el «por qué encaja».
export function temasQueEncajan(titulo: string, finalidad: string | null, temas: Tema[]): Tema[] {
  const t = normalizar(titulo);
  const f = normalizar(finalidad ?? "");
  return temas.filter(
    (tema) => PALABRAS[tema].some((p) => t.includes(p)) || (f && FINALIDADES[tema].some((p) => f.includes(p))),
  );
}
