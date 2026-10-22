# S4 Centralise aids (optional)

**Implements**: [RFC · Specs S4](../../RFC.md#specs) · [ARCHITECTURE · Scaling to more sources](../../ARCHITECTURE.md#scaling-to-more-sources)

## Goal

Unstructured aid and benefit texts become `Ficha` entries that the engine returns like any other source.

## Requirements

- [ ] FR-001 — `bun run indexar` MUST read each text file in `src/datos/fuentes/` and write `src/datos/central.json` as `Ficha[]` with `fuente: "central"`.
- [ ] FR-002 — Each field MUST come from a literal quote of its source text; a field with no quote MUST stay empty, and the ficha MUST have `verificado: false`.
- [ ] FR-003 — The script MUST make at most one LLM call per source file and skip files whose content hash is unchanged.
- [ ] FR-004 — The script MUST reject an entry without title or official link, and say which file failed.
- [ ] FR-005 — `buscarAyudas` MUST include matching central fichas, ranked with the same rules; S1 and S3 MUST need no change.

## Files

| Path | Change |
|------|--------|
| `src/datos/fuentes/` | new — one text file per aid or benefit, with its official URL on line 1 |
| `scripts/indexar.ts` | new — extract, check quotes, write the store |
| `src/datos/central.json` | new — generated store, versioned |
| `src/lib/motor/central.ts` | new — reads the store as one more source |
| `src/lib/motor/index.ts` | edit — add the central source |
| `package.json` | edit — add `"indexar"` script |

## Tasks

- [ ] T001 Write extraction, quote check, hash skip and rejects with tests in `scripts/indexar.ts`; add the script to `package.json` → FR-001, FR-002, FR-003, FR-004
- [ ] T002 Read the store in `src/lib/motor/central.ts` and add it in `src/lib/motor/index.ts`, with a test that a new source file appears in the result → FR-005

## Assumptions

- Sources are plain text files that the team adds by hand (RFC open question 5); the script does no scraping.
- Starts only after S2 is merged.
