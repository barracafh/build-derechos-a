// Seed pages for the S4 indexing job (docs/specs/004-central-aids/spec.md).
// Each seed is an official page that lists aids outside BDNS. Probed with a
// plain GET on 2026-10-22; recordings in scripts/indexar/grabaciones/.

export type Semilla = {
  id: string;
  url: string;
  // Absolute URL of an aid page linked from the seed.
  patron: RegExp;
  administracion: "Estado" | "Comunitat Valenciana" | "Local";
  // Links that match `patron` but are not aids.
  excluir?: RegExp;
  // Listing text (title, office) of procedures that are not aids for a person, dropped before any fetch.
  excluirTexto?: RegExp;
  // The seed is paged: the job sets `parametro` = 1..max on `url`.
  paginacion?: { parametro: string; max: number };
};

// GVA procedure search: server-rendered results filtered by URL parameters.
// `temas` is the topic, `perfiles=5271` is "Ciudadanía"; at most 100 per page.
// Several topics in one `temas` value are ignored by the server, hence one
// seed per topic.
const GVA_BUSCADOR = "https://sede.gva.es/es/cercador-tramits?perfiles=5271&tamanyoPagina=100";
const GVA_TRAMITE = /^https:\/\/sede\.gva\.es\/(?:es\/)?detall-tramit\?id_proc=[A-Z]?\d+$/;
const GVA_SIMULACION = /id_proc=13141$/;
// GVA listings mix aids with grants to entities, councils' elections, permits and paperwork.
// DANA aids are out of the track (SETUP.md): the chat sends people to sede.gva.es instead.
const GVA_NO_AYUDA =
  /subvenci|premio|beca|convocatoria|concurso|entidad|empresa|ayuntamiento|asociaci|corporaci|contrataci|concierto|acci[oó]n concertada|habilitaci|certificad|inscripci|registro|autorizaci|acreditaci|homologaci|pr[aá]cticas|curso|formaci|candidatur|votaci|elecci|colegio electoral|vocal|consejo|consell|aportaci[oó]n de documentaci|subsanaci|alegaci|recurso|reclamaci|queja|adopci|calificaci|licencia|declaraci[oó]n responsable|comunicaci[oó]n|\bdana\b/i;

export const semillas: Semilla[] = [
  {
    id: "seg-social",
    // Without `changeLanguage=es` the portal answers in English.
    url: "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores?changeLanguage=es",
    patron: /^https:\/\/www\.seg-social\.es\/wps\/portal\/wss\/internet\/Trabajadores\/PrestacionesPensionesTrabajadores\/[\w-]+$/,
    administracion: "Estado",
  },
  {
    id: "sepe",
    url: "https://www.sepe.es/HomeSepe/prestaciones-desempleo.html",
    patron: /^https:\/\/www\.sepe\.es\/HomeSepe\/prestaciones-desempleo\/[\w-]+\.html$/,
    administracion: "Estado",
  },
  {
    id: "imserso",
    url: "https://imserso.es/pnc-prestaciones-subvenciones",
    patron: /^https:\/\/imserso\.es\/pnc-prestaciones-subvenciones\/[\w-]+$/,
    administracion: "Estado",
  },
  {
    id: "gva-servicios-sociales",
    url: `${GVA_BUSCADOR}&temas=5191`,
    patron: GVA_TRAMITE,
    administracion: "Comunitat Valenciana",
    excluir: GVA_SIMULACION,
    excluirTexto: GVA_NO_AYUDA,
    paginacion: { parametro: "pagina", max: 4 },
  },
  {
    id: "gva-familias",
    url: `${GVA_BUSCADOR}&temas=5197`,
    patron: GVA_TRAMITE,
    administracion: "Comunitat Valenciana",
    excluir: GVA_SIMULACION,
    excluirTexto: GVA_NO_AYUDA,
    paginacion: { parametro: "pagina", max: 4 },
  },
  {
    id: "gva-vivienda",
    url: `${GVA_BUSCADOR}&temas=5101`,
    patron: GVA_TRAMITE,
    administracion: "Comunitat Valenciana",
    excluir: GVA_SIMULACION,
    excluirTexto: GVA_NO_AYUDA,
    paginacion: { parametro: "pagina", max: 2 },
  },
  {
    id: "aeat-deducciones",
    // IRPF family and disability deductions (maternity, large family, dependants with disability).
    url: "https://sede.agenciatributaria.gob.es/Sede/irpf.html",
    patron: /^https:\/\/sede\.agenciatributaria\.gob\.es\/Sede\/irpf\/deducciones[\w-]*\.html$/,
    administracion: "Estado",
  },
  {
    id: "gva-deducciones",
    // Regional IRPF deductions and tax benefits, one page per tax year.
    url: "https://hisenda.gva.es/es/web/tributos/beneficis-fiscals",
    patron: /^https:\/\/hisenda\.gva\.es\/es\/web\/tributos\/beneficis-fiscals-202[56]$/,
    administracion: "Comunitat Valenciana",
  },
  {
    id: "gva-dependencia",
    url: "https://serviciossociales.gva.es/es/web/dependencia/cataleg",
    patron: /^https:\/\/serviciossociales\.gva\.es\/es\/web\/dependencia\/(prestaciones-y-servicios|grau-iii-dependencia-extrema|ajudes-ela|informacio-general)$/,
    administracion: "Comunitat Valenciana",
  },
  {
    id: "valencia-programas",
    url: "https://www.valencia.es/cas/bienestar-social-integracion/programas",
    patron: /^https:\/\/www\.valencia\.es\/cas\/bienestar-social-integracion\/programas\/-\/content\/programas\?uid=\w+$/,
    administracion: "Local",
  },
];
