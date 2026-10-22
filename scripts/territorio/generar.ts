// Genera src/datos/territorio.json: provincias, cadena de regiones de la BDNS y
// órganos locales (ayuntamientos, diputaciones, cabildos y consells) por municipio.
// Uso: bun scripts/territorio/generar.ts
// Fuentes: API de la BDNS (/regiones y /organos?idAdmon=L) y la tabla del INE de
// municipios por isla (scripts/territorio/islas-ine-2025.json).
import { claveNombre } from "../../src/lib/ayudas/nombres";
import islasIne from "./islas-ine-2025.json";

const API = "https://www.infosubvenciones.es/bdnstrans/api";

type Nodo = { id: number; descripcion: string; children?: Nodo[] | null };

// Provincia INE → comunidad, NUTS3 (null en Baleares y Canarias: ahí NUTS3 es la
// isla) y nombre de la raíz en el árbol de órganos locales de la BDNS.
const PROVINCIAS: [string, string, string, string | null, string | null][] = [
  ["01", "Araba/Álava", "País Vasco", "ES211", "ARABA / ÁLAVA"],
  ["02", "Albacete", "Castilla-La Mancha", "ES421", "ALBACETE"],
  ["03", "Alicante/Alacant", "Comunitat Valenciana", "ES521", "ALACANT / ALICANTE"],
  ["04", "Almería", "Andalucía", "ES611", "ALMERÍA"],
  ["05", "Ávila", "Castilla y León", "ES411", "ÁVILA"],
  ["06", "Badajoz", "Extremadura", "ES431", "BADAJOZ"],
  ["07", "Illes Balears", "Illes Balears", null, "ILLES BALEARS / ISLAS BALEARES"],
  ["08", "Barcelona", "Cataluña", "ES511", "BARCELONA"],
  ["09", "Burgos", "Castilla y León", "ES412", "BURGOS"],
  ["10", "Cáceres", "Extremadura", "ES432", "CÁCERES"],
  ["11", "Cádiz", "Andalucía", "ES612", "CÁDIZ"],
  ["12", "Castellón/Castelló", "Comunitat Valenciana", "ES522", "CASTELLÓ / CASTELLÓN"],
  ["13", "Ciudad Real", "Castilla-La Mancha", "ES422", "CIUDAD REAL"],
  ["14", "Córdoba", "Andalucía", "ES613", "CÓRDOBA"],
  ["15", "A Coruña", "Galicia", "ES111", "A CORUÑA"],
  ["16", "Cuenca", "Castilla-La Mancha", "ES423", "CUENCA"],
  ["17", "Girona", "Cataluña", "ES512", "GIRONA"],
  ["18", "Granada", "Andalucía", "ES614", "GRANADA"],
  ["19", "Guadalajara", "Castilla-La Mancha", "ES424", "GUADALAJARA"],
  ["20", "Gipuzkoa", "País Vasco", "ES212", "GIPUZKOA"],
  ["21", "Huelva", "Andalucía", "ES615", "HUELVA"],
  ["22", "Huesca", "Aragón", "ES241", "HUESCA"],
  ["23", "Jaén", "Andalucía", "ES616", "JAÉN"],
  ["24", "León", "Castilla y León", "ES413", "LEÓN"],
  ["25", "Lleida", "Cataluña", "ES513", "LLEIDA"],
  ["26", "La Rioja", "La Rioja", "ES230", "LA RIOJA"],
  ["27", "Lugo", "Galicia", "ES112", "LUGO"],
  ["28", "Madrid", "Comunidad de Madrid", "ES300", "MADRID"],
  ["29", "Málaga", "Andalucía", "ES617", "MÁLAGA"],
  ["30", "Murcia", "Región de Murcia", "ES620", "MURCIA"],
  ["31", "Navarra", "Comunidad Foral de Navarra", "ES220", "NAFARROA / NAVARRA"],
  ["32", "Ourense", "Galicia", "ES113", "OURENSE"],
  ["33", "Asturias", "Principado de Asturias", "ES120", "ASTURIAS"],
  ["34", "Palencia", "Castilla y León", "ES414", "PALENCIA"],
  ["35", "Las Palmas", "Canarias", null, "LAS PALMAS"],
  ["36", "Pontevedra", "Galicia", "ES114", "PONTEVEDRA"],
  ["37", "Salamanca", "Castilla y León", "ES415", "SALAMANCA"],
  ["38", "Santa Cruz de Tenerife", "Canarias", null, "SANTA CRUZ DE TENERIFE"],
  ["39", "Cantabria", "Cantabria", "ES130", "CANTABRIA"],
  ["40", "Segovia", "Castilla y León", "ES416", "SEGOVIA"],
  ["41", "Sevilla", "Andalucía", "ES618", "SEVILLA"],
  ["42", "Soria", "Castilla y León", "ES417", "SORIA"],
  ["43", "Tarragona", "Cataluña", "ES514", "TARRAGONA"],
  ["44", "Teruel", "Aragón", "ES242", "TERUEL"],
  ["45", "Toledo", "Castilla-La Mancha", "ES425", "TOLEDO"],
  ["46", "Valencia/València", "Comunitat Valenciana", "ES523", "VALÈNCIA / VALENCIA"],
  ["47", "Valladolid", "Castilla y León", "ES418", "VALLADOLID"],
  ["48", "Bizkaia", "País Vasco", "ES213", "BIZKAIA"],
  ["49", "Zamora", "Castilla y León", "ES419", "ZAMORA"],
  ["50", "Zaragoza", "Aragón", "ES243", "ZARAGOZA"],
  // Ceuta y Melilla son ciudades autónomas: la BDNS no las trae como entidad local.
  ["51", "Ceuta", "Ciudad Autónoma de Ceuta", "ES630", null],
  ["52", "Melilla", "Ciudad Autónoma de Melilla", "ES640", null],
];

