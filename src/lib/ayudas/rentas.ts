// Rentas mínimas de las comunidades autónomas (fuera de la Comunitat Valenciana,
// que está en el catálogo). No salen en la BDNS porque no son convocatorias: se
// piden en la sede de cada comunidad. Datos copiados de las páginas oficiales y
// con los enlaces abiertos uno a uno (src/datos/rentas-autonomicas.json).
import datos from "@/datos/rentas-autonomicas.json";
import type { Enlaces } from "./convocatoria";
import type { Estado } from "./plazo";

export type Renta = {
  id: string;
  ccaa: string;
  ine_provincias: string[];
  titulo: string;
  organismo: string;
  enlace_info: string;
  enlace_tramite: string | null;
  plazo: string | null;
  todo_el_ano: boolean | null;
  requisitos_clave: string[];
  nota: string | null;
};

export const RENTAS = datos.rentas as Renta[];
export const RENTAS_CONSULTADO = datos.consultado;

export const rentaDe = (ineProvincia: string): Renta | null =>
  RENTAS.find((r) => r.ine_provincias.includes(ineProvincia)) ?? null;

export const rentaPorId = (id: string): Renta | null => RENTAS.find((r) => r.id === id) ?? null;

// Solo «sin plazo fijo» si la página oficial lo dice; si no, por confirmar.
export function estadoRenta(r: Renta): { estado: Estado; motivo: string } {
  if (r.todo_el_ano === true)
    return { estado: "sin_plazo_fijo", motivo: `Se puede pedir en cualquier momento: «${r.plazo}».` };
  return {
    estado: "por_confirmar",
    motivo: r.plazo
      ? `La página oficial dice: «${r.plazo}». Confírmalo antes de pedirla.`
      : "La página oficial no dice el plazo: confírmalo en la sede.",
  };
}

export const enlacesRenta = (r: Renta): Enlaces => ({
  solicitud: r.enlace_tramite,
  sede: null,
  convocatoria: null,
  bases: null,
  pdf: null,
  ficha: r.enlace_info,
});
