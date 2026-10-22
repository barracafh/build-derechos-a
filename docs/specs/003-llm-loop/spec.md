# S3 LLM loop

**Implements**: [RFC · Specs S3](../../RFC.md#specs) · [ARCHITECTURE · One run](../../ARCHITECTURE.md#one-run)

## Goal

`POST /api/chat` answers a conversation with catalogue aid cards for the S1 UI: the LLM suggests facts and aid ids, and code validates every one before it reaches the answer.

## Requirements

- [X] FR-001 — The route MUST use the S0 contracts in `src/lib/tipos.ts` unchanged; every catalogue `Ficha` carries `detalle` for the UI.
- [X] FR-002 — The route MUST accept `{mensajes}` with 1–20 items, each `rol` in `usuario|asistente` and `texto` of 1–2,000 characters, at least one `usuario`; otherwise 400 with `{error}`. It MUST NOT log or store citizen text.
- [X] FR-003 — The route MUST make at most 2 `completar()` calls, the second only if the first throws, takes over 20 s or returns no valid JSON; each sends all messages and the 8 catalogue aids as a closed list (`id`, `titulo`, `frases_usuario`).
- [X] FR-004 — Code MUST drop each LLM `hecho` whose `campo` is not a `CampoPerfil`, whose `valor` fails its field rule, or whose `cita` is not a substring of a user message (case and whitespace ignored); the last valid `hecho` per field wins. `necesidad` follows the same quote rule, else null.
- [X] FR-005 — Code MUST drop each LLM pick whose `id` is not one of the 8 aids, that has no valid `cita`, or that a kept `hecho` blocks (`bloqueada`), without duplicates.
- [X] FR-006 — Each `Ficha` MUST come from `crearFicha` (catalogue, `src/datos/lectura-facil.ts`, `src/datos/estados.ts`); `porQue` is `Dices: «<cita>».` per valid quote. No other LLM text reaches a `Ficha`.
- [X] FR-007 — Fichas MUST be ordered by status: open, no deadline, unconfirmed, closed.
- [X] FR-008 — `pregunta` MUST be the fixed text for the missing field in most `pendiente`, or null.
- [X] FR-009 — A last user message about the DANA MUST return no fichas without calling the LLM, and name `https://sede.gva.es` in `cobertura.noConsultado`.
- [X] FR-010 — If both attempts fail, the route MUST return 200 with `perfilDeTexto` and the catalogue rules (`fichasDelCatalogo`), and say so first in `noConsultado`.
- [X] FR-011 — `cobertura` MUST name the catalogue and, from `noCubiertoPor`, what was not checked.
- [X] FR-012 — Tests with a faked LLM MUST cover the 4 `SETUP.md` profiles on both paths; `bun run typecheck`, `bun run build` and `bun test` MUST pass.

## Files

| Path | Change |
|------|--------|
| `src/lib/motor/catalogo.ts` | edit — export `crearFicha`, `bloqueada`, `porEstado`, `IDS_AYUDAS`; the rules use `crearFicha` |
| `src/lib/llm/perfil.ts` | new — prompt, JSON parse, fact and pick validation |
| `src/lib/llm/index.ts` | new — `responder(mensajes, {completar, hoy})`: DANA, retries, fichas, fallback, coverage |
| `src/app/api/chat/route.ts` | edit — validation, calls `responder` |
| `src/lib/llm/*.test.ts`, `src/app/api/chat/route.test.ts` | new/edit — tests, no network |

## Decisions

- **The LLM picks ids from a closed list; `bloqueada` and the quote check decide** — reads free text the rules miss and never invents an aid; overrides the RFC row "LLM picks the aids directly".
- **Fallback is the S1 author's regex reader and rules** — already written and tested, with plain-language reasons; beats a second keyword matcher.
- **Only the 8 aids** — the UI is built for aids ("Podrías optar a N ayudas"); trámites wait until `Ficha` can tell them apart.

## Tasks

- [X] T001 Export `crearFicha`, `bloqueada`, `porEstado` and `IDS_AYUDAS` from `src/lib/motor/catalogo.ts` → FR-005, FR-006, FR-007
- [X] T002 Write prompt, parse, fact and pick validation with tests in `src/lib/llm/perfil.ts` → FR-003, FR-004, FR-005
- [X] T003 Wire DANA, retries, fichas, fallback, question and coverage in `src/lib/llm/index.ts`; test the 4 profiles on both paths → FR-001, FR-006–FR-012
- [X] T004 Point the route at `responder`, keep its 400 tests in `src/app/api/chat/` → FR-002, FR-012

## Assumptions

- Closed values: `situacionLaboral` in `en paro|paro agotado|trabajando|autónomo|jubilado|estudiando|otra`; `vivienda` in `alquiler|habitación|propiedad|otra`; `ingresos` in `sin ingresos|bajos|medios|altos`; `edad` and `hijos` digit strings that match any digits in their quote.
- `bloqueada`: Bono Alquiler Joven outside 18–35 or with `vivienda: propiedad`; CAPI, comedor and Banco de Libros with `hijos: "0"`; Generalitat aids outside the Comunitat.