// Isla (nombre INE) → NUTS3 y palabras con las que aparece su cabildo o consell.
const ISLAS: Record<string, { nuts: string; claves: string[] }> = {
  Mallorca: { nuts: "ES532", claves: ["MALLORCA"] },
  Menorca: { nuts: "ES533", claves: ["MENORCA"] },
  Ibiza: { nuts: "ES531", claves: ["EIVISSA", "IBIZA"] },
  Formentera: { nuts: "ES531", claves: ["FORMENTERA"] },
  Fuerteventura: { nuts: "ES704", claves: ["FUERTEVENTURA"] },
  "Gran Canaria": { nuts: "ES705", claves: ["GRAN CANARIA"] },
  Lanzarote: { nuts: "ES708", claves: ["LANZAROTE"] },
  "Hierro, El": { nuts: "ES703", claves: ["HIERRO"] },
  "Gomera, La": { nuts: "ES706", claves: ["GOMERA"] },
  "Palma, La": { nuts: "ES707", claves: ["LA PALMA"] },
  Tenerife: { nuts: "ES709", claves: ["TENERIFE"] },
};

const PROVINCIAL = /DIPUTACI|CABILDO|CONSELL INSULAR|CONSEJO INSULAR|CONSELL DE FORMENTERA/;

async function leer<T>(ruta: string): Promise<T> {
  const res = await fetch(`${API}${ruta}`);
  if (!res.ok) throw new Error(`${ruta}: ${res.status}`);
  return res.json() as Promise<T>;
}

const hojas = (n: Nodo): Nodo[] =>
  n.children?.length ? n.children.flatMap(hojas) : [n];

