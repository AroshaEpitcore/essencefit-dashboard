---
description: Phase 2 — create a detailed, verifiable implementation plan (with cross-repo touchpoints) and write it to workflow/plans/
model: opus
---

# Plan (Phase 2)

Create a detailed implementation plan through an interactive, skeptical, iterative process. Work WITH the user; do not one-shot it. Output a plan another agent (or you, later) can execute phase-by-phase against the deterministic gate.

## Initial response
If a topic/ticket/research doc was given, read it FULLY and start. Otherwise:
```
I'll help you plan. Give me the task (or a workflow/research/ doc or ticket), plus any constraints. I'll research the code, then we'll shape the plan together.
```

## Process
### Step 1 — Context & initial research
1. Read all mentioned files FULLY (no limit/offset). Always check for an existing `workflow/research/<slug>.md` and read it.
2. Spawn parallel read-only agents to ground yourself in reality:
   - `workflow-locator` (prior plans/research), `codebase-locator`, `codebase-analyzer`, `codebase-pattern-finder`.
3. Read the key files they surface. Cross-check the request against actual code.
4. Present your informed understanding + ONLY the questions code can't answer:
   ```
   Based on the code, I understand we need to <accurate summary>.
   Found: <detail with file:line> · <pattern to follow> · <constraint/edge case>.
   Questions code can't answer: <business/design judgment calls>
   ```

### Step 2 — Shape the approach
- If the user corrects you, don't just accept it — spawn a quick sub-agent / read the files to verify, then proceed.
- **Benchmark against the industry standard.** When the right approach isn't obvious, or the user's proposal may diverge from accepted practice, spawn `web-search-researcher` to find the current best-practice for the relevant stack (ASP.NET Core / .NET 8, EF Core, RN/Expo, React). Weigh the standard against this codebase's existing conventions — match the repo's patterns unless the standard is clearly better, and say so honestly either way. Record the comparison + sources in the plan.
- Present design options with trade-offs and the cross-repo surfaces each touches. Align before writing details.

### Step 3 — Confirm phasing
Propose the phase breakdown (1-2 lines each) and get buy-in before writing the full plan. A Maraebiz backend feature usually phases as: **Entity (+EF migration) → service interface (`Services/Interface/IServices.cs`) → service impl (+ DI in `ServiceExtensions.cs`) → controller action + ViewModel → Vue view (`Views/...`) → app consumer (if any)**. (No test phase — there are no test projects.)

### Step 4 — Write the plan
**Decide the `<slug>` first:**
- **Continuing from research** (a `workflow/research/<slug>.md` was given or found): reuse that exact slug — do **not** prompt.
- **Standalone** (no research doc): name it via the Naming protocol — (a) **suggest** a kebab-case slug from the task, (b) **prompt and wait**:
  ```
  Suggested name: <slug>
  Reply `ok` (or `accept`) to use this, or type a different name.
  ```
  never pick silently, (c) **normalize** what's typed with the same rules, (d) **dedup** against every `workflow/` subfolder for files ending in `-<slug>.md` (ignore the `YYYY-MM-DD-` prefix), appending `-2`, `-3`, … on a clash, and (e) **tell the user the final name** if it changed.

Write `workflow/plans/YYYY-MM-DD-<slug>.md`. Use this template:

````markdown
---
date: <YYYY-MM-DD>
slug: <kebab-slug>
status: draft   # draft | approved | implementing | shipped
surfaces: [backend, view, app, public-site]   # which surfaces this touches
research: workflow/research/<slug>.md
estimated_manual_effort: <Xh Ym>   # total human review/verify/validate time incl. 10% buffer — NOT dev time
---

# <Feature> — Implementation Plan

## Overview
<what we're building and why, 1-2 sentences>

## Estimated Manual Effort
**<Xh Ym>** — total human-in-the-loop time only: overviewing/reviewing each phase, manual verification at each pause, and the final `/validate`. Implementation is done by Claude Code, so **no development hours are counted**. Includes a 10% buffer.

## Current State
<what exists now, key constraints, with file:line>

## Desired End State
<the observable end state and how we'll know it's reached>

## What We're NOT Doing
<explicit out-of-scope, to stop scope creep>

## Touchpoints per surface
> The cross-repo contract for this feature. Keep the backend `Json(...)`/`/api/v1` shape ⇄ app service/types in sync.
- **Backend service/data (maraebiz/ MBS.Web)**: <entity, migration name, IXService in IServices.cs, impl, DI registration>
- **Backend controller/API**: <controller action(s), ViewModel, Json shape>
- **Vue view (maraebiz/ Views/)**: <view(s)> (or "none")
- **Tenancy note**: <does any new query use Dapper/raw SQL that needs an explicit CompanyKey filter?>
- **App (maraebiz-app/maraebiz-mobile-app/)**: <route/screen/data hook/api service/store/types> (or "none")
- **Public site (maraebiz-public-site/)**: <page/component> (or "none")

## Phase 1: <name>
### Changes
#### <Component> — `repo/path/File.ext`
<summary>
```<lang>
// specific code to add/modify
```
### Success Criteria
#### Automated (the deterministic gate — must be green)
- [ ] Backend builds: `dotnet build maraebiz/Maraebiz.sln`
- [ ] App lints: `npm --prefix maraebiz-app/maraebiz-mobile-app run lint`   # if the app was touched
- [ ] Public site builds: `npm --prefix maraebiz-public-site run build`   # if the public site was touched
#### Manual (human verification)
- [ ] <UI/behavior to verify by hand>

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 2: <name>
<same shape>

## Testing Strategy
- This workspace has no automated test suite. Be explicit about the manual steps that confirm each phase, and any seed/tenant (company) data needed.

## References
- Research: `workflow/research/<slug>.md`
- Patterns to follow: `<file:line>`
- Industry standard considered: `<what the standard is, how this plan compares, + source link(s)>` (or "n/a — followed existing repo convention")
````
### Step 4b — Estimate manual effort
Fill the single **Estimated Manual Effort** total, placed right after `## Overview`. Count **only human-in-the-loop time**, never development time (Claude Code implements): for each phase, the time to overview/review its changes and run the manual verification at its pause; plus the final `/validate` (review the gate output + semantic review). Sum those, add a **10% buffer**, and write the total (in `Xh Ym`) to both the `## Estimated Manual Effort` line and the `estimated_manual_effort` frontmatter field.

**One total only.** Do NOT add per-phase effort lines, a per-phase effort table, or any dev-hour figure anywhere in the plan — the phases carry scope and success criteria, not their own effort numbers. The only effort figure in the whole document is this single top-of-plan total.

### Step 5 — Review loop
Present the plan path and ask: phases scoped right? success criteria specific enough? **effort estimate realistic?** edge cases covered? Iterate until the user is satisfied, then set `status: approved`.

## Guidelines
- **Be skeptical**: question vague requirements; verify with code, don't assume.
- **No open questions in the final plan** — resolve every decision first.
- **Automated criteria must be runnable** (use the exact `dotnet`/`npm` commands above so they match the verify hook).
- Separate automated vs manual criteria in every phase.
- Keep the cross-repo "Touchpoints" section accurate — it's how the app and backend stay in contract — and always call out tenancy (`CompanyKey`) implications.

## Next
Once the plan is `status: approved`, recommend `/clear`, then `/implement <slug>` to execute it phase by phase.
