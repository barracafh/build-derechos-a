---
name: "explore"
description: "Turn the conversation into an approved brief, then render it as the project page docs/explore/index.html: dark, interactive, one tab per component, ECharts charts with data tables, clickable Mermaid diagrams, side-panel cards and ⌘K search. A guide layer explains each part to readers new to the project. Specs add their own tabs. /rfc reads the result."
argument-hint: "optional focus, e.g. 'matchmaking'; nothing means the whole conversation"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

## Purpose

You turn the conversation into a brief. After the user approves it, you render the brief as the project page `docs/explore/index.html`.
The user iterates on this page. Later, `/rfc` reads its Brief tab, tables, Mermaid sources and cards.
The page is throwaway. It is not the source of truth.

`example.html` in this folder is the reference page. Copy its skeleton. Do not invent a new one.

## Steps

1. **Write the brief.** Read the whole conversation. If the user input names a focus, cover that focus in depth and the rest in one line each.
   - Use these sections, in this order: Goal, Audience, Users, Scope (in and out), Components, Flows, Numbers, Decisions, Open questions, Glossary, Tabs.
   - Under Audience, write who reads the page and what they already know. Assume a reader new to the project unless the user says otherwise.
   - Under Glossary, list each term, acronym or code name that this reader does not know, with a one-line definition.
   - Under Components, give each component a name, a kind (`service`, `data`, `compute`, `external` or none) and its job in one line.
   - Under Numbers, write the source of each number: "from the user" or "invented". Never present an invented number as real.
   - Under Decisions, write only what the user decided. Put everything else under Open questions.
   - Under Tabs, list each tab with the figures that it will show.
   - Use only facts from the conversation. If a section has no facts, write "Not discussed".
2. **Show the brief** in the chat, in the language of the user. Do not write files.
   - Under the brief, list in short bullets: what you inferred, and what you invented.
   - Wait for the user. Apply the corrections. Show only the sections that changed.
   - If the user approves, continue. If the conversation has too little to fill the Goal and the Components, say so and stop.
3. **Load `dataviz`.** If the `dataviz` skill is available, load it before you write the first chart. If it is not available, continue.
4. **Pick the form for each tab.**
   - Use a Mermaid diagram for a flow, a sequence, a state machine or a structure. If a flowchart has more than 8 boxes, use `flowchart TB`.
   - In a flowchart, give each box its kind with `classDef` and `class`. Give the matching card the same kind with `data-kind`.
   - Use an ECharts chart for numbers. Pick the chart type by the job of the data.
   - Use a stat tile for one headline number. Put the stat tiles of the overview in the bento grid: one large tile with a sparkline, up to three small ones.
   - Compute each tile from a table in `fillKpis`. Write a fixed value only for a design target, and label it so.
   - Use a plain table or a list if a chart adds nothing.
5. **Choose the file.**
   - Write `docs/explore/index.html`. If the user asks for a separate page, write `docs/explore/<topic-in-kebab-case>.html` instead.
   - If `index.html` does not exist, copy the skeleton from `example.html`: the fonts, the theme tokens, the header buttons, the tabs, the side panel, the ⌘K dialog and the whole script.
   - If `index.html` exists, edit it. Add new tabs, and update the tabs that the brief changes.
   - Never edit or remove a tab with `data-spec`. `/mini-spec` and `/mini-implement` own those tabs.
   - Remove the sample spec tab of `example.html` from a new page.
6. **Write the content.** Change only tabs, figures, tables, Mermaid sources, cards and chart builders.
   - Keep the motion as it is. Do not add an animation that carries meaning alone.
   - Keep the CDN versions exact: `echarts@6.1.0` and `mermaid@12.2.0`. Never inline a library.
   - Remove the builders that you do not use. Add one builder per new chart type.
   - Put one `<table>` under each chart, inside `<details>`. The chart reads the table. Never repeat the data in JavaScript.
   - Put each Mermaid source in a `<pre class="mermaid-src">`, inside `<details>`.
   - Put the approved brief in the Brief tab, as the last tab. Copy its markup from `example.html`. Write the approval date in its default card.
   - Put the brief's Glossary in the Glossary tab, before the Brief tab. Write one `<div id="term-…">` per term.
