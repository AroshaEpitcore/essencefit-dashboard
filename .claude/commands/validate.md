---
description: Phase 4 — validate an implementation against its plan; run the deterministic gate, then a semantic review, and write a report to workflow/validation/
---

# Validate (Phase 4)

Verify that a plan was correctly executed. This is two layers: the **deterministic gate** (build/lint — provable), then the **semantic review** (the vibe check — judgment). Run them in that order so the review isn't wasted on broken-build noise.

## Setup
1. Locate the plan (`workflow/plans/<slug>.md`). If not given, find it from recent commit messages (`plan:` line) or ask.
2. Read the plan fully — list every file that should have changed and every success criterion (automated + manual).
3. Gather the diff for each touched repo:
   ```
   git -C maraebiz log --oneline -n 15 ; git -C maraebiz diff HEAD~N..HEAD
   git -C maraebiz-app log --oneline -n 15 ; git -C maraebiz-app diff HEAD~N..HEAD
   git -C maraebiz-public-site log --oneline -n 15 ; git -C maraebiz-public-site diff HEAD~N..HEAD
   ```

## Layer 1 — Deterministic gate (provable)
Run the build/lint for each touched repo and record pass/fail with the actual command output:
- `dotnet build maraebiz/Maraebiz.sln`
- `npm --prefix maraebiz-app/maraebiz-mobile-app run lint`  (if the app was touched)
- `npm --prefix maraebiz-public-site run build`  (if the public site was touched)

> There are **no automated test suites** in this workspace. The gate is build/lint only — which makes the semantic review (Layer 2) and the plan's manual criteria the real safety net. Don't imply tests ran.

If anything is red, treat it as blocking and you may skip the deeper semantic review — BUT you must still write the validation report (verdict `issues`), recording the failing command and its output. A red gate is the most important result to persist, not a reason to skip the artifact. Never end `/validate` without writing `workflow/validation/<slug>.md`.

## Layer 2 — Semantic review (the vibe check)
Spawn the **`code-reviewer`** agent with the plan path. It reviews the diff against the plan's intent and the Maraebiz invariants the gate can't see (tenant isolation via `CompanyKey` — especially Dapper/raw SQL that bypasses the global filter; role auth via `enumUserRoles`; thin-controller/service boundary; `decimal(18,2)` money; soft-delete + auto-stamped audit fields; `Json(...)` error handling; Vue 2 view patterns; the app's no-react-query/no-NativeWind conventions; cross-repo contract). Fold its findings into the report.

Also think for yourself about edge cases: error conditions, missing validations, regressions, and whether the change truly achieves the plan's end state vs. merely compiling.

## Report
Write `workflow/validation/YYYY-MM-DD-<slug>.md` and present a summary:
```markdown
---
date: <YYYY-MM-DD>
slug: <slug>
plan: workflow/plans/<slug>.md
backend_commit: <maraebiz sha>          # the commit(s) that implemented this
app_commit: <maraebiz-app sha or n/a>
public_site_commit: <maraebiz-public-site sha or n/a>
verdict: pass | issues
---

# Validation Report: <feature>

## Implementation Status (per phase)
- ✓ Phase 1: <name> — fully implemented
- ⚠ Phase 2: <name> — partial (see issues)

## Layer 1 — Deterministic gate
- ✓ Backend build · ✓ App lint · ✓ Public site build
- ✗ <any failure with the command + output excerpt>

## Layer 2 — Semantic review (code-reviewer)
### Matches plan
- <...>
### Deviations from plan
- <... with file:line; note if it's an improvement or a gap>
### Issues found
- **[blocking]** <tenant-isolation/auth/correctness> `file:line` — impact + fix
- **[nit]** <...>

## Manual verification still required
- [ ] <UI/behavior the human must confirm>

## Recommendation
<merge / fix-then-merge / needs work>
```

## Guidelines
- Record commit SHAs in the report — that's how a plan stays linked to the code it produced.
- Run every automated check; never claim a pass you didn't run.
- Be honest about shortcuts or incomplete items — and that there is no test coverage backing this change.
- **Always write the report** — pass OR fail. The report is the artifact; a failed gate must still be persisted.
- Once validated and merged, move the slug's docs to `workflow/archive/` to keep the active set small.

## Next
Report is saved to `workflow/validation/<slug>.md`. If the verdict is `pass` and the change is merged, move the slug's research/plan/validation docs to `workflow/archive/`.
