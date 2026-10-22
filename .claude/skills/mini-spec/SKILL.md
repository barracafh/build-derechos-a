---
name: "mini-spec"
description: "Write one short spec (about 40 lines) for a unit of work: goal, checkable requirements, files and ordered tasks. Replaces mini-specify, mini-plan and mini-tasks for small features."
argument-hint: "A spec ID from the RFC (e.g. S1), or a short description"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

## Purpose

Write one file: `docs/specs/NNN-short-name/spec.md`.
A person can build from this file without a question. `mini-implement` does its tasks.

The RFC and ARCHITECTURE (`docs/RFC.md`, `docs/ARCHITECTURE.md`) contain the reasons. Link to them. Do not copy them.
`mini-implement` reads every line of the spec for every task. A line with no decision wastes effort each time.

## Sections

| Section | Put in | Do not put in |
|---|---|---|
| **Header** | A link to the RFC or ARCHITECTURE section that this spec builds | Reasons copied from them |
| **Goal** | One sentence. It names the new capability | A task ("implement X") |
| **Requirements** | `- [ ] FR-001 — System MUST …`. A reader can check each one from its own sentence. Add a number if it is a quality limit | Vague words ("robust", "secure", "handle") |
| **Files** | A table: path, then `new` or `edit` and the change. Verify each path, or mark it `new` | A path that you guessed |
| **Decisions** | Only choices that another competent reader can make differently. One line each: chosen, why, rejected. If there are none, omit the section | A decision that ARCHITECTURE has made |
| **Tasks** | `- [ ] T001 [P] <change> in \`<path>\` → FR-001`. Put them in dependency order | Reasons, or a separate "add tests" task |
| **Assumptions** | Each default that you chose without a question. If there are none, omit the section | "TBD", "N/A" |

**Task format**
- Number tasks `T001`, `T002`, … with no gaps. Never renumber them.
- Add `[P]` only if the task changes no file that another open task changes.
- Put a test in the task that changes the behaviour. Never make a task only for tests.
- Write one task on one line.

## Steps

1. **Find the directory.**
   - If `$ARGUMENTS` names an existing `docs/specs/NNN-*/`, use it.
   - If not, create `docs/specs/NNN-short-name/`.
   - If `$ARGUMENTS` is an RFC ID, set `NNN` to its number (`S3` → `003`). If not, use the next free number.
   - Write a short name of 2–4 words in kebab-case.
2. **Read in this order.** Stop when you can write the Goal.
   1. The RFC and ARCHITECTURE sections for this work.
   2. `CLAUDE.md`.
   3. The titles of the other specs: `grep -h '^# ' docs/specs/*/spec.md`.

   Do not read other specs in full.
3. **Verify the files.** Before you fill the Files table, check that each `edit` path exists.
   If the change touches existing code, run `graft callers "<symbol>" --depth all`.
4. **Write `spec.md`** from `.claude/skills/mini-spec/template.md`.
   - Aim for about 40 lines. 40 is a guide, not a limit.
   - Go over 40 lines only if a requirement, a decision or an assumption needs the line. Say so in the report.
   - Do not add lines to reach 40. Do not remove a requirement, a decision or an assumption that changes the build.
   - If the spec is 60 lines or more, it probably holds two units of work. Split it.
   - If the spec is too long, trim in this order:
     1. Assumptions that the codebase makes obvious.
     2. Decisions that nobody can make differently.
     3. Adjacent tasks on the same file. Merge them.
5. **Fill the gaps yourself.**
   - Use the default that the codebase or ARCHITECTURE implies. Record it under Assumptions.
   - Ask a question only if the choice changes the scope and has no safe default.
   - Ask 2 questions at most.
6. **Flag cross-cutting choices.** If other specs must know a decision, it belongs in ARCHITECTURE. Name it in the report. The user decides.
7. **Add the spec tab.** Do this step after the self-check passes. If `docs/explore/index.html` does not exist, skip this step.
   - Copy the markup of the sample spec tab in `.claude/skills/explore/example.html`: the tab button, the section and its panel.
   - Label the tab `S<n> · <name>` with the RFC row ID. If the spec has no RFC row, use its number. Set `data-spec="NNN"` on the button and the section.
   - If a tab with the same `data-spec` exists, replace it. Do not edit any other tab.
   - Fill the tab from `spec.md` only:

     | Part | Content |
     |---|---|
     | Lead | `<p class="lead guide">`: what this work delivers and why, in 1–2 plain sentences |
     | Default card | the goal as role; the spec path as a tag; the RFC row as a fact |
     | Tasks diagram | `flowchart LR`, one box per task, arrows in dependency order; `[P]` tasks branch in parallel |
     | Tasks table | Task, Change, File, Requirements, Status |
     | Requirements table | ID, Requirement, Status |
     | Task cards | one per task: kind `Task`, title `T001 · <short name>`, role = the change |

   - Write `done` in the Status cell of each `[X]` item and `todo` for the others.
   - Put the tab after the other tabs and before the Brief tab.

## Self-check

If an item fails, fix it. Then check again one time.

- [ ] The spec has about 40 lines. It has more only if each extra line holds a requirement, a decision or an assumption.
- [ ] A reader can test each FR from its own sentence.
- [ ] At least one task reaches each FR. Each task cites an FR.
- [ ] Each row in the Files table has a task. Each `edit` path exists.
- [ ] No line repeats the RFC or ARCHITECTURE. No line contradicts them.
- [ ] No placeholder, "TBD" or "N/A" remains.

## Report

Write the report in the language of the user. The spec stays in English.

Write one line: the path, the number of lines, the number of tasks, and each assumption that the user must check.
Then stop. Do not start T001.
