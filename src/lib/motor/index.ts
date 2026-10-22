import type { BuscarAyudas } from "@/lib/tipos";
import { fichasDelCatalogo, noCubiertoPor } from "./catalogo";

// Motor de búsqueda (spec 002). Hoy consulta solo el catálogo local; la BDNS
// se añadirá aquí sin cambiar el contrato.
export const buscarAyudas: BuscarAyudas = async (perfil) => {
  const hoy = new Date();
  return {
    fichas: fichasDelCatalogo(perfil, hoy),
    cobertura: {
      consultado: [
        "Catálogo de trámites y ayudas (Estado, Generalitat y Ajuntament de València), a 18/10/2026",
      ],
      noConsultado: noCubiertoPor(perfil),
      respaldo: true,
      fechaConsulta: hoy.toISOString().slice(0, 10),
    },
  };
};
