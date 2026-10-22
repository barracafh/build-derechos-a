// Del municipio o la provincia que dice el ciudadano a lo que necesita la BDNS:
// regiones (NUTS) para Estado y comunidad, y órganos para la búsqueda local.
// Datos generados con scripts/territorio/generar.ts.
import datos from "@/datos/territorio.json";
import { claveNombre, normalizar, variantes } from "./nombres";

type Municipio = {
  nombre: string;
  clave: string;
  organos: number[];
  isla: string | null;
  nuts3: string | null;
};
type Provincia = {
  ine: string;
  nombre: string;
  comunidad: string;
  nuts: string[];
  regionesEstado: number[];
  regionesComunidad: number[];
  provinciales: { id: number; nombre: string; isla: string | null }[];
  municipios: Municipio[];
};
type Territorio = {
  islas: Record<string, { nuts: string; regionId: number }>;
  provincias: Provincia[];
};

const T = datos as unknown as Territorio;

export type Ubicacion = {
  municipio: string | null;
  provincia: string;
  ineProvincia: string;
  comunidad: string;
  isla: string | null;
  // Cadena NUTS del ciudadano, de España a lo más concreto que se conoce.
  nuts: string[];
  regionesEstado: number[];
  regionesComunidad: number[];
  organosLocales: number[];
  nombresLocales: string[];
};

export type ErrorUbicacion = { error: string; opciones?: string[] };

// Nombres populares de provincias que no coinciden con el nombre oficial.
const ALIAS_PROVINCIA: Record<string, string> = {
  alava: "01", araba: "01", alicante: "03", alacant: "03", baleares: "07",
  "islas baleares": "07", "illes balears": "07", mallorca: "07", menorca: "07",
  ibiza: "07", eivissa: "07", formentera: "07", castellon: "12", castello: "12",
  "la coruna": "15", coruna: "15", "a coruna": "15", gerona: "17",
  guipuzcoa: "20", gipuzkoa: "20", lerida: "25", rioja: "26", orense: "32",
  "gran canaria": "35", lanzarote: "35", fuerteventura: "35", tenerife: "38",
  "la palma": "38", "la gomera": "38", "el hierro": "38",
  "santa cruz de tenerife": "38", valencia: "46", vizcaya: "48", bizkaia: "48",
  nafarroa: "31", navarra: "31",
};

function buscarProvincia(texto: string): Provincia | null {
  const t = normalizar(texto);
  if (/^\d{2}$/.test(t)) return T.provincias.find((p) => p.ine === t) ?? null;
  if (ALIAS_PROVINCIA[t])
    return T.provincias.find((p) => p.ine === ALIAS_PROVINCIA[t]) ?? null;
  return (
    T.provincias.find((p) => variantes(claveNombre(p.nombre)).includes(t)) ?? null
  );
}

function buscarMunicipio(
  texto: string,
  provincias: Provincia[],
): { p: Provincia; m: Municipio }[] {
  const t = claveNombre(texto);
  const todos = provincias.flatMap((p) => p.municipios.map((m) => ({ p, m })));
  const exactos = todos.filter(({ m }) =>
    variantes(m.clave).some((v) => variantes(t).includes(v)),
  );
  if (exactos.length) return exactos;
  // «Castellón» → «Castellón de la Plana»: el nombre corto al principio.
  return todos.filter(({ m }) =>
    variantes(m.clave).some((v) => variantes(t).some((x) => v.startsWith(`${x} `))),
  );
}

