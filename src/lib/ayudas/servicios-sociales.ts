// Servicios sociales de atención primaria: la puerta de entrada a las ayudas de
// urgencia de cada ayuntamiento, que casi nunca salen en la BDNS. No hay datos
// de cada municipio, así que no se dice qué ayudas hay ni cuánto dan: solo a
// dónde ir, con las páginas del Ministerio (abiertas el día de `consultado`).
export const SERVICIOS_SOCIALES = {
  consultado: "2026-10-22",
  organismo: "Ministerio de Derechos Sociales, Consumo y Agenda 2030",
  catalogo:
    "https://www.dsca.gob.es/es/derechos-sociales/servicios-sociales/prestaciones-basicas/catalogo-referencia",
  mapa: "https://www.dsca.gob.es/es/derechos-sociales/servicios-sociales/mapa-servicios-sociales/mapa-centros-atencion-primaria",
  // Literal del Catálogo de Referencia de Servicios Sociales (apartado «Prestaciones Económicas»).
  cita: "Aportaciones económicas, de carácter periódico o pago único, ofertadas para garantizar mínimos de subsistencia o situaciones de emergencia sobrevenidas a los ciudadanos",
};

// Lo que cuenta la persona que pide ir a servicios sociales ya, no solo buscar convocatorias.
export const URGENCIA =
  /\b(desahuc|desaloj|comida\b|alimentos\b|para comer\b|no (tengo|tenemos) (para )?comer\b|no (puedo|podemos) pagar (el |la )?(alquiler|hipoteca|luz|agua|gas)\b|impago|(me|nos) (han|van a) cortar|(me|nos) han cortado|corte de (luz|agua|gas)\b|emergencia social|en la calle\b|sin hogar\b|sin techo\b)/;
