// Una convocatoria con la misma forma venga de la API en vivo o de la copia del
// pack (datos/bdns-convocatorias-cv.json), que usa otros nombres de campo.
import pack from "../../../datos/bdns-convocatorias-cv.json";
import { fichaOficial, urlDocumento, type FichaApi } from "./bdns";
import type { DatosPlazo } from "./plazo";

export type Convocatoria = {
  numero: string;
  titulo: string;
  organo: { nivel1: string; nivel2: string; nivel3: string };
  tipoConvocatoria: string | null;
  beneficiarios: string[];
  regiones: string[];
  finalidad: string | null;
  bases: { titulo: string | null; url: string | null };
  sede: string | null;
  plazo: DatosPlazo;
  anuncios: {
    titulo: string;
    texto: string | null;
    url: string | null;
    diario: string | null;
    fecha: string | null;
  }[];
  documentos: { id: string; descripcion: string; url: string }[];
  enlace: string;
  fechaRecepcion: string;
  fuente: "bdns" | "pack";
};

const limpio = (s: string | null | undefined) => (s ?? "").trim();

export function desdeApi(f: FichaApi): Convocatoria {
  const anuncios = (f.anuncios ?? []).map((a) => ({
    titulo: a.titulo,
    texto: a.texto,
    url: a.url,
    diario: a.desDiarioOficial,
    fecha: a.datPublicacion,
  }));
  return {
    numero: f.codigoBDNS,
    titulo: limpio(f.descripcion),
    organo: f.organo,
    tipoConvocatoria: f.tipoConvocatoria,
    beneficiarios: (f.tiposBeneficiarios ?? []).map((b) => limpio(b.descripcion)),
    regiones: (f.regiones ?? []).map((r) => limpio(r.descripcion)),
    finalidad: f.descripcionFinalidad,
    bases: { titulo: f.descripcionBasesReguladoras, url: f.urlBasesReguladoras },
    sede: f.sedeElectronica,
    plazo: {
      inicio: f.fechaInicioSolicitud,
      fin: f.fechaFinSolicitud,
      abierto: f.abierto,
      textoInicio: f.textInicio,
      textoFin: f.textFin,
      publicaciones: anuncios
        .filter((a) => a.fecha)
        .map((a) => ({ fecha: a.fecha!, diario: a.diario })),
    },
    anuncios,
    documentos: (f.documentos ?? []).map((d) => ({
      id: String(d.id),
      descripcion: d.descripcion,
      url: urlDocumento(d.id),
    })),
    enlace: fichaOficial(f.codigoBDNS),
    fechaRecepcion: f.fechaRecepcion,
    fuente: "bdns",
  };
}

type EntradaPack = (typeof pack.convocatorias)[number];

function desdePack(p: EntradaPack): Convocatoria {
  const publicaciones = (p.publicacionesDiarioOficial ?? []) as {
    diario: string | null;
    fechaPublicacion: string | null;
    url: string | null;
    titulo: string;
  }[];
  return {
    numero: p.numeroBDNS,
    titulo: limpio(p.titulo),
    organo: p.organo,
    tipoConvocatoria: p.tipoConvocatoria,
    beneficiarios: p.tiposBeneficiario.map(limpio),
    regiones: p.regiones.map(limpio),
    finalidad: p.finalidad,
    bases: { titulo: p.basesReguladoras?.titulo ?? null, url: p.basesReguladoras?.url ?? null },
    sede: p.sedeElectronica as string | null,
    plazo: {
      inicio: p.plazoSolicitud.fechaInicioSolicitud as string | null,
      fin: p.plazoSolicitud.fechaFinSolicitud as string | null,
      abierto: p.plazoSolicitud.abierto,
      textoInicio: p.plazoSolicitud.textoInicio as string | null,
      textoFin: p.plazoSolicitud.textoFin as string | null,
      publicaciones: publicaciones
        .filter((x) => x.fechaPublicacion)
        .map((x) => ({ fecha: x.fechaPublicacion!, diario: x.diario })),
    },
    anuncios: publicaciones.map((x) => ({
      titulo: x.titulo,
      texto: null,
      url: x.url,
      diario: x.diario,
      fecha: x.fechaPublicacion,
    })),
    documentos: p.documentos.map((d) => {
      const id = new URL(d.url).searchParams.get("idDocumento") ?? "";
      return { id, descripcion: d.descripcion, url: d.url };
    }),
    enlace: p.urlFichaOficial,
    fechaRecepcion: p.fechaRecepcion,
    fuente: "pack",
  };
}

export const PACK_CONSULTADO = pack.consultado;

const porNumero = new Map(pack.convocatorias.map((p) => [p.numeroBDNS, p]));

export function delPack(numero: string): Convocatoria | null {
  const p = porNumero.get(numero);
  return p ? desdePack(p) : null;
}

// Grupos de la copia: «estatal», «autonomica_cv» y «local_ayuntamiento_valencia».
export function grupoDelPack(grupo: string): Convocatoria[] {
  return pack.convocatorias.filter((p) => p.grupoConsulta === grupo).map(desdePack);
}
