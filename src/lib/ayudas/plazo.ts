// Estado de una convocatoria a partir de su plazo. Regla: solo es «abierta» lo
// que se puede demostrar con fechas; si hay duda, «por_confirmar».
// El campo `abierto` de la BDNS solo significa «sin plazo fijo», nunca «abierta hoy».
import { normalizar } from "./nombres";

export type Estado =
  | "abierta"
  | "proximamente"
  | "sin_plazo_fijo"
  | "por_confirmar"
  | "cerrada"
  | "no_solicitable";

export type Publicacion = { fecha: string; diario: string | null };

export type DatosPlazo = {
  inicio: string | null;
  fin: string | null;
  abierto: boolean | null;
  textoInicio: string | null;
  textoFin: string | null;
  publicaciones: Publicacion[];
};

export type ResultadoPlazo = {
  estado: Estado;
  motivo: string;
  // Último día seguro del plazo (AAAA-MM-DD), si se conoce.
  fin: string | null;
};

// --- Fechas como AAAA-MM-DD, sin zonas horarias ---

const aFecha = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const aIso = (d: Date) => d.toISOString().slice(0, 10);

export function sumarDias(iso: string, n: number): string {
  const d = aFecha(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return aIso(d);
}

export function sumarMeses(iso: string, n: number): string {
  const d = aFecha(iso);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return aIso(d);
}

// N días hábiles contados desde el día siguiente a `iso`, saltando solo sábados
// y domingos. Da el fin más temprano posible: cada festivo lo retrasa.
export function sumarHabiles(iso: string, n: number): string {
  let d = iso;
  for (let contados = 0; contados < n; ) {
    d = sumarDias(d, 1);
    const dia = aFecha(d).getUTCDay();
    if (dia !== 0 && dia !== 6) contados++;
  }
  return d;
}

export function hoyEnMadrid(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export const fechaLegible = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// --- Plazos escritos: «20 días hábiles desde la publicación del extracto» ---

const NUMEROS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30,
  cuarenta: 40, sesenta: 60, noventa: 90,
  // valenciano y catalán
  deu: 10, onze: 11, dotze: 12, tretze: 13, catorze: 14, quinze: 15,
  setze: 16, vint: 20, trenta: 30, quaranta: 40, seixanta: 60,
};

type Duracion = { n: number; unidad: "habiles" | "naturales" | "dias" | "meses" };

export function leerDuracion(texto: string): Duracion | null {
  const t = normalizar(texto);
  const palabras = Object.keys(NUMEROS).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(
    `\\b(\\d{1,3}|${palabras})\\s*(dias?|dies|mes|meses|mesos)\\b\\s*(?:\\d{1,3}\\s*)?(habiles|habils|naturales|naturals)?`,
  );
  const m = t.match(re);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMEROS[m[1]];
  if (!n) return null;
  if (m[2].startsWith("mes")) return { n, unidad: "meses" };
  if (!m[3]) return { n, unidad: "dias" };
  return { n, unidad: m[3].startsWith("habil") ? "habiles" : "naturales" };
}

const MENCIONA_PUBLICACION =
  /publicaci|extracto|extracte|boletin|butlleti|diari|\b(boe|bop[a-z]?|boja|borm|bocce|bocm|bon|boa|bocyl|bor|boib|boc|bome|dogv|dogc|dog|docm|doe)\b/;
const SIN_PLAZO = /sin plazo|no procede|no tiene|sense termini|no hi ha termini|no hay plazo/;

function describir(d: Duracion) {
  const u = { habiles: "días hábiles", naturales: "días naturales", dias: "días", meses: d.n === 1 ? "mes" : "meses" };
  return `${d.n} ${u[d.unidad]}`;
}

// Fin más temprano y más tardío posibles contando desde la publicación.
function rangoFin(base: string, d: Duracion): { min: string; max: string } {
  switch (d.unidad) {
    case "naturales":
      return { min: sumarDias(base, d.n), max: sumarDias(base, d.n + 4) };
    case "meses": {
      const min = sumarMeses(base, d.n);
      return { min, max: sumarDias(min, 4) };
    }
    case "habiles":
      return { min: sumarHabiles(base, d.n), max: sumarDias(sumarHabiles(base, d.n), 10) };
    case "dias":
      // Sin «hábiles» ni «naturales»: lo más pronto (naturales) y lo más tarde (hábiles).
      return { min: sumarDias(base, d.n), max: sumarDias(sumarHabiles(base, d.n), 10) };
  }
}

export function calcularEstado(p: DatosPlazo, hoy: string): ResultadoPlazo {
  const inicio = p.inicio?.slice(0, 10) || null;
  const fin = p.fin?.slice(0, 10) || null;
  const textoOriginal = [p.textoInicio, p.textoFin].filter(Boolean).join(" · ");
  const texto = normalizar(textoOriginal);

  if (fin && hoy > fin)
    return { estado: "cerrada", motivo: `El plazo terminó el ${fechaLegible(fin)}.`, fin };
  if (inicio && hoy < inicio)
    return {
      estado: "proximamente",
      motivo: `El plazo empieza el ${fechaLegible(inicio)}${fin ? ` y termina el ${fechaLegible(fin)}` : ""}.`,
      fin,
    };
  if (inicio && fin)
    return {
      estado: "abierta",
      motivo: `Plazo del ${fechaLegible(inicio)} al ${fechaLegible(fin)}, según la BDNS.`,
      fin,
    };

  if (!inicio && !fin && SIN_PLAZO.test(texto))
    return {
      estado: "no_solicitable",
      motivo: `La BDNS dice «${textoOriginal}»: no hay plazo para presentar solicitudes.`,
      fin: null,
    };

  // Plazo escrito que cuenta desde la publicación en el boletín.
  const publicadas = p.publicaciones.map((x) => x.fecha.slice(0, 10)).filter((f) => f <= hoy).sort();
  const base = publicadas[0];
  const pub = p.publicaciones.find((x) => x.fecha.slice(0, 10) === base);
  const duracion = leerDuracion(p.textoFin ?? "") ?? leerDuracion(p.textoInicio ?? "");
  if (base && MENCIONA_PUBLICACION.test(texto)) {
    const desde = inicio ?? sumarDias(base, 1);
    const dondeYCuando = `${pub?.diario ? ` en ${pub.diario}` : ""} el ${fechaLegible(base)}`;
    if (hoy < desde)
      return {
        estado: "proximamente",
        motivo: `El plazo empieza el ${fechaLegible(desde)}, tras la publicación${dondeYCuando}.`,
        fin,
      };
    if (fin)
      return {
        estado: "abierta",
        motivo: `Plazo hasta el ${fechaLegible(fin)}; empezó tras la publicación${dondeYCuando}.`,
        fin,
      };
    if (duracion) {
      const r = rangoFin(base, duracion);
      const calculo = `${describir(duracion)} desde la publicación${dondeYCuando}`;
      if (hoy <= r.min)
        return {
          estado: "abierta",
          motivo: `Calculado: ${calculo}. Como pronto termina el ${fechaLegible(r.min)}.`,
          fin: r.min,
        };
      if (hoy > r.max)
        return {
          estado: "cerrada",
          motivo: `Calculado: ${calculo}. Terminó como tarde el ${fechaLegible(r.max)}.`,
          fin: r.max,
        };
      return {
        estado: "por_confirmar",
        motivo: `Calculado: ${calculo}. Termina entre el ${fechaLegible(r.min)} y el ${fechaLegible(r.max)} según los festivos: confírmalo en la convocatoria.`,
        fin: null,
      };
    }
  }

  if (fin)
    return {
      estado: "por_confirmar",
      motivo: `Termina el ${fechaLegible(fin)}, pero la BDNS no dice cuándo empieza.`,
      fin,
    };
  if (inicio)
    return {
      estado: "por_confirmar",
      motivo: `Empezó el ${fechaLegible(inicio)}; la BDNS no da la fecha de fin${textoOriginal ? ` («${textoOriginal}»)` : ""}.`,
      fin: null,
    };
  if (p.abierto)
    return {
      estado: "sin_plazo_fijo",
      motivo: "La BDNS indica que se puede solicitar sin plazo fijo (por ejemplo, hasta agotar el presupuesto).",
      fin: null,
    };
  return {
    estado: "por_confirmar",
    motivo: textoOriginal
      ? `La BDNS no da fechas. Plazo según la convocatoria: «${textoOriginal}».`
      : "La BDNS no indica el plazo.",
    fin: null,
  };
}
