# S2 Engine / API

**Implements**: [RFC · Specs S2](../../RFC.md#specs) · [ARCHITECTURE · One run](../../ARCHITECTURE.md#one-run)

## Goal

`buscarAyudas(perfil)` returns the catalogue aids and live BDNS calls that could fit, with status from dates, ranked, and an honest coverage report.

## Requirements

- [ ] FR-001 — The 8 catalogue aids (`tipo: "ayuda"`) MUST stay unless a stated fact blocks them; each kept aid MUST list in `pendiente` the fields that would decide it.
- [ ] FR-002 — The engine MUST run the 3 searches of `SETUP.md` (Generalitat, State, Ayuntamiento de València; `tiposBeneficiario=1`) in parallel, each with a 5 s timeout.
- [ ] FR-003 — The engine MUST drop "concesión directa - instrumental" calls and fetch at most 10 fichas, with at most 3 requests in flight.
- [ ] FR-004 — Status MUST come from `fechaInicioSolicitud`/`fechaFinSolicitud` against today; `abierto` alone MUST map to `permanente`; no dates and no `abierto` MUST map to `desconocido`.
- [ ] FR-005 — Results MUST be ranked by need-to-purpose match, then title-keyword overlap; catalogue aids go first.
- [ ] FR-006 — If a BDNS call fails or times out, the engine MUST use `datos/bdns-convocatorias-cv.json`, normalised to the same shape, and set `respaldo: true`.
- [ ] FR-007 — `cobertura` MUST name what was not checked: municipal aids outside València and self-employed calls (`tiposBeneficiario=3`).
- [ ] FR-008 — Fichas MUST be cached in memory for 10 minutes by BDNS number.

## Files

| Path | Change |
|------|--------|
| `src/lib/bdns.ts` | new — searches, ficha fetch, pack fallback, API/pack normalisation |
| `src/lib/motor/catalogo.ts` | new — one rule per catalogue aid |
| `src/lib/motor/estado.ts` | new — status from dates |
| `src/lib/motor/ranking.ts` | new — need-to-purpose map and keyword score |
| `src/lib/motor/index.ts` | edit — real `buscarAyudas`, replaces the S0 stub |
| `src/lib/motor/grabaciones/` | new — recorded BDNS responses for tests |
| `src/lib/motor/*.test.ts` | new — tests on recordings, no network |

## Decisions

- **At most 3 ficha requests in flight** — 10 fichas in about 4 s; beats strict 1 req/s (13 s per answer) and unbounded parallel (rate-limit risk).

## Tasks

- [ ] T001 [P] Write status from dates with tests in `src/lib/motor/estado.ts` → FR-004
- [ ] T002 [P] Write the 8 catalogue rules with tests on the 4 profiles in `src/lib/motor/catalogo.ts` → FR-001
- [ ] T003 [P] Write ranking with tests in `src/lib/motor/ranking.ts` → FR-005
- [ ] T004 Record one response per call into `src/lib/motor/grabaciones/`; write `src/lib/bdns.ts` with tests for filter, limit, timeout, fallback and cache → FR-002, FR-003, FR-006, FR-008
- [ ] T005 Wire it all in `src/lib/motor/index.ts` with coverage; test the 4 profiles end to end on recordings → FR-007

## Assumptions

- `fechaDesde` is 01/07/2026, as in the tested calls of `SETUP.md`.
- The need-to-purpose map uses BDNS `finalidades` (e.g. 8 = vivienda) and is hand-written for the needs of the 4 profiles.
