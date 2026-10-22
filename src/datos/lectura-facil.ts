// Textos de cada ayuda adaptados a un lenguaje sencillo, siguiendo las pautas de
// la norma UNE 153101 EX (lectura fácil): frases cortas, una idea por frase,
// presente, sin paréntesis ni abreviaturas sin explicar.
//
// Cada línea sale del campo correspondiente de datos/catalogo-tramites-ayudas.json
// (requisitos_clave, pasos, documentacion y nota). No se añade ningún importe,
// plazo ni requisito que el catálogo no tenga. Si algo es largo o tiene muchas
// excepciones, el texto lo dice y remite a la información oficial.
//
// Convenciones:
// - `**palabra**` marca una palabra difícil. Debe existir en GLOSARIO: la
//   interfaz la pone en negrita y la explica en «Palabras importantes».
// - Una línea que empieza por dos espacios es un punto de la lista anterior.

export const GLOSARIO: Record<string, string> = {
  subsidio: "Un subsidio es una ayuda de dinero que da el Estado.",
  SEPE: "El SEPE es el Servicio Público de Empleo Estatal. Gestiona el paro y los subsidios.",
  "demandante de empleo":
    "Una persona demandante de empleo está apuntada en la oficina de empleo. Busca trabajo.",
  Labora: "Labora es el servicio de empleo de la Comunitat Valenciana.",
  "Cl@ve":
    "Cl@ve es una forma de identificarte por internet ante la Administración.",
  "certificado digital":
    "Un certificado digital es un archivo que te identifica por internet.",
  "sede electrónica":
    "La sede electrónica es la página web donde haces trámites con una administración.",
  "declaración responsable":
    "Una declaración responsable es un papel donde dices que lo que cuentas es verdad. Tú te haces responsable.",
  NIE: "El NIE es el número de identidad que tienen las personas extranjeras en España.",
  INSS: "El INSS es el Instituto Nacional de la Seguridad Social. Gestiona esta ayuda.",
  IMV: "El IMV es el Ingreso Mínimo Vital. Es una ayuda de dinero cada mes para hogares con pocos recursos.",
  CAPI: "El CAPI es el Complemento de Ayuda para la Infancia. Es dinero extra cada mes por cada hijo o hija.",
  RVI: "La RVI es la Renta Valenciana de Inclusión. Es una ayuda de dinero de la Generalitat para personas con muchas dificultades para vivir.",
  "unidad de convivencia": "La unidad de convivencia son las personas que viven juntas en la misma casa.",
  patrimonio:
    "El patrimonio es lo que tienes, como el dinero en el banco o las propiedades.",
  "declaración de la renta":
    "La declaración de la renta es el papel que presentas cada año a Hacienda. Cuenta cuánto dinero has ganado.",
  empadronado:
    "Estás empadronado cuando tu nombre está en el padrón. El padrón es la lista de personas que viven en un municipio.",
  Generalitat: "La Generalitat es el gobierno de la Comunitat Valenciana.",
  Conselleria:
    "Una conselleria es un departamento del gobierno de la Generalitat.",
  "servicios sociales":
    "Los servicios sociales del ayuntamiento atienden a las personas que necesitan apoyo.",
  "alta laboral":
    "Estás de alta laboral cuando trabajas y la Seguridad Social lo sabe.",
  "bono social":
    "El bono social eléctrico es un descuento en la factura de la luz.",
  "consumidores vulnerables":
    "Un consumidor vulnerable es una persona que cumple unas condiciones. Tiene derecho a un descuento en la luz.",
  "consumidor vulnerable":
    "Un consumidor vulnerable es una persona que cumple unas condiciones. Tiene derecho a un descuento en la luz.",
  PVPC: "El PVPC es un tipo de contrato de luz con un precio que controla el Estado.",
  "comercializadora de referencia":
    "Una comercializadora de referencia es una empresa de luz. Solo estas empresas dan el bono social.",
  "días hábiles":
    "Los días hábiles son los días de trabajo. No cuentan los sábados, los domingos ni los festivos.",
  "Banco de Libros":
    "El Banco de Libros presta libros de texto a las familias. Al final del curso hay que devolverlos.",
  DANA: "La DANA es una tormenta muy fuerte con mucha lluvia.",
};

