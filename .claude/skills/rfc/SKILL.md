---
name: "rfc"
description: "Draft or sync docs/RFC.md and docs/ARCHITECTURE.md from the conversation. Always shows a draft and waits for approval before writing."
argument-hint: "draft | sync; nothing means draft"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

## Purpose

You turn the decisions of the conversation into `docs/RFC.md` and `docs/ARCHITECTURE.md`. Use the templates that are already in those files.

**Never write to `docs/` before the user approves the draft.**
The docs are the source of truth. HTML files and chat are exploration only.

Rules for both modes:
- Write only what the user decided.
- Put each undecided item in **Open questions**. Never invent an answer.
- Follow `CLAUDE.md`, section "Documentation": short sections, tables, Mermaid, conclusion first.
- Keep the headings of the template. Delete a section only if it does not apply. Say so in the draft.
- Write the docs in English, whatever the language of the chat.

## Mode `draft` (first fill)

1. Read the two template files and the conversation. Read each HTML file in `docs/explore/`, and each other HTML file that the user names.
   - Take the text, the diagrams and the tables from the HTML. Ignore the styling and the script.
   - In an `/explore` page, read the Brief tab first, then the Glossary tab. Use the glossary terms in the docs. Then read the Mermaid source in each `<pre class="mermaid-src">`, the data in each `<table>`, and the cards in each `<article data-note>`.
   - Skip each tab with `data-spec`. It mirrors a spec in `docs/specs/`, not a design decision.
   - A card tag `data-status="decided"` is a candidate for **Decisions**. A tag `open` or `risk`, and each item in a card section "Open questions", go to **Open questions**. Confirm each one with the user.
   - If an HTML file and the conversation disagree, the conversation is newer. Put the conflict in **Open questions**. Do not choose.
   - In the draft, list which HTML files you used.
2. Show the draft in the chat, one document at a time. Show the RFC first, as full markdown. Do not write files.
3. Under the draft, list in short bullets:
   - what you inferred and did not hear
   - what you left as an open question
   - what you removed from the template
4. Wait for the user. Apply the corrections. Show only the sections that changed.
5. If the user approves, write both files. Do not commit.
6. Tell the user the next step: `/mini-spec S0`, then `S1`, and so on.

## Mode `sync` (the docs can be stale)

1. Compare `docs/` with the code, the specs in `docs/specs/`, the HTML files in `docs/explore/` and the conversation. Look for:
   - a decision that is not in **Decisions**
   - an open question that has an answer now
   - a spec in the RFC table that does not match its `spec.md`
   - a layout, a contract or a hosting piece that the code does not match
2. Show a diff-style list, not the full files. For each item write: file, section, current text, proposed text, and the reason in one line.
3. Wait for the user to approve each item, or all items. Apply only the approved items.
4. If the scope changes, change the RFC first (Specs table). Then change the specs. Never edit a spec in this skill. Point to `/mini-spec`.

## Report

Write the report in the language of the user. Name the files that changed and the number of open questions. Then stop.