export function resolverUbicacion(args: {
  municipio?: string;
  provincia?: string;
}): Ubicacion | ErrorUbicacion {
  const provincia = args.provincia ? buscarProvincia(args.provincia) : null;
  if (args.provincia && !provincia)
    return { error: `No reconozco la provincia «${args.provincia}».` };

  let p = provincia;
  let m: Municipio | null = null;
  if (args.municipio) {
    const encontrados = buscarMunicipio(args.municipio, p ? [p] : T.provincias);
    if (encontrados.length === 1) ({ p, m } = encontrados[0]);
    else if (encontrados.length > 1)
      return {
        error: `Hay varios municipios que encajan con «${args.municipio}». Pregunta cuál es o indica la provincia.`,
        opciones: encontrados.map(({ p, m }) => `${m.nombre} (${p.nombre})`),
      };
    else if (!p) {
      // Puede ser una provincia dicha como municipio («vivo en Valencia» ya
      // se resolvió arriba como municipio; esto cubre «Gipuzkoa», «Mallorca»…).
      p = buscarProvincia(args.municipio);
      if (!p)
        return {
          error: `No encuentro «${args.municipio}» entre los municipios con convocatorias en la BDNS. Pregunta la provincia y vuelve a llamar con ella.`,
        };
    }
  }
  if (!p) return { error: "Indica al menos el municipio o la provincia." };

  const isla = m?.isla ?? null;
  const islaDatos = isla ? T.islas[isla] : null;
  const esIslas = p.ine === "07" || p.ine === "35" || p.ine === "38";
  const provinciales = p.provinciales.filter((o) => !esIslas || (isla && o.isla === isla));

  return {
    municipio: m?.nombre ?? null,
    provincia: p.nombre,
    ineProvincia: p.ine,
    comunidad: p.comunidad,
    isla,
    nuts: islaDatos ? [...p.nuts, islaDatos.nuts] : p.nuts,
    regionesEstado: islaDatos
      ? [...p.regionesEstado, islaDatos.regionId]
      : p.regionesEstado,
    regionesComunidad: p.regionesComunidad,
    organosLocales: [...(m?.organos ?? []), ...provinciales.map((o) => o.id)],
    nombresLocales: [
      ...(m ? [`Ayuntamiento de ${m.nombre}`] : []),
      ...provinciales
        .filter((o) => /DIPUTACI|CABILDO|CONSELL|CONSEJO INSULAR/.test(o.nombre))
        .map((o) => o.nombre),
    ],
  };
}

const PROVINCIAS_CV = ["03", "12", "46"];

// ¿Está un lugar dentro de la Comunitat Valenciana? null si no se reconoce.
export function zonaPorTerritorio(lugar: string): "cv" | "fuera" | null {
  const u = resolverUbicacion({ municipio: lugar });
  if (!("error" in u)) return PROVINCIAS_CV.includes(u.ineProvincia) ? "cv" : "fuera";
  // Ambiguo: decide solo si todas las opciones caen del mismo lado.
  const provincias = (u.opciones ?? []).map((o) => {
    const p = T.provincias.find((x) => o.endsWith(`(${x.nombre})`));
    return p ? PROVINCIAS_CV.includes(p.ine) : null;
  });
  if (provincias.length && provincias.every((x) => x === true)) return "cv";
  if (provincias.length && provincias.every((x) => x === false)) return "fuera";
  return null;
}

// «vivo en Adeje», «soy de Gandia», «estamos en Castelló»: posición del lugar en
// un texto ya normalizado letra a letra (mismas posiciones que el original).
export function lugarEnFrase(t: string): { desde: number; hasta: number } | null {
  const re =
    /\b(?:vivo|vivimos|resido|residimos|soy|somos|estoy|estamos|empadronad[oa]s?|visc|vivim|soc|som)\s+(?:de|en|a)\s+((?:[a-zñç'·-]+ ?){1,6})/g;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const inicio = m.index + m[0].length - m[1].length;
    const palabras = m[1].trim().split(" ");
    for (let n = palabras.length; n > 0; n--) {
      const candidato = palabras.slice(0, n).join(" ");
      if (candidato.length < 3) continue;
      const u = resolverUbicacion({ municipio: candidato });
      if (!("error" in u)) return { desde: inicio, hasta: inicio + candidato.length };
    }
  }
  return null;
}

// ¿La región de impacto de una convocatoria («ES523 - Valencia / València»)
// cubre al ciudadano? Sí si es su territorio o uno que lo contiene.
export function regionCubre(region: string, nuts: string[]): boolean {
  const codigo = region.split(" - ")[0].trim();
  if (codigo === "XXXX") return true;
  return nuts.includes(codigo);
}
