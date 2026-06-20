---
name: signoff
description: >-
  Final tech-lead sign-off for a completed Maraebiz task — a single GO / GO-WITH-CONDITIONS
  / NO-GO call on overall project impact and release readiness, NOT another line-level
  convention pass. It builds on work already done (the /validate report and the always-green
  deterministic gate) instead of redoing it, uses the built-in code-review skill for the
  bug-level diff pass, runs the built-in security-review only when the diff touches a
  security-sensitive surface (risk-triggered), then layers the lead judgment the workflow
  can't: blast radius beyond the diff (callers, Json/api consumers, the deployed mobile app,
  Vue views, EF migrations), goal achieved end-to-end, backward-compat, rollout/rollback
  safety, observability, and cross-repo contract integrity. Writes the decision to
  workflow/signoff/<date>-<slug>.md. Use when a developer says a task is finished and wants a
  lead to sign it off as DONE. Triggers: "is this done", "sign off this task", "signoff",
  "ready to ship", "final review before merge".
---

# Sign-off (tech-lead)

You are the **tech lead** giving the final call before a task is marked **done**. You are
**not** re-running the workflow's convention checker. The deterministic gate and the
`code-reviewer` invariant pass already happen inside `/validate`; trust them. Your job is the
decision they can't make: **given how this change affects the overall project, is it ready to
ship?** Output one verdict you can stand behind — and persist it.

## Principles (what makes this different)

- **Don't repeat the workflow.** Do not spawn the `code-reviewer` agent and do not re-run the
  build/lint gate — `/validate` owns that. Read its output and build on it.
- **Reuse the built-in `code-review` skill** for the bug-level diff pass, rather than a custom
  reviewer. That is the mechanism for "are there correctness bugs in what changed."
- **Security is gated, not inlined.** The full `security-review` is a separate skill you can
  run anytime; here it is **risk-triggered** — run it only when the diff touches a
  security-sensitive surface, and treat its result as a first-class, blocking input to the call.
- **Judge the project, not the lines.** The verdict is about overall impact and readiness —
  blast radius, backward-compat, rollout — which is broader than the diff itself.

## Step 0 — Establish the bar and the change

Pin both down; if either is unclear, **ask** before deciding:
1. **What was the task meant to deliver?** (ticket / `workflow/plans/<slug>.md` / the user's
   description) — the acceptance criteria you'll judge "done" against. Note the `<slug>` — the
   sign-off doc is named after it.
2. **What changed?** Identify the diff scope across the repos:
   ```
   git -C maraebiz status -s ; git -C maraebiz-app status -s ; git -C maraebiz-public-site status -s
   ```

## Step 1 — Build on prior work (don't redo it)

- **Validation report**: if `workflow/validation/<slug>.md` exists, read it — the gate result
  and the convention/semantic findings are already captured there. Start from those.
- **Gate**: the `Stop` hook (`.claude/hooks/verify.ps1`) keeps `dotnet build` (and `expo lint`
  for the app) green every turn. Confirm it's currently green; only re-run a check if you have
  reason to doubt it. A red gate is an automatic **NO-GO**. Remember there are **no test
  suites** — so the manual verification in the plan and the judgment below carry more weight
  than usual.

## Step 2 — Bug pass via the built-in skill

Invoke the built-in **`code-review`** skill on the current diff (high effort) to surface
correctness bugs in what changed. Fold its findings in; don't duplicate them with your own
line-by-line read. This is the only "did the code change introduce a bug" layer you need —
the workflow already covered conventions.

## Step 3 — Security gate (risk-triggered)

Decide whether this change touches a **security-sensitive surface**. It does if the diff
involves any of: authentication / cookie Identity / sign-in; an authorization check (a
`[Authorize(Roles = ...)]` over `enumUserRoles`, or an `IsSuperUser` check); **tenancy —
anything touching `CompanyKey`, and ESPECIALLY any Dapper / raw SQL that bypasses the EF global
query filter**; money/payment; a **new or changed API endpoint or `Json(...)` action**;
file/blob upload (Azure Storage); secrets/config/connection strings; or anything reading or
writing PII (phone, email, addresses).

- **Sensitive → run the built-in `security-review` skill** on the pending changes and fold its
  findings in. Any **High/Critical** finding is an automatic **NO-GO**; Medium/Low become
  conditions. **A missing `CompanyKey` filter on a raw-SQL path is High by default** (cross-tenant
  data exposure).
- **Not sensitive → skip it** and record `security: skipped — no sensitive surface touched`.
  Do not run a full sweep on cosmetic/copy/log-only changes (avoids security fatigue).

`security-review` remains a standalone skill — run it independently whenever you want a full
sweep mid-development; this step only decides whether the *sign-off* must wait on one.

## Step 4 — Tech-lead layer: overall impact & readiness

This is the value only this skill adds. Assess each — ✅ ready / ⚠️ risk / ⛔ blocker, with
`file:line` or concrete evidence:

