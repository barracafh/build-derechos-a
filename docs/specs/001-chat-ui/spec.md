# S1 Chat UI

**Implements**: [RFC · Specs S1](../../RFC.md#specs) · [ARCHITECTURE · Components](../../ARCHITECTURE.md#components)

## Goal

A citizen writes their situation and reads, in one Sol-styled page, the aids they could apply for, what was checked and an optional next question.

## Requirements

- [ ] FR-001 — The page MUST send the full history to `fetch(ruta("/api/chat"))` as `{mensajes: MensajeChat[]}` and show each turn; Enter sends, Shift+Enter breaks the line.
- [ ] FR-002 — Each `Ficha` MUST render as a card: title, administration, status as a badge with text, "why it fits", "requirements to check", official link; `verificado: false` shows "Sin confirmar".
- [ ] FR-003 — The coverage panel MUST list `consultado` and `noConsultado`; if `respaldo` is true it MUST say that the data comes from a dated copy.
- [ ] FR-004 — If `pregunta` is not null, the page MUST show it as an optional suggestion that the citizen can answer or ignore.
- [ ] FR-005 — The page MUST show a loading state, an error with retry, and, with no fichas, a message plus the sede link.
- [ ] FR-006 — The page MUST keep the experimental notice, `BotonAviso` and `<Fuentes />`, say "podrías optar" (never "tienes derecho"), and have no horizontal scroll at 320 px.
- [ ] FR-007 — The page MUST NOT persist messages (no `localStorage`, no cookies).

## Files

| Path | Change |
|------|--------|
| `src/components/Chat.tsx` | new — client component: history, input, fetch, states |
| `src/components/TarjetaAyuda.tsx` | new — one `Ficha` |
| `src/components/PanelCobertura.tsx` | new — coverage and fallback notice |
| `src/app/page.tsx` | edit — replace the sample answer with `<Chat />`, keep header, notice and footer |

## Decisions

- **One page, answer below the chat** — cards and coverage replace the previous answer on each turn; beats a growing thread of card lists.
- **Status badge colours from Sol variants only** — `abierta` default, `cerrada` outline, `permanente` secondary, `desconocido` outline with "Comprobar"; no new colours.

## Tasks

- [ ] T001 [P] Build the card in `src/components/TarjetaAyuda.tsx` → FR-002
- [ ] T002 [P] Build the coverage panel in `src/components/PanelCobertura.tsx` → FR-003
- [ ] T003 Build the chat with history, question and states in `src/components/Chat.tsx` → FR-001, FR-004, FR-005, FR-007
- [ ] T004 Mount `<Chat />` in `src/app/page.tsx`; check the 4 profiles against the mock at 320 px and 1280 px → FR-006

## Assumptions

- Built against the S0 mock; switching to the real route needs no change, because S3 keeps the same path and shape.
- Verification is manual in the browser; this spec adds no UI tests.
