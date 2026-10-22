import type { CampoFormulario, CampoPerfil, Ficha, MensajeChat, Perfil } from "@/lib/tipos";

// Las preguntas las elige el código, no el modelo. Si falta más de un dato,
// la interfaz los presenta juntos en un formulario, nunca como un párrafo.

export const TEXTO_PREGUNTA: Record<CampoFormulario, string> = {
  necesidad: "¿Qué necesitas? Por ejemplo, pagar el alquiler, la luz o los libros del colegio.",
  edad: "¿Cuántos años tienes?",
  municipio: "¿En qué municipio vives?",
  situacionLaboral: "¿Trabajas ahora o estás en paro?",
  vivienda: "¿Vives de alquiler, en una casa tuya o de otra forma?",
  hijos: "¿Tienes hijos? ¿Cuántos?",
  ingresos: "¿Cuánto dinero entra en tu casa cada mes, más o menos?",
  pension: "¿Cobras alguna pensión?",
  discapacidad: "¿Tienes alguna discapacidad?",
};

// Valores cerrados: el formulario los ofrece como opciones, la interfaz los
// muestra tal cual y el motor los entiende.
export const OPCIONES: Partial<Record<CampoPerfil, string[]>> = {
  situacionLaboral: ["en paro", "paro agotado", "trabajando", "autónomo", "jubilado", "estudiando", "otra"],
  vivienda: ["alquiler", "habitación", "propiedad", "otra"],
  // Lo que entra al mes en todo el hogar, en tramos del IPREM (600 €/mes en
  // 2026), la referencia de casi todas las ayudas. «bajos», para quien lo dice
  // así, sin cantidad.
  ingresos: [
    "sin ingresos",
    "menos de 600 €",
    "de 600 a 1.200 €",
    "de 1.200 a 1.800 €",
    "más de 1.800 €",
    "bajos",
  ],
};

// Hasta 2 veces el IPREM cuenta como pocos ingresos para proponer el IMV, el
// CAPI, la renta de la comunidad o el bono social: sus límites crecen con cada
// miembro del hogar. Los requisitos se comprueban en la sede.
export const INGRESOS_BAJOS = ["bajos", "menos de 600 €", "de 600 a 1.200 €"];

// Los datos que deciden las ayudas del catálogo, en el orden en que se piden
// después de los que piden las fichas.
const BASICOS: CampoPerfil[] = [
  "municipio",
  "edad",
  "situacionLaboral",
  "hijos",
  "vivienda",
  "ingresos",
];

// Primero la necesidad; después, lo que falta para buscar o afinar las fichas.
// Las preguntas individuales se pueden saltar. Los antiguos cuestionarios en
// bloque no cuentan como preguntas atendidas: permiten retomar la conversación.
export function elegirPreguntas(
  fichas: Ficha[],
  perfil: Perfil,
  mensajes: MensajeChat[],
): { formulario: CampoFormulario[]; pregunta: string | null } {
  const hechas = new Set(
    mensajes.filter((m) => m.rol === "asistente").flatMap((m) => {
      const campos = (Object.keys(TEXTO_PREGUNTA) as CampoFormulario[])
        .filter((c) => m.texto.includes(TEXTO_PREGUNTA[c]));
      return campos.length === 1 ? campos : [];
    }),
  );
  const libre = (c: CampoFormulario) => !hechas.has(c);
  const conocidos = new Set(perfil.hechos.map((h) => h.campo));

  const cuenta = new Map<CampoPerfil, number>();
  for (const f of fichas) for (const c of f.pendiente) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  const porFichas = [...cuenta].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const candidatas = fichas.length ? porFichas : [...porFichas, ...BASICOS];
  const formulario: CampoFormulario[] = [...new Set(candidatas)].filter(
    (c) => !conocidos.has(c) && libre(c),
  );
  if (!perfil.necesidad && !perfil.hechos.length && fichas.length === 0 && libre("necesidad"))
    formulario.unshift("necesidad");

  return {
    formulario,
    pregunta: formulario.length
      ? formulario.map((c) => TEXTO_PREGUNTA[c]).join("\n")
      : fichas.length === 0 && !perfil.hechos.length && !perfil.necesidad
        ? "Todavía no tengo información para buscar ayudas. Cuando quieras, cuéntame qué necesitas, sin datos personales."
        : null,
  };
}
