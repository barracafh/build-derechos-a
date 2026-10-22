import { describe, expect, test } from "bun:test";
import catalogo from "../../datos/catalogo-tramites-ayudas.json";
import { type Ayuda, decidir, fusionar, similitud, urlsDeCatalogo } from "./dedup";

const sinCodigos = { sia: [], idProc: [], bdns: [], boe: [] };

function ayuda(parcial: Partial<Ayuda> & { id: string }): Ayuda {
  return {
    titulo: parcial.id,
    organismo: null,
    enlace_info: `https://example.gob.es/${parcial.id}`,
    enlace_tramite: null,
    fuente: parcial.enlace_info ?? `https://example.gob.es/${parcial.id}`,
    codigos: sinCodigos,
    ...parcial,
  };
}

const PEI_2025 = "Prestaciones Económicas Individuales (P.E.I.) para las personas con discapacidad para el ejercicio 2025. Solicitud de ayudas para la atención especializada residencial";
const PEI_2024 = PEI_2025.replace("2025", "2024");
const CONSELLERIA = "Conselleria de Servicios Sociales, Familia e Infancia";

const pei2025 = ayuda({
  id: "pei-2025",
  titulo: PEI_2025,
  organismo: CONSELLERIA,
  enlace_info: "https://sede.gva.es/es/detall-tramit?id_proc=G97829",
  codigos: { sia: ["3152996"], idProc: ["G97829", "13141", "22648"], bdns: [], boe: [] },
});
const pei2024 = ayuda({
  id: "pei-2024",
  titulo: PEI_2024,
  organismo: CONSELLERIA,
  enlace_info: "https://sede.gva.es/es/detall-tramit?id_proc=G94985",
  // Same menu links as PEI 2025: they must not merge the two.
  codigos: { sia: ["3052915"], idProc: ["G94985", "13141", "22648"], bdns: [], boe: [] },
});

const catalogoUrls = urlsDeCatalogo(catalogo);

describe("urlsDeCatalogo", () => {
  test("holds the canonical enlace_info, enlace_tramite and every fuente URL of the catalogue", () => {
    expect(catalogoUrls.has("https://www.sepe.es/HomeSepe/prestaciones-desempleo/subsidio-desempleo.html")).toBe(true);
    expect(catalogoUrls.has("https://sede.sepe.gob.es/PSolicitudUnicaWEB/solicitudUnica")).toBe(true);
    expect(
      catalogoUrls.has("https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/trabajo14/paginas/2024/210624-reforma-subsidio-desempleo.aspx"),
    ).toBe(true);
    // Canonical: the catalogue writes it with ?lang=1.
    expect(catalogoUrls.has("https://sede.valencia.es/sede/registro/procedimiento/PA.GP.11")).toBe(true);
  });
});

describe("decidir", () => {
  test("skips an aid that is already in the catalogue, even written another way", () => {
    const imv = ayuda({
      id: "imv",
      enlace_info: "https://WWW.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/65850d68-8d06-4645-bde7-05374ee42ac7/#requisitos",
    });
    expect(decidir(imv, [], catalogoUrls)).toEqual({ tipo: "catalogo" });
  });

  test("merges by canonical URL", () => {
    const otra = ayuda({ id: "otra", enlace_info: "https://sede.gva.es/va/detall-tramit/?id_proc=G97829&utm_source=x" });
    expect(decidir(otra, [pei2025], catalogoUrls)).toEqual({ tipo: "fusionar", id: "pei-2025" });
  });

  test("merges by a URL already recorded as an alias", () => {
    const otra = ayuda({ id: "otra", enlace_info: "https://www.gva.es/es/inicio/procedimientos?id_proc=97829" });
    const alias = new Map([["https://www.gva.es/es/inicio/procedimientos?id_proc=97829", "pei-2025"]]);
    expect(decidir(otra, [pei2025], catalogoUrls, alias)).toEqual({ tipo: "fusionar", id: "pei-2025" });
  });

  test("merges the same SIA code found on another site", () => {
    const enOtraWeb = ayuda({ id: "pag", enlace_info: "https://administracion.gob.es/pag/tramite/3152996", codigos: { ...sinCodigos, sia: ["3152996"] } });
    expect(decidir(enOtraWeb, [pei2025], catalogoUrls)).toEqual({ tipo: "fusionar", id: "pei-2025" });
  });

  test("merges by the id_proc of the aid's own URL", () => {
    const gvaEs = ayuda({ id: "gva-es", enlace_info: "https://www.gva.es/es/inicio/procedimientos?id_proc=G97829" });
    expect(decidir(gvaEs, [pei2025], catalogoUrls)).toEqual({ tipo: "fusionar", id: "pei-2025" });
  });

  test("does not merge on id_proc links from the menu, on BOE ids or on BDNS numbers", () => {
    const otra = ayuda({
      id: "otra",
      titulo: "Bono social térmico",
      enlace_info: "https://sede.gva.es/es/detall-tramit?id_proc=G107979",
      codigos: { sia: [], idProc: ["G107979", "13141"], bdns: ["935684"], boe: ["BOE-A-2015-11430"] },
    });
    const conLey = ayuda({ id: "con-ley", titulo: "Nacimiento y cuidado de menor", codigos: { ...sinCodigos, bdns: ["935684"], boe: ["BOE-A-2015-11430"] } });
    expect(decidir(otra, [pei2025, conLey], catalogoUrls)).toEqual({ tipo: "insertar" });
  });

  test("flags a near-identical title without a shared code, and does not merge it", () => {
    expect(decidir(pei2024, [pei2025], catalogoUrls)).toEqual({ tipo: "insertar", posibleDuplicado: "pei-2025" });
  });

  test("inserts a new aid with nothing in common", () => {
    expect(decidir(ayuda({ id: "nueva", titulo: "Pensión no contributiva de jubilación", organismo: "IMSERSO" }), [pei2025], catalogoUrls)).toEqual({
      tipo: "insertar",
    });
  });
});

describe("similitud", () => {
  test("ignores case, accents and punctuation", () => {
    expect(similitud("Pensión NO contributiva, jubilación", "pension no contributiva jubilacion")).toBe(1);
  });

  test("is at least 0.8 for the two PEI calls and low for unrelated aids", () => {
    expect(similitud(`${PEI_2025} ${CONSELLERIA}`, `${PEI_2024} ${CONSELLERIA}`)).toBeGreaterThanOrEqual(0.8);
    expect(similitud("Ingreso Mínimo Vital", "Bono social térmico")).toBeLessThan(0.3);
  });
});

describe("fusionar", () => {
  test("keeps the existing id, takes the new content and joins codes and sources", () => {
    const nueva = ayuda({
      id: "pag",
      titulo: "PEI 2025",
      enlace_info: "https://administracion.gob.es/pag/tramite/3152996",
      codigos: { sia: ["3152996"], idProc: [], bdns: [], boe: ["BOE-A-2003-10115"] },
    });
    const fusionada = fusionar(pei2025, nueva);
    expect(fusionada.id).toBe("pei-2025");
    expect(fusionada.titulo).toBe("PEI 2025");
    expect(fusionada.enlace_info).toBe(pei2025.enlace_info);
    expect(fusionada.codigos).toEqual({ sia: ["3152996"], idProc: ["G97829", "13141", "22648"], bdns: [], boe: ["BOE-A-2003-10115"] });
    expect(fusionada.fuente).toBe(`${pei2025.fuente} ; https://administracion.gob.es/pag/tramite/3152996`);
  });
});
