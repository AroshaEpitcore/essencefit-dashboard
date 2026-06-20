---
description: Phase 3 — implement an approved plan from workflow/plans/ one phase at a time, verifying against the gate and pausing for manual confirmation
---

# Implement (Phase 3)

Implement an approved plan from `workflow/plans/`. Plans have phases with specific changes and success criteria (automated + manual).

## Getting started
- Read the plan COMPLETELY; note any existing `- [x]` checkmarks (resume from the first unchecked item).
- Read the linked research doc and every file the plan references — fully, no limit/offset.
- Set the plan's frontmatter `status: implementing`.
- Build a todo list from the plan's phases and changes.
- The repo-specific rules in each `CLAUDE.md` (`maraebiz/`, `maraebiz-app/maraebiz-mobile-app/`, `maraebiz-public-site/`) apply automatically as you edit files in that repo — follow them; don't restate them here.

If no plan path was given, ask for one.

## Philosophy
Plans are a guide, but reality is messy. Follow the plan's **intent**; adapt to what the code actually is. Implement each phase fully before the next.

If reality contradicts the plan, STOP and surface it:
```
Issue in Phase [N]:
Expected: <plan says>
Found: <actual>
Why it matters: <impact>
How should I proceed?
```
Don't silently improvise around a material mismatch.

## Delegating to specialists (optional)
You own scope, sequencing, and the cross-repo backend↔app contract. For a phase that lives entirely in ONE surface, you may delegate the focused implementation to a specialist agent, then review what it returns:
- backend service/data/controller (maraebiz/ MBS.Web) → **`backend-feature`**
- Razor + Vue 2 views (maraebiz/ Views) → **`vue-admin-view`**
- RN app screens/services/hooks/stores → **`rn-screen`**
- public marketing site pages/components → **`react-web`**
Keep cross-surface coordination in the main context: if a phase changes a backend `Json(...)` shape *and* its app consumer, drive both yourself (or delegate each side separately) and verify the contract lines up. Never let a specialist invent a contract the other side doesn't honor.

## Per-phase loop
1. Make the changes for the phase (across whatever surfaces it touches — keep the backend `Json(...)`/`api/v1` shape ⇄ app service contract in sync).
2. Run the phase's **Automated** success criteria yourself — the exact commands in the plan, e.g.:
   - `dotnet build maraebiz/Maraebiz.sln`
   - `npm --prefix maraebiz-app/maraebiz-mobile-app run lint`  (if the app was touched)
   - `npm --prefix maraebiz-public-site run build`  (if the public site was touched)
   Fix anything red before proceeding. (The Stop hook runs the build/lint gate too — but don't wait for it; verify proactively.) Remember there are no test suites — lean on manual verification.
3. Check off completed automated items in the plan file itself (Edit `- [ ]` → `- [x]`).
4. **Pause for manual verification**:
   ```
   Phase [N] complete — ready for manual verification.
   Automated checks passed: <list>
   Please verify manually: <the plan's manual items>
   Tell me when manual testing passes and I'll continue to Phase [N+1].
   ```
   Do NOT check off manual items until the user confirms. If told to run multiple phases consecutively, skip the pause until the last phase.

## Committing — MANUAL ONLY
**Never run `git add`, `git commit`, or `git push` unless the user explicitly asks to commit in that same message.** "Ship", "ship the change", "done", "finish the phase", or setting `status: shipped` are **NOT** commit requests — they do not authorize a commit. When implementation is verified, leave all changes in the working tree and stop; let the user commit themselves.

Only when the user explicitly asks to commit: commit each touched repo separately, start the message body with the plan slug so code ↔ plan stays linked, and never bypass husky / hooks:
```
<short summary>

plan: workflow/plans/<slug>.md
```
(Only commit when the user asks; never bypass hooks.)

## If you get stuck
Re-read the relevant code first; consider whether the codebase moved since the plan was written; then present the mismatch and ask. Use sub-agents only for targeted debugging or unfamiliar territory.

When the whole plan is implemented and verified, set `status: shipped` (this is only an edit to the plan's frontmatter — it does **not** trigger a commit; see Committing — MANUAL ONLY above).

## Next
Recommend `/clear`, then `/validate <slug>` to verify the implementation against the plan and produce a validation report.
