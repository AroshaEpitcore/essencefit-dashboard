---
description: Phase 1 — document the Maraebiz codebase as-is for a topic, across the three repos, and write a research doc to workflow/research/
model: opus
---

# Research (Phase 1)

Conduct read-only research across the Maraebiz platform to answer a question by spawning parallel sub-agents and synthesizing their findings into a durable research document. This is the first phase of the Research → Plan → Implement → Validate loop.

The workspace has three repos: **`maraebiz/`** (the `MBS.Web` ASP.NET Core MVC monolith), **`maraebiz-app/maraebiz-mobile-app/`** (React Native + Expo app), and **`maraebiz-public-site/`** (React/CRA marketing site).

## CRITICAL: DOCUMENT THE CODEBASE AS IT EXISTS TODAY
- DO NOT propose changes, improvements, or fixes (that is the Plan phase)
- DO NOT critique the implementation
- ONLY describe what exists, where, how it works, and how the repos connect

## Initial response
If no topic was given with the command, respond:
```
I'm ready to research the Maraebiz codebase. What's the question or area? I'll map it across the backend (maraebiz/MBS.Web), the app (maraebiz-app), and the public site (maraebiz-public-site) as relevant.
```
Then wait. If a topic (or a ticket/doc path) was given, read any mentioned files FULLY first (Read with no limit/offset), then proceed.

## Naming the document (always prompt — never pick silently)
Agree on the `<slug>` with the user **before** doing the research work:
1. **Suggest** a kebab-case slug derived from the topic: lowercase; spaces/underscores → hyphens; strip anything other than `a-z`, `0-9`, `-`; collapse repeated/leading/trailing hyphens.
2. **Prompt and wait** — present exactly:
   ```
   Suggested name: <slug>
   Reply `ok` (or `accept`) to use this, or type a different name.
   ```
   Stop and wait for the answer. Never skip this prompt or pick the name silently.
3. **Normalize** whatever the user types with the same kebab-case rules in (1).
4. **Dedup**: check every `workflow/` subfolder (`research/`, `plans/`, `validation/`, `archive/`) for an existing file whose name ends in `-<slug>.md`, ignoring the leading `YYYY-MM-DD-` date prefix. On a clash, append `-2`, then `-3`, … until free.
5. If the final slug differs from what the user chose (due to normalization or dedup), **tell them the final name**.

Use this agreed `<slug>` for the filename in step 7.

## Steps
1. **Read mentioned files fully** in the main context before spawning anything.
2. **Name the document** via the Naming protocol above (prompt the user, then dedup).
3. **Check prior work**: spawn `workflow-locator` for the topic so you build on existing `workflow/` docs instead of repeating them.
4. **Decompose** the question into focused areas. Think about which repos/layers are involved.
5. **Spawn parallel read-only sub-agents** (these are documentarians):
   - `codebase-locator` — WHERE the relevant files live (all repos).
   - `codebase-analyzer` — HOW specific components work, with `file:line`.
   - `codebase-pattern-finder` — existing patterns/examples to model later work on.
   Run them concurrently. Give each a specific, repo-scoped prompt. Don't tell them HOW to search — they know.
6. **Wait for ALL sub-agents**, then synthesize. Live code is the source of truth; `workflow/` docs are supplementary history. Connect findings across the backend ↔ app boundary (the `Json(...)` / `/api/v1` contract). Keep `file:line` references.
7. **Capture metadata** for the doc: today's date, and the current commit of each touched repo:
   `git -C maraebiz rev-parse --short HEAD`, `git -C maraebiz-app rev-parse --short HEAD`, `git -C maraebiz-public-site rev-parse --short HEAD`.
8. **Write** `workflow/research/YYYY-MM-DD-<slug>.md` (the agreed `<slug>`) using the template below. Never use placeholders — fill every field.
9. **Present** a concise summary with the key `file:line` references and offer follow-ups (append to the same doc if asked).

## Document template
```markdown
---
date: <YYYY-MM-DD>
topic: "<the question>"
backend_commit: <maraebiz short sha>
app_commit: <maraebiz-app short sha or n/a>
public_site_commit: <maraebiz-public-site short sha or n/a>
status: complete
tags: [research, <components>]
---

# Research: <topic>

## Research Question
<original question>

## Summary
<high-level answer describing what exists>

## Detailed Findings
### Backend (maraebiz/ — MBS.Web)
- <finding> (`MBS.Web/.../File.cs:NN`)
### Mobile app (maraebiz-app/maraebiz-mobile-app/)
- <finding> (`src/.../file.ts:NN`)
### Public site (maraebiz-public-site/)
- <finding> (`src/.../File.js:NN`)
### Cross-repo connection points
- API contract: `MBS.Web/Controllers/XController.cs:NN` (Json action) ⇄ `src/api/services/x.service.ts:NN`

## Code References
- `repo/path:line` — what's there

## Architecture / Conventions Observed
<patterns and conventions actually present>

## Related Prior Work (from workflow/)
- `workflow/.../*.md` — <what it covered>

## Open Questions
<anything needing further investigation>
```

## Notes
- Always run fresh codebase research; don't rely solely on old docs.
- Keep the main agent focused on synthesis — let sub-agents do the heavy reading in their own context.
- You and all sub-agents are documentarians: describe what IS, not what SHOULD BE.

## Next
Research is saved to `workflow/research/<slug>.md`. Recommend `/clear`, then `/plan <slug>` to shape the implementation.