async function main() {
  const regiones = await leer<Nodo[]>("/regiones?vpd=GE");
  await new Promise((r) => setTimeout(r, 1100));
  const organos = await leer<Nodo[]>("/organos?vpd=GE&idAdmon=L");

  // NUTS → id BDNS y padre, a partir del árbol de regiones de España.
  const nuts = new Map<string, { id: number; nombre: string; padre: string | null }>();
  const recorrer = (n: Nodo, padre: string | null) => {
    const [codigo, ...resto] = n.descripcion.split(" - ");
    nuts.set(codigo.trim(), { id: n.id, nombre: resto.join(" - ").trim(), padre });
    n.children?.forEach((c) => recorrer(c, codigo.trim()));
  };
  regiones.forEach((r) => recorrer(r, null));
  const cadena = (codigo: string): string[] => {
    const out: string[] = [];
    for (let c: string | null = codigo; c; c = nuts.get(c)?.padre ?? null) out.unshift(c);
    return out;
  };
  const id = (codigo: string) => {
    const n = nuts.get(codigo);
    if (!n) throw new Error(`NUTS desconocido: ${codigo}`);
    return n.id;
  };

  const provincias = PROVINCIAS.map(([ine, nombre, comunidad, nuts3, raiz]) => {
    const islas = nuts3 === null;
    const nuts2 = islas ? (ine === "07" ? "ES53" : "ES70") : nuts3.slice(0, 4);
    const nodo = raiz ? organos.find((o) => o.descripcion === raiz) : undefined;
    if (raiz && !nodo) throw new Error(`Sin raíz de órganos para ${raiz}`);

    const provinciales: { id: number; nombre: string; isla: string | null }[] = [];
    const municipios: {
      nombre: string;
      clave: string;
      organos: number[];
      isla: string | null;
      nuts3: string | null;
    }[] = [];
    const islasMunicipio = islasIne.municipios.filter((m) => m.ine.startsWith(ine));

    for (const hijo of nodo?.children ?? []) {
      const leaves = hojas(hijo);
      if (PROVINCIAL.test(hijo.descripcion) || leaves.some((h) => PROVINCIAL.test(h.descripcion))) {
        for (const h of leaves) {
          // Los consorcios de una zona (residuos por áreas…) no cubren toda la provincia.
          if (/^CONSORCIO/.test(h.descripcion.trim()) && !/PROVINCI|INSULAR/.test(h.descripcion))
            continue;
          const isla = islas
            ? (Object.entries(ISLAS).find(([, v]) =>
                v.claves.some((c) => h.descripcion.includes(c) || hijo.descripcion.includes(c)),
              )?.[0] ?? null)
            : null;
          provinciales.push({ id: h.id, nombre: h.descripcion, isla });
        }
        continue;
      }
      if (/^(MANCOMUN|CONSORCI|COMARCA|AREA METROPOL|ÁREA METROPOL|ENTIDAD METROPOL)/.test(hijo.descripcion))
        continue;
      let isla: string | null = null;
      if (islas) {
        const m = islasMunicipio.find((x) => claveNombre(x.municipio) === claveNombre(hijo.descripcion));
        isla = m?.isla ?? null;
      }
      municipios.push({
        nombre: hijo.descripcion,
        clave: claveNombre(hijo.descripcion),
        organos: leaves.map((h) => h.id),
        isla,
        nuts3: isla ? ISLAS[isla].nuts : null,
      });
    }

    const nutsBase = islas ? nuts2 : nuts3;
    const cadenaProvincia = cadena(nutsBase);
    const nuts3Comunidad = [...nuts.entries()]
      .filter(([c]) => c.startsWith(nuts2) && c.length === 5)
      .map(([c]) => c);
    return {
      ine,
      nombre,
      comunidad,
      nuts: cadenaProvincia,
      regionesEstado: [...cadenaProvincia.map(id), id("XXXX")],
      regionesComunidad: [id(nuts2), ...nuts3Comunidad.map(id)],
      provinciales,
      municipios,
    };
  });

  // Municipios de islas sin pareja en el INE: avisar para revisarlos a mano.
  for (const p of provincias)
    for (const m of p.municipios)
      if ((p.ine === "07" || p.ine === "35" || p.ine === "38") && !m.isla)
        console.warn(`Sin isla: ${p.nombre} · ${m.nombre}`);

  const salida = {
    generado: new Date().toISOString().slice(0, 10),
    fuentes: [
      `${API}/regiones?vpd=GE`,
      `${API}/organos?vpd=GE&idAdmon=L`,
      islasIne.fuente,
    ],
    islas: Object.fromEntries(
      Object.entries(ISLAS).map(([k, v]) => [k, { nuts: v.nuts, regionId: id(v.nuts) }]),
    ),
    provincias,
  };
  await Bun.write("src/datos/territorio.json", JSON.stringify(salida));
  const total = provincias.reduce((n, p) => n + p.municipios.length, 0);
  console.log(`territorio.json: ${provincias.length} provincias, ${total} municipios`);
}

if (import.meta.main) await main();
