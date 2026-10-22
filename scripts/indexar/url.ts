// Canonical URL and official codes for the S4 indexing job (FR-003, FR-006).

const SEGUIMIENTO = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_ga|_gl)$/i;

const esDe = (host: string, dominio: string) => host === dominio || host.endsWith(`.${dominio}`);

// One URL per page, so that two spellings of the same page compare equal.
export function canonica(url: string): string {
  const u = new URL(url);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();

  for (const clave of [...u.searchParams.keys()]) {
    if (SEGUIMIENTO.test(clave)) u.searchParams.delete(clave);
  }

  if (esDe(u.hostname, "gva.es")) {
    u.pathname = u.pathname.replace(/^\/(va|ca)(\/|$)/, "/es$2");
    // sede.gva.es serves the same procedure with and without the /es/ prefix.
    if (u.hostname === "sede.gva.es" && u.pathname.startsWith("/detall-tramit")) u.pathname = `/es${u.pathname}`;
  }
  if (esDe(u.hostname, "valencia.es")) u.searchParams.delete("lang");

  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");

  return u.href.replace(/\?$/, "");
}

export type Codigos = { sia: string[]; idProc: string[]; bdns: string[]; boe: string[] };

const unicos = (valores: string[]) => [...new Set(valores)];
const capturas = (texto: string, patron: RegExp) => [...texto.matchAll(patron)].map((m) => m[1]);

// Official codes found in a page's HTML or text, and in its own URL.
export function codigos(texto: string, url = ""): Codigos {
  const todo = `${url}\n${texto.replaceAll("&amp;", "&")}`;
  return {
    sia: unicos(capturas(todo, /\bSIA\b\s*:?\s*(?:<[^>]*>\s*)*(\d{5,8})\b/gi)),
    idProc: unicos(capturas(todo, /[?&]id_proc=([A-Z]?\d+)\b/g)),
    bdns: unicos([
      ...capturas(todo, /\bBDNS\b\D{0,20}?(\d{5,7})\b/g),
      ...capturas(todo, /infosubvenciones\.es\/bdnstrans\/\w+\/\w+\/convocatorias\/(\d{5,7})\b/g),
      ...capturas(todo, /[?&]numConv=(\d{5,7})\b/g),
    ]),
    boe: unicos(capturas(todo, /\b(BOE-[AB]-\d{4}-\d{1,6})\b/g)),
  };
}