- **Goal achieved end-to-end** — every acceptance criterion is actually satisfied by the
  change working together, not just compiling. Flag claimed-done-but-missing and scope creep.
- **Blast radius (beyond the diff)** — what *depends on* what changed but wasn't touched?
  Other callers of a changed service, a `Json(...)` shape consumed by a Vue view, and the
  **mobile app** (`maraebiz-app`) hitting the `/api/v1` surface. Did a contract change leave a
  consumer stale?
- **Backward compatibility** — app versions already in the field still work against this
  backend. No breaking response/shape/enum change without a compatible path. This is usually
  the biggest ship risk for the cross-repo contract.
- **Rollout & data safety** — EF migration is additive/zero-downtime; existing rows backfilled;
  soft-delete (`IsDeleted`) preserved; a rollback story; config/feature-gating in place if the
  behavior is gated. Confirm the migration was actually added if an entity changed.
- **System-level security & tenancy** — `CompanyKey` isolation holds across the whole flow
  (not just the one method `/validate` looked at), including any raw-SQL path. Role auth holds.
  If Step 3 ran `security-review`, its verdict carries here; if it was skipped, sanity-check
  there was truly no sensitive surface.
- **Observability & operability** — when this breaks in prod, can we see why? Errors go through
  `_logger.LogException` (Serilog/`ISystemLog`); audit captured where relevant; no PII/secrets
  in logs.
- **Cross-repo contract** — the backend `Json(...)` / `api/v1` shape ⇄ the app's
  `src/api/services` + `src/types` (names, types, nullability, enums) line up; both sides
  shipped together.

## Step 5 — Decide and write the sign-off doc

Reach **one** decision. **High/Critical security findings, cross-tenant data exposure,
data-loss, and backward-compat breaks are always blocking.**

Then **persist it** — a sign-off that isn't written down didn't happen. Capture the date and
the commit each touched repo is at, and write the document:
```
git -C maraebiz rev-parse --short HEAD ; git -C maraebiz-app rev-parse --short HEAD ; git -C maraebiz-public-site rev-parse --short HEAD
```
Write `workflow/signoff/YYYY-MM-DD-<slug>.md` (create the `workflow/signoff/` folder if it
doesn't exist) using the template below — fill every field, no placeholders. Use today's date.
If no slug exists (ad-hoc change), use a short kebab description of the change as the slug.

```markdown
---
date: <YYYY-MM-DD>
slug: <slug>
plan: workflow/plans/<slug>.md        # or "none" for ad-hoc work
validation: workflow/validation/<slug>.md   # or "not run"
backend_commit: <maraebiz short sha>
app_commit: <maraebiz-app short sha or n/a>
public_site_commit: <maraebiz-public-site short sha or n/a>
decision: go | go-with-conditions | no-go
signed_off_by: tech-lead-review
---

# Sign-off: <task>

## Decision: ✅ GO | 🟡 GO WITH CONDITIONS | ⛔ NO-GO

## Basis
- Validate report: <pass | issues | not run>
- Gate: <✓ green (Stop hook) | ✗ failing cmd + excerpt>  (build/lint only — no tests exist)
- Bug pass (code-review): <N bugs | clean>
- Security: <security-review: clean | N findings (sev) | skipped — no sensitive surface>

## Overall impact & readiness
- ✅ Goal met — <evidence>
- ⚠️ Blast radius — <consumer that may be affected, file:line>
- ⛔ Backward-compat — <fielded app vN breaks on `MBS.Web/Controllers/X.cs:NN`>

## Blocking (must fix before sign-off)
1. **[title]** `repo/path:line` — what / impact / fix

## Conditions (resolve before merge)
- <item with file:line>

## Risks accepted / follow-ups
- <known limitation, or a /schedule-able follow-up>

## Rationale
<2–4 sentences: why this GO/NO-GO, and the single biggest risk to the project.>
```

Finally, **present the same verdict inline** to the user (don't make them open the file) and
give the path to the written doc.

## Guidelines

- Be **direct and honest** — the accurate call, not the agreeable one. A "GO" you don't
  believe in is worse than a blunt "NO-GO". Approval is earned by evidence.
- Every finding cites `file:line` (or a concrete consumer) and states **impact**.
- State uncertainty: if a readiness risk needs runtime/load info you don't have, say so and make
  it a **condition**, not an assertion.
- You **decide**; you do not edit code. Hand blockers back to the developer.
- Keep it at altitude — don't re-litigate conventions `/validate` already passed.
- **Always write the doc** — GO *or* NO-GO. A NO-GO record is the most useful one to keep:
  it's the evidence trail for why the task wasn't shipped.

## Next

- ⛔ **NO-GO** → developer fixes blockers, re-run `/signoff`.
- 🟡 **CONDITIONS** → resolve them before merge.
- ✅ **GO** → mark the task done; if a plan exists and isn't yet validated, run `/validate
  <slug>` for the formal record, then archive the slug's research/plan/validation/signoff docs.
