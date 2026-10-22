// Comparación de nombres de lugares y textos sin tildes, mayúsculas ni signos.

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// «GUANCHA, LA» y «La Guancha» → «la guancha». Las variantes bilingües
// («ALICANTE/ALACANT») quedan separadas por «|».
export function claveNombre(nombre: string): string {
  return nombre
    .split("/")
    .map((parte) => {
      const m = parte
        .trim()
        .match(/^(.*),\s*(la|el|los|las|l'|els|les|es|sa|ses|o|a|os|as|lo)$/i);
      return normalizar(m ? `${m[2]} ${m[1]}` : parte);
    })
    .join("|");
}

export const variantes = (clave: string) => clave.split("|");
