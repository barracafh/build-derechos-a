import { lugarEnFrase } from "@/lib/ayudas/territorio";
import { normalizar, LUGARES_CV, LUGARES_FUERA } from "@/lib/lugares";
import type { CampoPerfil, Hecho, Perfil } from "@/lib/tipos";

// Del texto libre a un `Perfil` sin llamar a ningún modelo: reconoce palabras
// y frases concretas. Es el respaldo de la ruta (spec 003, FR-007) y hoy es
// también lo que lee el texto. Cada hecho lleva la cita literal de la persona:
// se corta del texto original, nunca se reescribe.

type Hallazgo = { cita: string; grupos: RegExpExecArray };

function lector(texto: string) {
  const t = normalizar(texto);
  // Las posiciones del texto normalizado y del original coinciden letra a letra.
  return (re: RegExp): Hallazgo | null => {
    const m = re.exec(t);
    return m
      ? { cita: texto.slice(m.index, m.index + m[0].length), grupos: m }
      : null;
  };
}

// Una «inundación» suelta puede ser una tubería rota: solo cuenta con la fecha.
export function hablaDeDana(texto: string): boolean {
  return /\b(dana|riada|inundacion(es)? de (octubre|2024))\b/.test(normalizar(texto));
}

export function perfilDeTexto(texto: string): Perfil {
  const hallar = lector(texto);
  const hechos: Hecho[] = [];
  const poner = (campo: CampoPerfil, valor: string, h: Hallazgo | null) => {
    if (h) hechos.push({ campo, valor, cita: h.cita });
  };

  // «tengo 24» gana a un «12 años» suelto, que suele ser de un hijo.
  const edad =
    hallar(/\btengo (\d{2})\b/) ?? hallar(/\b(\d{2}) (?:anos|años)\b/);
  if (edad) {
    const n = Number(edad.grupos[1]);
    if (n >= 16 && n <= 99) poner("edad", String(n), edad);
  }

  const lugar = (lista: string[]) =>
    hallar(new RegExp(`\\b(?:${lista.join("|")})\\b`));
  const cv = lugar(LUGARES_CV);
  const fuera = lugar(LUGARES_FUERA);
  // Fuera de las listas: «vivo en Adeje», «soy de Lugo»… cualquier municipio de España.
  const enFrase = cv || fuera ? null : lugarEnFrase(normalizar(texto));
  const otro: Hallazgo | null = enFrase
    ? { cita: texto.slice(enFrase.desde, enFrase.hasta), grupos: [] as unknown as RegExpExecArray }
    : null;
  const sitio = cv ?? fuera ?? otro;
  poner("municipio", sitio?.cita ?? "", sitio);

  const agotado = hallar(
    /(se (me )?(ha )?acab(ado|o) (el )?(paro|subsidio)|agot(e|ado) (el )?paro|sin paro|acabat l.atur)/,
  );
  const paro = hallar(
    /\b(en paro|paro|desempleo|desemplead[oa]|sin trabajo|sin empleo|atur|me han echado|despedid[oa])\b/,
  );
  if (agotado) poner("situacionLaboral", "paro agotado", agotado);
  else poner("situacionLaboral", "en paro", paro);
  poner(
    "situacionLaboral",
    "autónomo",
    hallar(/\b(autonom[oa]|freelance|cuenta propia)\b/),
  );

  const sinIngresos = hallar(
    /(sin ingresos|no tengo ingresos|sin dinero|no tengo dinero|no tinc ingressos|cero ingresos|no cobro nada)/,
  );
  const pocos = hallar(
    /(ingresos bajos|pocos ingresos|bajos ingresos|cobro poco|gano poco|no llego|fin de mes|pocs ingressos|sueldo bajo)/,
  );
  if (sinIngresos) poner("ingresos", "sin ingresos", sinIngresos);
  else poner("ingresos", "bajos", pocos);

  poner("vivienda", "alquiler", hallar(/\b(alquiler|alquilo|alquilad[oa]|lloguer|llogue)\b/));

  const tresOMas = hallar(/\b(3|tres|4|cuatro|5|cinco) (hij[oa]s|nin[oa]s|fills)\b/);
  const hijos = hallar(
    /\b(hij[oa]s?|nin[oa]s?|bebes?|fills?|crios?|menores a cargo)\b/,
  );
  const numerosa = hallar(/familia numerosa/);
  if (tresOMas) poner("hijos", "tres o más", tresOMas);
  else if (hijos) poner("hijos", "sí", hijos);
  else poner("hijos", "familia numerosa", numerosa);

  poner("pension", "sí", hallar(/\b(jubilad[oa]|pensionista|jubilat|pension)\b/));

  // Lo que pide, con sus palabras: la luz, el comedor, los libros, el cole.
  const necesidades = [
    hallar(/\b(luz|electricidad|electrica|llum)\b/),
    hallar(/\b(comedor|menjador)\b/),
    hallar(/\b(libros|llibres|banco de libros|xarxa llibres)\b/),
    hallar(
      /\b(cole|colegio|escuela|escolar|instituto|primaria|eso|bachillerato|edad escolar)\b/,
    ),
  ]
    .flatMap((h) => (h ? [h.cita] : []))
    .filter((c, i, a) => a.indexOf(c) === i);

  return {
    hechos,
    necesidad: necesidades.length ? necesidades.join("; ") : null,
  };
}
