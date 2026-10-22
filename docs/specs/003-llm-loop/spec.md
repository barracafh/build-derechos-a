# S3 LLM loop

**Implements**: [RFC · Specs S3](../../RFC.md#specs) · [ARCHITECTURE · One run](../../ARCHITECTURE.md#one-run)

## Goal

`POST /api/chat` turns the conversation into a quoted profile with one LLM call and answers with the engine's fichas and the most useful next question.

## Requirements

- [ ] FR-001 — The route MUST accept 1–20 `mensajes`, each ≤ 2,000 characters, and return 400 otherwise.
- [ ] FR-002 — The route MUST make exactly one `completar()` call per request, with all user messages, and parse its JSON into `Perfil`.
- [ ] FR-003 — Each `Hecho.cita` MUST be a literal substring of a user message; the code MUST drop each hecho that fails.
- [ ] FR-004 — Fichas MUST come only from `buscarAyudas(perfil)`; the LLM never names aids, amounts or dates.
- [ ] FR-005 — `pregunta` MUST ask for the `CampoPerfil` that appears most in the fichas' `pendiente`, from a fixed text per field, or be null.
- [ ] FR-006 — A message about DANA aids MUST answer with the sede.gva.es link and no fichas from the engine.
- [ ] FR-007 — If the LLM call fails or returns invalid JSON, the route MUST fall back to keyword match on catalogue `frases_usuario` and still return a `Respuesta`.
- [ ] FR-008 — The route MUST NOT log or store citizen text.

## Files

| Path | Change |
|------|--------|
| `src/lib/llm/perfil.ts` | new — prompt, JSON parse, quote check |
| `src/lib/llm/pregunta.ts` | new — field → question text, pick by `pendiente` |
| `src/lib/llm/respaldo.ts` | new — `frases_usuario` keyword fallback |
| `src/app/api/chat/route.ts` | edit — real route, replaces the S0 mock |
| `src/lib/llm/*.test.ts` | new — tests with a faked `completar` |

## Decisions

- **Profile rebuilt from all user messages each turn** — stateless server, no stored text; beats carrying a profile between requests.
- **Question chosen in code, not by the LLM** — keeps one LLM call and makes it testable.

## Tasks

- [ ] T001 [P] Write prompt, parse and quote check with tests in `src/lib/llm/perfil.ts` → FR-002, FR-003
- [ ] T002 [P] Write the question picker with tests in `src/lib/llm/pregunta.ts` → FR-005
- [ ] T003 [P] Write the fallback with tests in `src/lib/llm/respaldo.ts` → FR-007
- [ ] T004 Write the route with validation, DANA check and no logging; test the 4 profiles (must and must-not include) with a faked LLM in `src/app/api/chat/route.ts` → FR-001, FR-004, FR-006, FR-008

## Assumptions

- The fallback is keyword match on `frases_usuario` (RFC open question 4).
- The guardrails here are the agreed minimum; the proposed guardrail set (RFC open question 2) adds requirements later.
