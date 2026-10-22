---
name: "mini-implement"
description: "Implement one task or a task range from a mini-spec, verify each, mark [X], and stop."
argument-hint: "spec dir or ID, plus T003 or T001-T005; nothing takes the next open task"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

## Purpose

You do not write a document. You do the task that the user gives you. You make it true in the code, prove it, mark it `[X]`, and stop.

**A task list is a menu, not a queue.**
- A range (`T001-T005`) runs to its last task, then stops.
- A single ID runs one task.
- No argument runs the next open task only.
- Never start the next task because it is there.

## Steps

1. **Find the spec.**
   - If `$ARGUMENTS` names a `docs/specs/NNN-*/` directory or its ID, use it.
   - If not, use the one spec that has open tasks.
   - If several specs have open tasks, ask which one.
2. **Pick the work.** Take a single ID, an inclusive range, or the first `- [ ]` task in file order.
   - A range skips the IDs that are already `[X]`.
   - If an ID does not exist, stop and say so.
3. **Read** `spec.md` in full one time. Then read only the files that the tasks name. Follow `CLAUDE.md`, section "Code":
   - Do only what the task asks.
   - Do not clean up adjacent code.
   - Match the style around it.
4. **Before you change a signature, a name or a file location**, run `graft callers "<symbol>" --depth all`. A spec is a claim about the code, not a fact.
5. **Do one task at a time.** Finish it before you start the next.
   1. If the task changes behaviour, write the failing test first. Then make it pass.
   2. Run the test or command that proves this task is done.
   3. If it passes, change `- [ ]` to `- [X]` on that line.

   If the check fails, leave the box empty. Abandon the rest of the range. Report the output.
6. **Tick an FR** only if every task that cites it is `[X]`. Check the sentence of the FR yourself.
7. **Update the spec tab.** If `docs/explore/index.html` has a tab with this spec's `data-spec`, set `done` in the Status cell of each task and FR that you ticked.
   - Do not edit anything else in the page. The progress bars and the diagram colors follow the Status cells.
8. **Check the docs.** If your work contradicts `docs/RFC.md` or `docs/ARCHITECTURE.md` (a contract, the layout or a decision), say so in the report and suggest `/rfc sync`. Do not edit them.
9. **Stop** at the end of the work that you got. Do not stage, commit or push.

## When a task is wrong

If you cannot do a task as written, stop. Say why in one or two lines. Examples: a file is missing, the approach does not fit, or the task hides two tasks.
Never do other work and tick the box. Only the user can change the spec.

## Report

Write the report in the language of the user. Code and commit messages stay in English.

- Write one line for each completed task: its ID, the change, and how you verified it.
- Write one line on what stays open.
- If the range stopped early, write one line: the task that failed and why.

Then stop.
