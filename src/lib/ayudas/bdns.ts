// Cliente de la API pública de la BDNS (sin clave, sin CORS: solo servidor).
// La BDNS admite 10 peticiones por segundo por IP y responde 429 si se pasa:
// dejamos margen con 125 ms entre inicios (8/s en cualquier ventana de 1 s),
// como mucho 4 a la vez, y reintentamos con espera si aun así llega un 429. Caché en memoria de datos públicos
// (nunca de lo que escribe el ciudadano).

export const API_BDNS = "https://www.infosubvenciones.es/bdnstrans/api";
export const fichaOficial = (numero: string) =>
  `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${numero}`;

const MAX_EN_VUELO = 4;
const ENTRE_INICIOS_MS = 125;
let enVuelo = 0;
let ultimoInicio = 0;
const cola: (() => void)[] = [];
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function conTurno<T>(fn: () => Promise<T>): Promise<T> {
  while (enVuelo >= MAX_EN_VUELO) await new Promise<void>((r) => cola.push(r));
  enVuelo++;
  try {
    const hueco = ultimoInicio + ENTRE_INICIOS_MS - Date.now();
    ultimoInicio = Math.max(Date.now(), ultimoInicio + ENTRE_INICIOS_MS);
    if (hueco > 0) await esperar(hueco);
    return await fn();
  } finally {
    enVuelo--;
    cola.shift()?.();
  }
}

const cache = new Map<string, { hasta: number; valor: Promise<unknown> }>();

function enCache<T>(clave: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(clave);
  if (hit && hit.hasta > Date.now()) return hit.valor as Promise<T>;
  const valor = fn();
  cache.set(clave, { hasta: Date.now() + ttlMs, valor });
  valor.catch(() => cache.delete(clave));
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return valor;
}

async function pedir(ruta: string, timeoutMs: number, intento = 0): Promise<Response> {
  const res = await conTurno(() =>
    fetch(`${API_BDNS}${ruta}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json" },
    }),
  );
  if (res.status === 429 && intento < 2) {
    await esperar(1000 * 2 ** intento);
    return pedir(ruta, timeoutMs, intento + 1);
  }
  if (!res.ok) {
    // Solo códigos y rutas públicas: nunca texto del ciudadano.
    if (process.env.DEBUG_BDNS) console.error(`BDNS ${res.status} ${ruta}`);
    throw new Error(`BDNS ${res.status} en ${ruta.split("?")[0]}`);
  }
  return res;
}

// --- Búsqueda ---

export type ResultadoBusqueda = {
  numeroConvocatoria: string;
  descripcion: string;
  fechaRecepcion: string;
  nivel1: string;
  nivel2: string;
  nivel3: string;
};

export type FiltrosBusqueda = {
  tipoAdministracion?: "C" | "A" | "L" | "O";
  regiones?: number[];
  organos?: number[];
  tiposBeneficiario: number[];
  fechaDesde: string; // dd/mm/aaaa
  fechaHasta?: string; // dd/mm/aaaa
};

export function buscarConvocatorias(f: FiltrosBusqueda): Promise<ResultadoBusqueda[]> {
  const q = new URLSearchParams({
    vpd: "GE",
    page: "0",
    pageSize: "1000",
    order: "fechaRecepcion",
    direccion: "desc",
    fechaDesde: f.fechaDesde,
    tiposBeneficiario: f.tiposBeneficiario.join(","),
  });
  if (f.tipoAdministracion) q.set("tipoAdministracion", f.tipoAdministracion);
  if (f.regiones?.length) q.set("regiones", f.regiones.join(","));
  if (f.organos?.length) q.set("organos", f.organos.join(","));
  if (f.fechaHasta) q.set("fechaHasta", f.fechaHasta);
  const ruta = `/convocatorias/busqueda?${q.toString().replace(/%2C/g, ",").replace(/%2F/g, "/")}`;
  return enCache(ruta, 10 * 60_000, async () => {
    const data = (await (await pedir(ruta, 8000)).json()) as { content?: ResultadoBusqueda[] };
    return data.content ?? [];
  });
}

// --- Ficha ---

type ConDescripcion = { descripcion: string };

export type FichaApi = {
  codigoBDNS: string;
  descripcion: string;
  organo: { nivel1: string; nivel2: string; nivel3: string };
  sedeElectronica: string | null;
  fechaRecepcion: string;
  tipoConvocatoria: string | null;
  tiposBeneficiarios: ConDescripcion[] | null;
  regiones: ConDescripcion[] | null;
  descripcionFinalidad: string | null;
  descripcionBasesReguladoras: string | null;
  urlBasesReguladoras: string | null;
  abierto: boolean | null;
  fechaInicioSolicitud: string | null;
  fechaFinSolicitud: string | null;
  textInicio: string | null;
  textFin: string | null;
  documentos: { id: number; descripcion: string; nombreFic: string }[] | null;
  anuncios:
    | {
        titulo: string;
        texto: string | null;
        url: string | null;
        desDiarioOficial: string | null;
        datPublicacion: string | null;
      }[]
    | null;
};

export function leerFicha(numero: string): Promise<FichaApi> {
  const ruta = `/convocatorias?vpd=GE&numConv=${encodeURIComponent(numero)}`;
  return enCache(ruta, 30 * 60_000, async () => (await pedir(ruta, 6000)).json() as Promise<FichaApi>);
}

// --- Documentos (PDF de la convocatoria) ---

export const urlDocumento = (id: string | number) =>
  `${API_BDNS}/convocatorias/documentos?idDocumento=${id}`;

export async function leerDocumento(id: string, maxBytes = 15_000_000): Promise<Uint8Array> {
  const res = await pedir(`/convocatorias/documentos?idDocumento=${encodeURIComponent(id)}`, 20_000);
  const largo = Number(res.headers.get("content-length") ?? 0);
  if (largo > maxBytes) throw new Error("Documento demasiado grande");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error("Documento demasiado grande");
  return bytes;
}

export function recordar<T>(clave: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  return enCache(clave, ttlMs, fn);
}
