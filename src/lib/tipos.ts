// Contratos de la herramienta (spec 000). Los nombres de campo los fija S0:
// la interfaz, el motor y la ruta se hablan solo con estos tipos.

export type MensajeChat = {
  rol: "usuario" | "asistente";
  texto: string;
};

export type CampoPerfil =
  | "edad"
  | "municipio"
  | "situacionLaboral"
  | "vivienda"
  | "hijos"
  | "ingresos"
  | "pension"
  | "discapacidad";

/** Un dato de la persona y la frase literal suya de la que sale. */
export type Hecho = {
  campo: CampoPerfil;
  valor: string;
  cita: string;
};

export type Perfil = {
  hechos: Hecho[];
  /** Lo que la persona dice que necesita, con sus palabras. */
  necesidad: string | null;
};

export type Ficha = {
  id: string;
  titulo: string;
  finalidad: string;
  fuente: "catalogo" | "bdns" | "pack" | "central";
  administracion: "Estado" | "Comunitat Valenciana" | "Local";
  estado: "abierta" | "cerrada" | "permanente" | "desconocido";
  fechaFin: string | null;
  enlace: string;
  porQue: string[];
  requisitos: string[];
  /** Datos que confirmarían o descartarían la ayuda. */
  pendiente: CampoPerfil[];
  verificado: boolean;
  /**
   * Opcional: lo que traen las ayudas del catálogo (pasos, papeles, dinero,
   * fuentes). Una ficha de otra fuente puede no traerlo y la interfaz lo admite.
   */
  detalle?: DetalleFicha;
};

export type DetalleFicha = {
  /** Nombre del ámbito: «Comunitat Valenciana», «València»… */
  ambito: string | null;
  resumen: string[];
  /** La explicación de cada motivo de `porQue`, en frases cortas. */
  porQueDetalle: string[];
  avisos: string[];
  dinero: { intro: string[]; lista?: string[] } | null;
  /** El plazo, en frases cortas. */
  plazo: string[];
  pasos: string[];
  documentos: string[];
  enlaceTramite: string | null;
  fuentes: { nombre: string; url: string }[];
  /** El texto del catálogo tal cual, que no está en lectura fácil. */
  oficial: {
    titulo: string;
    organismo: string;
    requisitos: string[];
    plazo: string | null;
  };
};

export type Cobertura = {
  consultado: string[];
  noConsultado: string[];
  /** true si los datos salen de una copia con fecha y no de la fuente en vivo. */
  respaldo: boolean;
  fechaConsulta: string;
};

export type Respuesta = {
  perfil: Perfil;
  fichas: Ficha[];
  cobertura: Cobertura;
  /** Una pregunta opcional para afinar la búsqueda. */
  pregunta: string | null;
  /** Los datos que faltan, para preguntarlos todos a la vez en un formulario. */
  formulario: CampoFormulario[];
  /**
   * Opcional: ayudas que tradicionalmente han sido anuales, que el año pasado se
   * abrieron por estas fechas y que este año aún no se han publicado. No se
   * pueden pedir todavía: van aparte de `fichas`.
   */
  recurrentes?: Ficha[];
};

/** Lo que se puede preguntar: un dato del perfil o qué necesita la persona. */
export type CampoFormulario = CampoPerfil | "necesidad";

/** Fase en la que está la búsqueda. Solo una clave fija, nunca texto del LLM. */
export type Paso = "leyendo" | "reintentando" | "comprobando" | "buscando";

/** Cada línea de la respuesta de /api/chat (NDJSON): fases y, al final, la respuesta. */
export type EventoChat = { paso: Paso } | { respuesta: Respuesta };

export type BuscarAyudas = (
  perfil: Perfil,
) => Promise<{ fichas: Ficha[]; cobertura: Cobertura }>;
