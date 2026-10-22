// Estado de cada ayuda del catálogo (datos/catalogo-tramites-ayudas.json, a 18/10/2026).
// El catálogo da el plazo como texto libre; aquí se resume en un estado que la
// interfaz pueda mostrar, con frases cortas (una por línea). Nada de esto se
// inventa: cada línea sale del campo `plazo` de la entrada correspondiente. Si
// el catálogo no confirma un plazo, el estado es «sin-confirmar» y la
// herramienta remite a la información oficial.

export type TipoEstado = "abierta" | "cerrada" | "permanente" | "sin-confirmar";

export type Estado = {
  tipo: TipoEstado;
  lineas: string[];
};

type Definicion =
  | { tipo: "permanente"; lineas: string[] }
  | { tipo: "cerrada"; lineas: string[] }
  | { tipo: "sin-confirmar"; lineas: string[] }
  // Abierta hasta una fecha (inclusive, formato AAAA-MM-DD): a partir del día
  // siguiente pasa a «cerrada» sin tocar el código.
  | { tipo: "hasta"; fin: string; lineas: string[]; lineasCerrada: string[] };

const SIN_PLAZO = [
  "No hemos podido confirmar el plazo de esta ayuda.",
  "Mira el plazo en la información oficial.",
];

const DEFINICIONES: Record<string, Definicion> = {
  "ingreso-minimo-vital": {
    tipo: "permanente",
    lineas: [
      "Puedes pedirla en cualquier momento.",
      "Comprueba en la información oficial que sigue siendo así.",
    ],
  },
  "bono-social-electrico": {
    tipo: "permanente",
    lineas: [
      "Puedes pedirlo en cualquier momento.",
      "El descuento empieza en el periodo de factura en que la empresa recibe tu solicitud completa.",
    ],
  },
  "bono-alquiler-joven": {
    tipo: "cerrada",
    lineas: [
      "El plazo para pedirla terminó el 11 de septiembre de 2026.",
      "Si ya la pediste, todavía puedes entregar documentos.",
    ],
  },
  "ayudas-comedor-escolar": {
    tipo: "cerrada",
    lineas: [
      "El plazo normal está cerrado.",
      "Si empiezas más tarde en el colegio, tienes 10 **días hábiles** desde la matrícula.",
    ],
  },
  "xarxa-llibres": {
    tipo: "hasta",
    fin: "2026-11-10",
    lineas: [
      "El plazo está abierto.",
      "Termina el 10 de noviembre de 2026, incluido.",
    ],
    lineasCerrada: ["El plazo terminó el 10 de noviembre de 2026."],
  },
  "subsidio-desempleo": { tipo: "sin-confirmar", lineas: SIN_PLAZO },
  "complemento-ayuda-infancia": { tipo: "sin-confirmar", lineas: SIN_PLAZO },
  "renta-valenciana-inclusion": {
    tipo: "sin-confirmar",
    lineas: ["No hemos podido confirmar el plazo de esta ayuda."],
  },
};

export function estadoDe(id: string, hoy: Date): Estado {
  const def = DEFINICIONES[id];
  if (!def) return { tipo: "sin-confirmar", lineas: SIN_PLAZO };
  if (def.tipo !== "hasta") return { tipo: def.tipo, lineas: def.lineas };
  // Fecha local en España: se compara el día, no la hora.
  const dia = hoy.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  return dia <= def.fin
    ? { tipo: "abierta", lineas: def.lineas }
    : { tipo: "cerrada", lineas: def.lineasCerrada };
}