7. **Write the guide layer.** It explains the project to the reader in the Audience section. Copy each markup from `example.html`.

   | Part | Where | Content | Guide toggle |
   |---|---|---|---|
   | What this is | top of the overview, full width | one-line pitch; the problem, the solution and who it is for, 2–3 sentences each; "How it works" in 3–5 steps, each with `data-tab` of the tab that shows it | always visible |
   | Lead | first line of each tab, `<p class="lead guide">` | 2–4 sentences: what part this is, what question the tab answers, how to read its figures | hidden when off |
   | Takeaway | after each chart or diagram, `<p class="takeaway guide">` | one sentence: the conclusion the figure supports, with its number | hidden when off |
   | In short | in a card, after the role, `<p class="explain guide">` | 2–3 sentences: what the element does and why it exists, without jargon | hidden when off |
   | Term | anywhere in text, `<a class="term" href="#term-…">` | the first use of a glossary term in each block | always visible |

   - Write for the Audience. Use everyday words. Explain why a thing matters, not only what it is.
   - Never use an acronym, a code name or an API field without a glossary term or a plain explanation.
   - Write a takeaway only if the figure supports it. Check the number against the table.
   - Give each component card an "In short" field. Give it to other cards only if the role needs more context.
8. **Write the cards.** A card appears in the side panel when the user clicks an element.
   - Put the cards of a tab in its side panel as `<article data-note="key" hidden>`. Copy the markup from `example.html`.
   - Give each tab one visible `default` card: the tab summary, its key facts and its open questions.
   - Use this key for each element:

     | Element | Key | Example |
     |---|---|---|
     | Diagram box, sequence actor | Mermaid ID | `GW` |
     | Arrow, Sankey band | `from->to` | `C->GS` |
     | Chart series or item | its name in the table | `EU`, `Day-1 return` |

   - Fill only these fields, in this order:

     | Field | Markup | Limit |
     |---|---|---|
     | Kind | `<p class="kind">` | 1–2 words: Service, Datastore, External, State, Link, Region… |
     | Title | `<h3>` | the element name |
     | Role | `<p class="role">` | one sentence |
     | In short | `<p class="explain guide">` | 2–3 plain sentences; see step 7 |
     | Tags | `<ul class="tags">` | up to 4; status as `data-status="decided"`, `"open"` or `"risk"` |
     | Facts | `<dl class="facts">` | up to 4 label–value pairs, values short |
     | Open questions | `<div class="questions">` | up to 3, only real undecided items |

   - Use `decided` only for a decision in the brief. Use `open` for an open question in the brief.
   - Do not write connections or chart statistics. The page computes them from the diagram and the tables.
   - If an element has no fact beyond the figure, give it no card.
   - Write one caption line per figure: what it shows and its unit.
   - Put interaction hints in the `(i)` of the figure, never in the caption. Copy the markup from `example.html`.
9. **Follow the chart rules.**
   - Use the color tokens in slot order. Never write a hex value in a builder.
   - Use one y-axis per chart. Never use a dual axis.
   - If a chart has 2 or more series, show the legend.
   - If a scatter chart has more than 3 series, fold the rest into "Other" or split the chart.
   - If a heatmap shows labels, give them a text outline in the surface color.
10. **Verify the page.** Open it in a browser if a browser tool is available.
   - Open each tab. Check that each chart and each diagram renders.
   - Click one box, one arrow, one chart mark and one chip per tab. Check that the right card appears.
   - Switch the theme. Check that charts and diagrams change color and the selection stays.
   - Press ⌘K. Search for one element and one term, and open them.
   - Hover one term and click it. Check that the Glossary opens on it.
   - Click each "How it works" step. Check that it opens its tab.
   - Turn the guide off and on. Check that leads, takeaways and "In short" fields hide and show.
   - Turn motion on and off. Check that the arrows flow only when motion is on.
   - Read the console. Fix each error.
   - If no browser tool is available, say so in the report.

## Rules

- Write the page in English, whatever the language of the chat.
- Write one file per page. Do not split CSS or JavaScript into other files.
- If the page shows invented numbers, say so in the page subtitle.

## Report

Write the report in the language of the user. Give the file path, the tabs that you added or changed, and the result of the browser check. Then stop.