export type Dinero = { intro: string[]; lista?: string[] };

export type Adaptada = {
  nombre: string;
  /** Quién la da, en pocas palabras. */
  quien: "Del Estado" | "De la Generalitat";
  resumen: string[];
  dinero?: Dinero;
  requisitos: string[];
  pasos: string[];
  documentos: string[];
};

export const ADAPTADAS: Record<string, Adaptada> = {
  "subsidio-desempleo": {
    nombre: "Subsidio por desempleo",
    quien: "Del Estado",
    resumen: [
      "El **subsidio** por desempleo es una ayuda de dinero.",
      "Es para personas en paro que no tienen ingresos suficientes.",
      "Lo gestiona el **SEPE**.",
    ],
    requisitos: [
      "Estás en paro.",
      "Te has apuntado como **demandante de empleo**.",
      "No tienes ingresos suficientes.",
      "+ Lo puedes demostrar con una **declaración responsable**.",
      "Desde noviembre de 2024 pueden pedirlo más personas.",
      "+ Por ejemplo, personas de menos de 45 años sin responsabilidades familiares.",
      "+ Hay más casos. Mira la información oficial.",
    ],
    pasos: [
      "Sigue apuntado como **demandante de empleo** en **Labora**.",
      "Pide el subsidio en la **sede electrónica** del **SEPE**.",
      "+ Puedes entrar con **Cl@ve**, con **certificado digital** o con DNI electrónico.",
      "Renueva el subsidio cada 3 meses.",
    ],
    documentos: [
      "Tu DNI o **NIE**.",
      "La **declaración responsable** de tus ingresos.",
      "Los papeles que diga el justificante de la solicitud.",
    ],
  },

  "ingreso-minimo-vital": {
    nombre: "Ingreso Mínimo Vital",
    quien: "Del Estado",
    resumen: [
      "El **IMV** es una ayuda de dinero cada mes.",
      "Es para hogares con pocos ingresos y pocos bienes.",
      "Lo gestiona el **INSS**.",
    ],
    dinero: {
      intro: [
        "Para una persona adulta que vive sola, la cantidad es de hasta 733,60 euros al mes.",
        "Si vives con más personas, la cantidad puede ser mayor.",
      ],
    },
    requisitos: [
      "Vives en España de forma legal desde hace al menos 1 año.",
      "+ Hay excepciones.",
      "Los ingresos de tu hogar son bajos.",
      "+ La ley fija el límite.",
      "No tienes mucho **patrimonio**.",
      "+ La casa donde vives no cuenta.",
      "Tienes 23 años o más.",
      "+ Hay excepciones.",
      "Tu **unidad de convivencia** existe desde hace al menos 6 meses.",
    ],
    pasos: [
      "Haz la prueba en el simulador de la web imv.seg-social.es.",
      "Pide la ayuda por internet en la **sede electrónica** de la Seguridad Social.",
      "+ Hay una forma de pedirla sin **certificado digital**.",
      "Si el **INSS** te lo pide, entrega más papeles.",
      "Cuando te den la ayuda, presenta cada año la **declaración de la renta**.",
    ],
    documentos: [
      "DNI o **NIE** de las personas de tu hogar.",
      "Los papeles que pida el **INSS**.",
    ],
  },

  "complemento-ayuda-infancia": {
    nombre: "Complemento de Ayuda para la Infancia",
    quien: "Del Estado",
    resumen: [
      "El **CAPI** es dinero extra cada mes por cada hijo o hija.",
      "Es para hogares con menores y con pocos ingresos.",
      "Lo gestiona el **INSS**.",
    ],
    dinero: {
      intro: ["Cada mes, por cada hijo o hija, puedes recibir:"],
      lista: [
        "115 euros si tiene menos de 3 años.",
        "80,50 euros si tiene de 3 a 6 años.",
        "57,50 euros si tiene de 6 a 18 años.",
      ],
    },
    requisitos: [
      "En tu hogar viven menores.",
      "Tu hogar cumple los requisitos generales del **IMV**.",
      "Tus ingresos son bajos.",
      "+ El límite de ingresos es más alto que el del **IMV**.",
      "Puedes recibirlo aunque no tengas derecho al **IMV**.",
      "No puedes cobrarlo a la vez que la asignación por hijo a cargo.",
      "+ Hay excepciones si tu hijo o hija tiene una discapacidad.",
    ],
    pasos: [
      "Usa el simulador de la web imv.seg-social.es.",
      "+ Pulsa Iniciar solicitud.",
      "+ El simulador te dice si puedes tener derecho solo al **CAPI**.",
      "Presenta una solicitud del **IMV**.",
      "+ Con esa solicitud puedes pedir el **CAPI** solo o junto al **IMV**.",
      "Presenta cada año la **declaración de la renta**.",
    ],
    documentos: [
      "DNI o **NIE** de las personas de tu hogar.",
      "Los papeles que pida el **INSS**.",
    ],
  },

  "renta-valenciana-inclusion": {
    nombre: "Renta Valenciana de Inclusión",
    quien: "De la Generalitat",
    resumen: [
      "La **RVI** es una ayuda de dinero de la **Generalitat**.",
      "Es para personas con muchas dificultades para vivir.",
    ],
    dinero: {
      intro: ["Para una persona sola, la cantidad máxima es 793,80 euros al mes."],
    },
    requisitos: [
      "Estás **empadronado** en la Comunitat Valenciana.",
      "+ Llevas 15 meses seguidos antes de pedirla.",
      "+ O llevas 5 años en los últimos 10 años.",
      "+ Hay excepciones.",
      "Tienes 23 años o más.",
      "+ Si tienes de 23 a 30 años, vives de forma independiente desde hace 2 años.",
      "+ Hay excepciones.",
      "No estás de **alta laboral**.",
      "Los ingresos de las personas que viven contigo son bajos.",
      "No tienes **patrimonio** suficiente.",
      "Has pedido antes las otras ayudas a las que tienes derecho.",
      "+ Por ejemplo, el **IMV**.",
      "Los **servicios sociales** dicen que estás en situación de vulnerabilidad.",
      "Firmas un acuerdo de inclusión.",
    ],
    pasos: [
      "Pide información en los **servicios sociales** de tu barrio.",
      "+ O llama al 012.",
      "Presenta la solicitud, mejor por internet.",
      "+ También puedes presentarla en los **servicios sociales** o en el registro del ayuntamiento.",
      "Los **servicios sociales** hacen un informe en 1 mes como máximo.",
      "+ Después decide la **Generalitat**.",
      "La ayuda dura 6 años al principio.",
      "+ Después tienes que renovarla cada 3 años.",
    ],
    documentos: [
      "No tienes que entregar los papeles que la Administración puede consultar.",
      "+ Antes tienes que darle permiso.",
      "Los demás papeles los dicen los **servicios sociales**.",
    ],
  },

  "bono-social-electrico": {
    nombre: "Bono social eléctrico",
    quien: "Del Estado",
    resumen: [
      "El **bono social** es un descuento en la factura de la luz.",
      "Es para **consumidores vulnerables**.",
    ],
    dinero: {
      intro: [
        "Hay dos descuentos.",
        "Uno es para consumidores vulnerables.",
        "Otro, más grande, es para consumidores vulnerables severos.",
        "Si estás en riesgo de exclusión social y te atienden los **servicios sociales**, no pagas la factura.",
        "Tampoco te pueden cortar la luz.",
      ],
    },
    requisitos: [
      "El contrato de luz es de la casa donde vives.",
      "La potencia que tienes contratada es de 10 kilovatios o menos.",
      "Tienes un contrato **PVPC** con una **comercializadora de referencia**.",
      "+ O puedes cambiarte a ese contrato.",
      "Eres **consumidor vulnerable**.",
      "+ Tienes que cumplir una de estas condiciones:",
      "  Tus ingresos están por debajo de un límite que depende de las personas de tu casa.",
      "  Tienes el título de familia numerosa.",
      "  Cobras la pensión mínima.",
      "  Cobras el **IMV**.",
    ],
    pasos: [
      "Si no lo tienes, contrata el **PVPC** con una **comercializadora de referencia**.",
      "Pide el formulario de solicitud a la comercializadora.",
      "+ Envíalo con los papeles por teléfono, por correo, por correo electrónico o en una oficina.",
      "La comercializadora te responde en 10 **días hábiles**.",
      "El bono dura 2 años.",
      "+ Después sigue igual, sin que hagas nada, si mantienes las condiciones.",
    ],
    documentos: [
      "El formulario de solicitud.",
      "DNI, NIF o **NIE** de la persona titular y de las personas de tu hogar.",
      "El certificado de empadronamiento. Lo da tu ayuntamiento y dice dónde vives.",
      "El libro de familia o certificados del Registro Civil.",
      "El título de familia numerosa o el justificante del **IMV**, si lo tienes.",
      "Certificados de situaciones especiales, si los tienes.",
      "+ Por ejemplo, discapacidad, violencia de género o dependencia.",
    ],
  },

  "bono-alquiler-joven": {
    nombre: "Bono Alquiler Joven",
    quien: "De la Generalitat",
    resumen: [
      "El Bono Alquiler Joven ayuda a pagar el alquiler.",
      "Es para jóvenes de la Comunitat Valenciana.",
      "Esta es la convocatoria de 2026.",
    ],
    dinero: {
      intro: [
        "Son 250 euros al mes durante 24 meses.",
        "Las solicitudes compiten entre sí.",
        "Cumplir los requisitos no asegura que te den la ayuda.",
      ],
    },
    requisitos: [
      "Tienes entre 18 y 35 años, los dos incluidos.",
      "+ Si hay más personas en el contrato, todas cumplen esto.",
      "Tienes un contrato de alquiler, o puedes firmarlo.",
      "+ Es de una casa o una habitación en la Comunitat Valenciana.",
      "+ El contrato dura al menos 1 año.",
      "Vives allí y estás **empadronado** allí.",
      "No valen los subarriendos ni los alquileres turísticos.",
      "Tienes una fuente regular de ingresos.",
      "+ Tus ingresos al año no pasan de un límite.",
      "+ El límite es más alto si viven dos o más jóvenes.",
      "El alquiler no pasa de 900 euros al mes por una casa.",
      "+ No pasa de 450 euros al mes por una habitación.",
      "+ Estos límites son para la ciudad de València.",
      "No tienes una vivienda en propiedad en España.",
      "No eres familiar cercano de la persona que te alquila.",
    ],
    pasos: [
      "Mira en la **sede electrónica** de la **Generalitat** si hay una convocatoria abierta.",
      "+ El número del trámite es G110699.",
      "Presenta la solicitud por internet con **certificado digital** o con **Cl@ve**.",
      "Si no tienes certificado, rellena el formulario por internet.",
      "+ Imprime el justificante, fírmalo y regístralo.",
      "+ Puedes hacerlo con cita previa en el Servicio Territorial de Vivienda de València, calle Gregorio Gea, 27.",
      "Mira las listas provisionales en la **sede electrónica**.",
      "+ Te avisan con un mensaje al móvil.",
      "Si falta algo, tienes 10 **días hábiles** para arreglarlo.",
      "Después tienes que demostrar que pagas el alquiler.",
    ],
    documentos: [
      "La solicitud con una **declaración responsable**.",
      "El contrato de alquiler completo y firmado, con la referencia catastral.",
      "+ Si no tienes la referencia catastral, puedes entregarla 2 meses después de que te den la ayuda.",
      "Un papel que demuestre tus ingresos regulares. Por ejemplo, un contrato de trabajo.",
      "Los justificantes de pago del alquiler desde el 1 de enero de 2025, o desde que empezó el contrato.",
      "El certificado de empadronamiento. Lo da tu ayuntamiento y dice dónde vives.",
      "El papel para decir en qué cuenta quieres cobrar.",
      "+ Solo lo necesitas si es tu primera ayuda de la **Generalitat** o si cambias de cuenta.",
    ],
  },

  "ayudas-comedor-escolar": {
    nombre: "Ayudas de comedor escolar",
    quien: "De la Generalitat",
    resumen: [
      "Las ayudas de comedor escolar ayudan a pagar el comedor del colegio.",
      "Son para el curso 2026-2027.",
      "Las da la **Conselleria** de Educación.",
    ],
    dinero: {
      intro: [
        "Hasta 4,35 euros al día en Infantil, Primaria y ESO.",
        "Hasta 5,54 euros al día en educación especial.",
      ],
    },
    requisitos: [
      "Tu hijo o hija va a un colegio público o concertado de la Comunitat Valenciana.",
      "Los ingresos de tu familia en 2025 no pasan de un límite.",
      "+ El límite depende de las personas que sois en la familia.",
      "Tienes que haber presentado la **declaración de la renta**, si es obligatoria.",
      "+ Si no la presentas, te dicen que no.",
      "Dan puntos según los ingresos y la situación social de la familia.",
      "+ El máximo son 20 puntos.",
    ],
    pasos: [
      "Si la pediste el curso pasado y usas ITACA Web Familia, descarga el borrador.",
      "+ Revísalo, fírmalo y llévalo al colegio.",
      "Si no, pide el impreso en el colegio.",
      "+ El impreso se llama anexo I.",
      "+ Llévalo con los papeles que piden.",
      "Entrega una sola solicitud por colegio.",
      "+ Es una sola aunque tengas varios hijos en el mismo colegio.",
      "Recuerda que no es un trámite por internet.",
    ],
    documentos: [
      "Un documento de identidad.",
      "Papeles que demuestren cuántas personas sois, cuánto ganáis y cuál es vuestra situación social.",
    ],
  },

  "xarxa-llibres": {
    nombre: "Banco de Libros",
    quien: "De la Generalitat",
    resumen: [
      "El **Banco de Libros** presta libros de texto a las familias.",
      "Es para el curso 2026-2027.",
    ],
    requisitos: [
      "Tu hijo o hija estudia en 2026-2027.",
      "+ Estudia Primaria, Educación Especial, ESO, FP básica o Bachillerato.",
      "Su colegio es de la **Generalitat**, concertado o de un ayuntamiento que participa.",
      "Ha devuelto todos los libros del curso 2025-2026.",
      "+ Esto no cuenta si empieza el primer curso de Primaria.",
      "Solo lo piden las familias que no participaron en 2025-2026.",
      "+ Si ya participabas, sigues dentro, salvo que renuncies.",
      "En los centros de Educación Especial, el alumnado participa sin pedirlo.",
      "Te comprometes a usar bien los libros.",
      "+ Los devuelves al final del curso.",
      "+ Si falta algún libro, hay que reponerlo.",
    ],
    pasos: [
      "Descarga el formulario de participación.",
      "+ Está en la web de la **Conselleria** y en la ficha G112587 de la **sede electrónica**.",
      "Rellénalo y fírmalo.",
      "+ Llévalo al colegio.",
      "+ Si ya estudiabas en 2025-2026, es el colegio de ese curso.",
      "+ Si empiezas Primaria, es el colegio de 2026-2027.",
      "Sigue las instrucciones del colegio para recoger y devolver los libros.",
      "Recuerda que no es un trámite por internet.",
    ],
    documentos: [
      "El formulario firmado por la persona responsable legal del alumno.",
      "Los libros del curso anterior, devueltos en el colegio.",
    ],
  },
};

/** Palabras marcadas con **negrita** en una lista de líneas, sin repetir. */
export function terminosDe(lineas: string[]): string[] {
  const vistos: string[] = [];
  for (const l of lineas)
    for (const m of l.matchAll(/\*\*(.+?)\*\*/g))
      if (!vistos.includes(m[1])) vistos.push(m[1]);
  return vistos;
}
