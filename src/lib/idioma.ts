// Idiomas de la interfaz. El elegido se guarda en una cookie para que el
// servidor pinte la página ya en ese idioma, sin parpadeo.
export type Idioma = "es" | "va";

export const COOKIE_IDIOMA = "idioma";

// Para el atributo lang y las fechas.
export const LANG: Record<Idioma, string> = { es: "es-ES", va: "ca-ES-valencia" };

export const leerIdioma = (valor: string | undefined): Idioma =>
  valor === "va" ? "va" : "es";
