# S4 Centralise aids (optional)

**Implements**: [RFC · Specs S4](../../RFC.md#specs) · [ARCHITECTURE · Scaling to more sources](../../ARCHITECTURE.md#scaling-to-more-sources)

## Goal

A daily job finds the aids that no API gives us (Social Security and SEPE benefits, social bonuses, tax deductions, regional and municipal social benefits), extracts each one with the LLM into the catalogue's shape, and stores it once in our own versioned store; the engine reads it as one more source. Calls for grants (BDNS) are out of scope: spec 002 owns them.

## Requirements

- [X] FR-001 — `src/datos/semillas.ts` MUST list the seed pages (official pages that list aids), each with `id`, `url`, the URL pattern of its aid pages and the `administracion` they belong to.
- [ ] FR-002 — `bun run indexar` MUST fetch each seed and each matching aid page, and the PDFs it links as bases or call, with at most 1 request per second per host, a 10 s timeout and a conditional request (`ETag`/`Last-Modified`) when the server gave one.
- [X] FR-003 — Every URL MUST be canonicalised before any comparison: lowercase host, no fragment, no tracking parameters, no trailing slash, one language variant (`/va/`→`/es/` on gva.es, no `lang` on valencia.es).
- [ ] FR-004 — The hash MUST be SHA-256 of the cleaned main text (no menus, footers, dates of last update or session tokens; whitespace normalised). The job MUST skip a known URL with the same hash, and record a new URL whose hash is known as an alias of that aid, both without calling the LLM.
- [ ] FR-005 — The job MUST make one LLM call per new or changed hash, with input capped at ~12k tokens (page text plus the PDF sections on beneficiaries, requisites, deadline and documents), and at most 30 calls per run; `--backfill` lifts the cap for a manual first fill.
- [ ] FR-006 — Each aid MUST be written with the keys of a `datos/catalogo-tramites-ayudas.json` item, filled as in the table below, plus `codigos`, `documentos: [{titulo, url}]`, `textos` (hashes read) and `consultado`; `tipo: "ayuda"`, `verificado: false`.
- [ ] FR-007 — `organismo`, `requisitos_clave`, `pasos`, `documentacion`, `plazo` and `nota` MUST each be a literal quote found in the text, or stay empty; `enlace_tramite` MUST be a link present on the page, or `null`.
- [X] FR-008 — The job MUST merge into an existing aid when its canonical URL matches, or its SIA code or the `id_proc` of its own URL matches; BOE ids and BDNS numbers MUST NOT merge (pages cite shared laws, and menus link other procedures). The job MUST NOT write an aid whose canonical URL is an `enlace_info`, `enlace_tramite` or `fuente` URL of the catalogue.
- [ ] FR-009 — An aid with no matching URL or code whose normalised `titulo` + `organismo` is similar (trigram Jaccard ≥ 0.8) to an existing one MUST be inserted with `posibleDuplicado: <id>` and logged; the job MUST NOT merge it.
- [ ] FR-010 — Each read text MUST be saved as `src/datos/textos/<hash>.txt`; the app MUST NOT import that folder; PDFs MUST NOT be stored, only linked in `documentos`.
- [ ] FR-011 — The job MUST reject an aid without `titulo` or `enlace_info` and log its URL; a seed that errors MUST keep its previous aids; a seed that returns 0 aid links MUST fail the run; an aid whose every URL returns 404 or 410 MUST be removed.
- [ ] FR-012 — `src/datos/central.json` MUST hold `{version, ambito, aviso, items, rastreo}`, items sorted by `id`, `rastreo` mapping each canonical URL to `{id, hash, etag, consultado}`; an unchanged run MUST give an empty diff.
- [ ] FR-013 — A GitHub Actions workflow MUST run the job daily and on demand (`--dry-run --limit 3` writes nothing), run `bun run build`, and commit and push `src/datos/` only if it changed, after `git pull --rebase`.
- [ ] FR-014 — `buscarAyudas` MUST include the central aids that match the profile's need through `frases_usuario` or `titulo`, as `Ficha` with `fuente: "central"`, after the catalogue aids; specs 002 and 003 MUST need no change.
- [ ] FR-015 — The same LLM call MUST say whether the page is an aid a citizen can apply for (`esAyuda`); pages that are not MUST be recorded in `rastreo` and not written, so mixed seeds (procedures, employment services) need no extra call.
- [ ] FR-016 — The same LLM call MUST return `referencias: [{nombre, cita, url, tipo}]`, the other aids the page mentions, with `tipo` in `requisito | complemento | incompatible | relacionada` and `cita` checked like any quote. The job MUST resolve each one without the LLM: a `url` → canonical URL; no `url` → title match (trigram ≥ 0.8) against the catalogue, the store and the link texts of the seeds.
- [ ] FR-017 — A resolved reference to a known aid MUST add its `id` to `relacionados` and `{id, tipo, cita}` to `relaciones`; a reference to an unknown URL on an official host (`*.gob.es`, `*.gva.es`, `valencia.es`, `boe.es`, `seg-social.es`, `sepe.es`, `imserso.es`) MUST be queued for a second pass in the same run, up to depth 2 from a seed, sharing the 30-call cap; queue overflow MUST persist in `rastreo.pendientes` for the next run; an unresolved reference MUST be logged.
- [ ] FR-018 — After the last pass, the job MUST re-link references to aids created later in the same run, without the LLM.
- [ ] FR-019 — The same LLM call MUST classify the aid's `naturaleza` as `prestacion | bonificacion | deduccion | emergencia_social | servicio | convocatoria` (`contexto.md` §1). The job MUST NOT write an aid that is a `convocatoria` or whose page carries a BDNS number; it MUST record it in `rastreo` as `{cubiertaPor: "bdns"}` and log it.

## Field extraction

| Field | Source | LLM |
|---|---|---|
| `id` | slug of `titulo` + official code if any | no |
| `titulo` | `<h1>` or `og:title`; LLM only if missing | rarely |
| `administracion` | seed | no |
| `organismo`, `requisitos_clave`, `pasos`, `documentacion`, `plazo`, `nota` | literal quotes, checked | yes |
| `frases_usuario` | written by the LLM, no quote (how a citizen asks) | yes |
| `enlace_info` · `enlace_tramite` | canonical page URL · chosen among the page's own links | no · yes |
| `fuente` · `codigos` | page and PDF URLs · SIA, `id_proc`, BDNS, BOE by pattern | no |
| `relacionados` · `relaciones` | references found by the LLM, resolved by code (FR-016–FR-018) | yes, same call |

## Seeds

Probed 2026-10-22 with a plain GET (no JavaScript). T001 confirms each and adds its aid URL pattern.

| Level | Seed | Plain HTML? | Note |
|---|---|---|---|
| Estado | `seg-social.es/…/PrestacionesPensionesTrabajadores` | yes, 27 links | IMV, nacimiento, pensions |
| Estado | `sepe.es/HomeSepe/prestaciones-desempleo.html` | yes, 35 links | benefits and subsidies; filter non-aids |
| Estado | `imserso.es/pnc-prestaciones-subvenciones` | yes, 12 links | PNC and other benefits |
| Estado | `becaseducacion.gob.es/portada.html` | yes, 42 links | dropped: grants are calls, in BDNS |
| Estado | `administracion.gob.es/ayudas/buscador-becas` | search form | dropped: AGE aid and grant calls, in BDNS |
| Estado | `prestaciones.seg-social.es` | no (JS) | dropped; its aids are reached through `seg-social.es` pages |
| Estado | AEAT deductions | no listing found | reached through references from other pages |
| GVA | `sede.gva.es/es/cercador-tramits` (also `gva.es/es/inicio/procedimientos`) | search form, 1 link | biggest source; look for the search endpoint behind the form, else reach `detall-tramit?id_proc=` pages through references |
| GVA | `habitatge.gva.es/…/ayudas` | yes, 6 links | housing; mostly calls (BDNS), kept for the rest |
| GVA | `labora.gva.es/es/ciutadania` | yes, 14 links | mostly services; filter non-aids |
| GVA | `ceice.gva.es/…/ayudas` · `inclusio.gva.es` | 404 | find current URLs |
| València | `valencia.es/cas/tramites/tramites-subvenciones` | yes, 34 links | dropped: municipal grant calls, in BDNS (órgano 2903) |
| València | `valencia.es/cas/derechos-sociales-e-inclusion` | partly, 6 links | social and emergency benefits (not grants since Ley 4/2026); aid pages are deeper, follow its sections |
| València | `valencia.es/cas/tramites` | yes, 39 links | mixed procedures; filter non-aids |
| València | Open Data València (CKAN) | yes, API | dropped: `package_search?q=ayudas` returns statistics and budgets (16 datasets), not aid listings |
| València | `sede.valencia.es` procedures | 404 | find current URL |

## Files

| Path | Change |
|------|--------|
| `src/datos/semillas.ts` | new — seed pages, aid URL patterns, administration |
| `scripts/indexar/url.ts` | new — canonical URL and code patterns |
| `scripts/indexar/texto.ts` | new — HTML/PDF to clean text, hash, section cut |
| `scripts/indexar/extraer.ts` | new — one LLM call, quote and link check |
| `scripts/indexar/dedup.ts` | new — URL/hash/code merge, catalogue skip, near-duplicate flag |
| `scripts/indexar/index.ts` | new — discover, fetch, upsert, remove, write store |
| `scripts/indexar/*.test.ts` · `grabaciones/` | new — tests and recorded pages, no network |
| `src/datos/central.json` · `src/datos/textos/` | new — generated store and read texts, versioned |
| `.github/workflows/indexar.yml` | new — daily cron + `workflow_dispatch` |
| `src/lib/motor/central.ts` | new — reads the store, item → `Ficha`, need match |
| `src/lib/motor/index.ts` | edit — one line adding the central source |
| `package.json` | edit — add `"indexar"` script |

## Decisions

- **LLM in the job, not per question** — one call per changed page fills the catalogue fields once; beats reading pages live per question (latency and tokens per message, S3 change) and links only (empty fields).
- **Quotes checked by code** — the LLM may only copy text it was given; rule 4 of the platform (never invent requisites or deadlines) holds without trusting the model.
- **JSON in the repo, written by a GitHub Actions cron** — no new infra, query in memory, history in git; beats managed Postgres and SQLite.
- **Dedup cheapest first** — canonical URL, text hash, official code; title similarity only flags, because a wrong merge hides an aid.
- **Only what no API gives** — by law every grant call goes to BDNS (LGS art. 20.8.a), which spec 002 reads live; benefits, bonuses, deductions and municipal emergency aid do not (`contexto.md` §2.5, §7.1). Filtering by `naturaleza` keeps both sources disjoint without reading BDNS.
- **No pgvector until measured** — revisit past a few thousand aids or when tests show keyword match missing aids; texts by hash allow it without crawling again.

## Tasks

- [X] T001 Confirm the seeds of the table, find the search endpoints of the PAG and gva.es and the current URLs of the 404 ones; write `src/datos/semillas.ts`; record one seed and two aid pages each, including one pair of pages that reference each other → FR-001
- [X] T002 [P] Write canonical URL and code patterns with tests in `scripts/indexar/url.ts` → FR-003
- [X] T003 [P] Write clean text, hash and section cut with tests in `scripts/indexar/texto.ts`, including a page fetched twice that must hash the same → FR-004, FR-010
- [X] T004 [P] Write merge, catalogue skip and near-duplicate flag with tests in `scripts/indexar/dedup.ts` → FR-008, FR-009
- [ ] T005 Write the extraction prompt (fields, `esAyuda`, `naturaleza`, `referencias`), quote check and link check with tests on a fake LLM in `scripts/indexar/extraer.ts`; compare its output for 2 catalogue aids with the catalogue entries → FR-006, FR-007, FR-015, FR-019
- [ ] T006 Write the job in `scripts/indexar/index.ts` with the reference queue, depth limit and re-link pass; add the script to `package.json`; write the job e2e test (below); run `--backfill` once and commit `src/datos/` → FR-002, FR-005, FR-011, FR-012, FR-016, FR-017, FR-018
- [ ] T007 Write `.github/workflows/indexar.yml`; run it once with `--dry-run --limit 3` → FR-013
- [ ] T008 Write `src/lib/motor/central.ts` and add it in `src/lib/motor/index.ts`, with a test that a new aid appears for a matching need and the 4 profiles of `SETUP.md` still list catalogue aids first → FR-014
- [ ] T009 Check 10 extracted aids by hand against their official pages; note wrong or missing requisites in the run log

## Job e2e test

`Bun.serve` serves the recordings and `HELMCODE_BASE_URL` points to a fake LLM that counts calls; no network. Scenarios: first run writes N aids with N calls (snapshot) · second run makes 0 calls and gives an empty diff · one changed page makes 1 call · same page under two URLs gives one aid and 0 calls · same SIA code on two sites gives one aid · near-identical title without code is flagged · catalogue URL is not written · a quote not in the text leaves the field empty · an invented `enlace_tramite` becomes `null` · page 404 removes its aid · seed 500 keeps its aids · seed with 0 links fails the run · 40 new texts make 30 calls · a non-aid page is not written · a grant call page, or one with a BDNS number, is not written and is marked `cubiertaPor: "bdns"` · a page referencing an unknown official page queues it and both aids end up in each other's `relaciones` chain · a reference by name only resolves to a catalogue aid · a reference to a non-official host is logged, not fetched · a reference cycle (A→B→A) stops · depth 3 is not fetched.

## Assumptions

- BDNS stays in spec 002; the job never reads it and never writes a call. A reference to a call is logged, not followed.
- Seeds that need JavaScript to render are dropped; no headless browser; scanned PDFs are linked, not read.
- `HELMCODE_API_KEY` can be added as a repo secret by an admin of `barracafh`; `--backfill` runs at night to spare the shared quota.
- Estimate to check in T001: 100–300 aids once calls are left out, 5–13k tokens per call; under 10 calls per day after the first fill.
- `estado` of a central aid is `desconocido`; the job never infers dates.
- T001–T007 can start now; T008 starts after spec 002 is merged.
