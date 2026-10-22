# S0 Contracts

**Implements**: [RFC · Specs S0](../../RFC.md#specs) · [ARCHITECTURE · Contracts](../../ARCHITECTURE.md#contracts)

## Goal

S1, S2 and S3 can start in parallel against fixed types, realistic fixtures and a mock `/api/chat`.

## Status (2026-10-22)

Done and superseded. S2 and S3 replaced the mock route, the stub `buscarAyudas` and the fixtures of `src/datos/ejemplos/` (removed); FR-002 and FR-004 no longer apply. FR-003's validation (400 on empty `mensajes` or a text over 2,000 characters) lives in the real route. Verified against the code, not re-run as written.

## Requirements

- [X] FR-001 — `src/lib/tipos.ts` MUST export `MensajeChat`, `CampoPerfil`, `Hecho`, `Perfil`, `Ficha`, `Cobertura`, `Respuesta` and `BuscarAyudas` with the shapes under Decisions.
- [ ] FR-002 — `src/datos/ejemplos/` MUST hold one `Respuesta` per test profile of `SETUP.md` (4), using only real catalogue aids and their real links.
- [X] FR-003 — `POST /api/chat` MUST return the fixture whose profile matches the last user message (default: first profile), and 400 if `mensajes` is empty or a text exceeds 2,000 characters.
- [ ] FR-004 — `buscarAyudas` in `src/lib/motor/index.ts` MUST exist as a stub that returns a fixture's `fichas` and `cobertura`.
- [X] FR-005 — `bun run typecheck`, `bun run build` and `bun test` MUST pass.

## Files

| Path | Change |
|------|--------|
| `src/lib/tipos.ts` | new — the contracts |
| `src/datos/ejemplos/index.ts` | new — 4 fixtures typed `Respuesta` |
| `src/lib/motor/index.ts` | new — stub `buscarAyudas` (S2 replaces it) |
| `src/app/api/chat/route.ts` | new — mock route (S3 replaces it) |
| `src/app/api/chat/route.test.ts` | new — 400 cases and fixture choice |
| `package.json` | edit — add `"test": "bun test"` |

## Decisions

- **Shapes** — `MensajeChat {rol: "usuario"|"asistente", texto}`; `Hecho {campo: CampoPerfil, valor, cita}`; `Perfil {hechos: Hecho[], necesidad: string|null}`.
- **Ficha** — `{id, titulo, finalidad, fuente: "catalogo"|"bdns"|"pack"|"central", administracion: "Estado"|"Comunitat Valenciana"|"Local", estado: "abierta"|"cerrada"|"permanente"|"desconocido", fechaFin: string|null, enlace, porQue: string[], requisitos: string[], pendiente: CampoPerfil[], verificado: boolean}`. `pendiente` lists the fields that would confirm or rule out the aid; S3 uses it to pick the question.
- **Cobertura / Respuesta** — `Cobertura {consultado: string[], noConsultado: string[], respaldo: boolean, fechaConsulta}`; `Respuesta {perfil, fichas, cobertura, pregunta: string|null}`.
- **Fixtures in TypeScript, not JSON** — the compiler checks them against `Respuesta`; beats JSON plus a runtime validator.

## Tasks

- [X] T001 Write the types in `src/lib/tipos.ts` → FR-001
- [X] T002 [P] Write the 4 fixtures from `datos/catalogo-tramites-ayudas.json` in `src/datos/ejemplos/index.ts` → FR-002
- [X] T003 [P] Write the stub `buscarAyudas` in `src/lib/motor/index.ts` → FR-004
- [X] T004 Add the test script to `package.json`; write the mock route and its test in `src/app/api/chat/` → FR-003, FR-005
- [X] T005 Run typecheck, build and test → FR-005

## Assumptions

- `CampoPerfil` is `"edad"|"municipio"|"situacionLaboral"|"vivienda"|"hijos"|"ingresos"|"pension"|"discapacidad"`: the fields that the 8 catalogue aids and the 4 profiles need.
- The mock picks a fixture by keywords (`24 años`, `autónoma`, `jubilado`, `3 hijos`).
