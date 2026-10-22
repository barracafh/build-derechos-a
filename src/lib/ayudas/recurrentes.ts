// Ayudas que tradicionalmente han sido anuales y que el año pasado se abrieron
// por estas fechas (de hoy a dos meses). No se dice nunca cuándo abrirán: solo
// cuándo se pudieron pedir el año pasado, que es un dato comprobable.
//
// Sin búsquedas propias (la BDNS pide una petición por segundo): salen de la
// búsqueda principal, que ya cubre los últimos 365 días. Las del año pasado
// son las recibidas al principio de ese año; si este año ya hay una parecida,
// no se anuncia. Solo se leen unas pocas fichas, con prioridad baja.
import { leerFicha, type Prioridad, type ResultadoBusqueda } from "./bdns";
import { AUTONOMO, NO_SOLICITABLE_TITULO, PERSONA_FISICA, type ArgsBuscar, type Nivel } from "./buscar";
import { desdeApi, enlacesDe, type Enlaces } from "./convocatoria";
import { normalizar } from "./nombres";
import { fechaLegible, sumarDias } from "./plazo";
import { palabrasEnTitulo, relevancia, sinOrganismo, temasQueEncajan, type Tema } from "./temas";
import { regionCubre, type Ubicacion } from "./territorio";

export type Recurrente = {
  id: string;
  titulo: string;
  organismo: string;
  nivel: Nivel;
  // Cuándo se pudo pedir el año pasado (AAAA-MM-DD).
  abrio: string;
  cerro: string | null;
  texto: string;
  encaja_con: Tema[];
  palabras_en_titulo: string[];
  enlace: string;
  enlaces: Enlaces;
};

const VENTANA_DIAS = 60;
const MAX_FICHAS = 2;
const MAX_RESULTADOS = 6;

// Puntuales aunque lleven año (decretos, urgencias, catástrofes, premios) o que
// no son para el público general (investigación).
const PUNTUAL =
  /\b(real decreto|decreto ley|dana|urgente|urgencia|extraordinari|emergencia|catastrof|incendio|inundacion|terremoto|volcan|premio|concurso|certamen|investigaci)/;


// Sin fechas («de 12 de diciembre de 2025»): el año que queda es el de la convocatoria.
const sinFechas = (t: string) =>
  t.replace(/\b\d{1,2} de [a-z]+ de \d{4}\b/g, " ").replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, " ");

// «convocatoria 2025», «en 2025», «curso 2025-2026», «2025/26».
function esDelAno(titulo: string, ano: number): boolean {
  const t = sinFechas(sinOrganismo(titulo));
  return new RegExp(`\\b${ano}\\b|\\b${ano}\\s*[-/]\\s*(${ano + 1}|${String(ano + 1).slice(2)})\\b`).test(t);
}

// Palabras que identifican la ayuda, sin años, fechas ni números.
function huella(titulo: string): Set<string> {
  const t = sinFechas(sinOrganismo(titulo)).replace(/\d+/g, " ");
  return new Set(t.split(/[^a-zñç]+/).filter((p) => p.length > 3));
}

function parecidas(a: Set<string>, b: Set<string>, umbral = 0.6): boolean {
  const comunes = [...a].filter((p) => b.has(p)).length;
  return comunes / Math.max(1, Math.min(a.size, b.size)) >= umbral;
}

export type Publicadas = {
  resultados: (ResultadoBusqueda & { nivel: Nivel })[];
  // Niveles que la BDNS no devolvió enteros: sin ellos no se sabe si ha vuelto a salir.
  incompletos: Nivel[];
};

export async function buscarRecurrentes(
  u: Ubicacion,
  args: ArgsBuscar,
  hoy: string,
  publicadas: Promise<Publicadas>,
  p: Prioridad,
): Promise<Recurrente[]> {
  const hace1Ano = sumarDias(hoy, -365);
  const hasta = sumarDias(hace1Ano, VENTANA_DIAS);
  const ano = Number(hace1Ano.slice(0, 4));
  const temas = args.temas ?? [];
  const palabras = args.palabras ?? [];
  const { resultados, incompletos } = await publicadas;

  const vistas = new Set<string>();
  const candidatas = resultados
    .filter((r) => {
      if (vistas.has(r.numeroConvocatoria) || incompletos.includes(r.nivel)) return false;
      vistas.add(r.numeroConvocatoria);
      // Recibida antes del final de la ventana: abre, como mucho, dentro de dos meses.
      if (r.fechaRecepcion.slice(0, 10) > hasta) return false;
      const t = normalizar(r.descripcion);
      if (NO_SOLICITABLE_TITULO.test(r.descripcion) || PUNTUAL.test(t)) return false;
      if (!esDelAno(r.descripcion, ano)) return false;
      // Si este año ya hay una parecida, no es «por venir». No se exige el mismo
      // organismo (las consejerías cambian de nombre) y el parecido pedido es
      // menor: ante la duda, no se anuncia.
      const h = huella(r.descripcion);
      // Es de este año si llegó medio año después o si lleva el año siguiente
      // («curso 2026-2027» publicada en marzo).
      return !resultados.some(
        (x) =>
          (x.fechaRecepcion > sumarDias(r.fechaRecepcion.slice(0, 10), 180) ||
            (x.fechaRecepcion > r.fechaRecepcion && esDelAno(x.descripcion, ano + 1))) &&
          parecidas(h, huella(x.descripcion), 0.5),
      );
    })
    .map((r) => ({ ...r, puntos: relevancia(r.descripcion, null, temas, palabras) }))
    .filter((r) => !(temas.length || palabras.length) || r.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, MAX_FICHAS);

  const leidas = await Promise.all(
    candidatas.map(async (cand) => {
      try {
        const c = desdeApi(await leerFicha(cand.numeroConvocatoria, p));
        const abrio = c.plazo.inicio?.slice(0, 10) ?? null;
        const cerro = c.plazo.fin?.slice(0, 10) ?? null;
        // Que abriera hace un año, más o menos, entre hoy y dentro de dos meses.
        if (!abrio || abrio < sumarDias(hace1Ano, -7) || abrio > hasta) return null;
        if (c.tipoConvocatoria && /instrumental/i.test(c.tipoConvocatoria)) return null;
        const paraPersonas =
          c.beneficiarios.includes(PERSONA_FISICA) || (args.autonomo && c.beneficiarios.includes(AUTONOMO));
        if (c.beneficiarios.length && !paraPersonas) return null;
        if (cand.nivel !== "Local" && c.regiones.length && !c.regiones.some((r) => regionCubre(r, u.nuts)))
          return null;
        const cuando = cerro
          ? `del ${fechaLegible(abrio)} al ${fechaLegible(cerro)}`
          : `desde el ${fechaLegible(abrio)}`;
        const r: Recurrente = {
          id: `bdns:${c.numero}`,
          titulo: c.titulo,
          organismo: c.organo.nivel3,
          nivel: cand.nivel,
          abrio,
          cerro,
          texto: `Tradicionalmente es anual. El año pasado se pudo pedir ${cuando}. Este año aún no se ha publicado: no sabemos si volverá ni cuándo.`,
          encaja_con: temasQueEncajan(c.titulo, c.finalidad, temas),
          palabras_en_titulo: palabrasEnTitulo(c.titulo, palabras),
          enlace: c.enlace,
          enlaces: enlacesDe(c),
        };
        return r;
      } catch {
        return null;
      }
    }),
  );
  return leidas
    .filter((r): r is Recurrente => r !== null)
    .sort((a, b) => a.abrio.localeCompare(b.abrio))
    .slice(0, MAX_RESULTADOS);
}
