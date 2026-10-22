import type { BuscarAyudas } from "@/lib/tipos";
import { fichasDelCatalogo, noCubiertoPor } from "./catalogo";
import { fichasCentrales, VERSION_CENTRAL } from "./central";

// Motor de búsqueda (spec 002). Hoy consulta solo el catálogo local; la BDNS
// se añadirá aquí sin cambiar el contrato.
export const buscarAyudas: BuscarAyudas = async (perfil) => {
  const hoy = new Date();
  const catalogo = fichasDelCatalogo(perfil, hoy);
  return {
    fichas: [...catalogo, ...fichasCentrales(perfil, new Set(catalogo.map((f) => f.id)))],
    cobertura: {
      consultado: [
        "Catálogo de trámites y ayudas (Estado, Generalitat y Ajuntament de València), a 18/10/2026",
        `Ayudas leídas de páginas oficiales por un proceso automático, a ${VERSION_CENTRAL}`,
      ],
      noConsultado: noCubiertoPor(perfil),
      respaldo: true,
      fechaConsulta: hoy.toISOString().slice(0, 10),
    },
  };
};
