---
date: 2026-07-18
slug: server-components-render-digest-error
status: draft   # draft | approved | implementing | shipped
surfaces: [server-action, db-migration]
research: workflow/research/2026-07-18-server-components-render-digest-error.md
estimated_manual_effort: 1h 10m
---

# Fix the masked 500 on /web-orders ("Server Components render" digest) — Implementation Plan

> Note: the `/plan` command is authored for the multi-repo Maraebiz workspace. This project
> is the single-repo **essencefit-dashboard** (Next.js 16 App Router + Supabase/`pg` +
> Vercel). Template adapted: no .NET/EF/Vue/RN phases; the deterministic gate is the
> Next.js build.

## Overview
`https://essencefits.com/web-orders` shows a toast reading *"An error occurred in the Server
Components render…"*. That is Next.js's **generic production mask** over a real error: the
`getWebOrders` server action returns **HTTP 500** (confirmed in the browser console:
`POST /web-orders → 500`). We will (1) **unmask** the real error so it is never invisible
again, then (2) apply the **targeted fix** the unmasked error dictates — near-certainly
re-applying the `deliverystatus` migration to the database Vercel actually uses.

## Estimated Manual Effort
**1h 10m** — human-in-the-loop time only (Claude Code does the implementation): reviewing
each phase (~15m total), redeploying and reading the now-real error in prod (~20m),
applying + verifying the DB fix against prod (~15m), a hardening review (~5m), and the final
`/validate` (~10m). Includes a 10% buffer.

## Current State
Established by direct diagnosis against the `.env.local` database (which memory
`dont-load-test-live-db` says is the prod DB) and against live prod endpoints:

- The failing page is client-only; data comes from the `getWebOrders` **server action**,
  and its failure is caught into a toast — `src/app/(main)/web-orders/page.tsx:80-84`.
- Prod masks the real message — `src/lib/userError.ts:1-14`. The toast text *is* the mask.
- `getWebOrders` runs `await requireAdmin()` then a `SELECT … o.DeliveryStatus … FROM Orders`
  with **no try/catch** — `src/app/(main)/web-orders/actions.ts:17,33-59`. Any throw
  propagates and is masked.
- **Proven working against the `.env.local` DB**: the `deliverystatus` column exists
  (`text`, default `'Processing'`); the exact list SELECT (literal *and* parameterized
  `$1::int/$2::int`) returns the 1 web order; the counts + ILIKE-search paths succeed.
- **Prod runtime is healthy at the connection level**: `GET /api/health` → `{"ok":true,
  "db":"up",…}` (`src/app/api/health/route.ts` — only does `SELECT 1`).
- **Auth is not the cause**: `src/proxy.ts:56-60` returns **401** for an unauthenticated
  non-GET. The console showed **500**, not 401 → proxy passed the POST → the session is
  valid → `requireAdmin` inside the action also passes.
- Prod == HEAD (`53759de`): `origin/main` == local HEAD; the `/api/health` response shape
  and `proxy.ts`'s `/login` redirect both match HEAD source.
- **Migrations are NOT run on deploy** (`package.json` `build` = `next build --turbopack`;
  no migrate/postinstall). The patch `db/pg/patches/2026-07-17-delivery-status.sql` must be
  applied to the prod DB out-of-band via `db/pg/apply.mjs`.

**Conclusion:** with the query, schema, connectivity, and auth all individually proven
against the `.env.local` DB, a persistent masked 500 on exactly the `DeliveryStatus` query
means the **database Vercel connects to (its `DATABASE_URL`) is not in the state this code
requires** — overwhelmingly likely **missing the `deliverystatus` column** (health's
`SELECT 1` still passes; `SELECT o.DeliveryStatus` fails with `42703 column … does not
exist`). This also explains the apply→revert×3 saga: the column was applied to *a* DB, but
not the one prod uses. Phase 1 confirms this beyond doubt before we touch anything.

## Desired End State
`/web-orders` loads the orders list with no toast error; the `getWebOrders` POST returns
200. Server-action failures on this path are **logged server-side (visible in Vercel logs)
and surfaced to the admin with their real reason** instead of the generic mask, so a future
regression is diagnosable in seconds rather than days.

## What We're NOT Doing
- Not changing the auth/proxy/session design (proven not the cause).
- Not rewriting the `pg`/mssql shim or the query itself (it works).
- Not adding an automatic migrate-on-deploy pipeline in this task (called out as follow-up
  in Phase 3, not built — it needs its own review of secrets/ordering).
- Not un-masking errors app-wide in one shot — scoped to the web-orders read path here,
  with the pattern documented for reuse.

## Touchpoints per surface
- **Server action (`src/app/(main)/web-orders/actions.ts`)**: wrap `getWebOrders` body in
  try/catch; `console.error` the real error (Vercel captures) and rethrow as
  `UserFacingError` so the toast shows the truth. Import `UserFacingError` from
  `@/lib/userError`.
- **DB migration (`db/pg/patches/2026-07-17-delivery-status.sql`)**: idempotent; to be
  applied against the **exact** `DATABASE_URL` Vercel uses (Phase 2).
- **Env / infra (Vercel)**: confirm the prod `DATABASE_URL` value and that it is the DB the
  patch is applied to. (Manual, user-performed; steps provided.)
- **Tenancy note:** n/a — single-tenant app; no `CompanyKey`/multi-tenant filter concerns.
- **App / public site:** none.

## Phase 1: Unmask the web-orders read error
### Changes
#### `getWebOrders` — `src/app/(main)/web-orders/actions.ts`
Wrap the whole action so no failure is masked. **Return the error as data — do NOT throw it.**
Next.js redacts *every thrown Error* (incl. `UserFacingError`) in prod to the generic digest;
only a returned value crosses the boundary intact (the `userError.ts` pattern, already used by
`verifyWebPayment`). Admin-only panel, so surfacing DB detail is acceptable. Also
`console.error` so it lands in Vercel runtime logs.
```ts
export async function getWebOrders(opts?: { /* unchanged */ }): Promise<
  | { ok: true; rows: any[]; total: number; unverifiedTotal: number }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    // ... existing body unchanged (limit/offset/search, list query, counts) ...
    return { ok: true, rows: res.recordset, total: /*…*/, unverifiedTotal: /*…*/ };
  } catch (err) {
    console.error("[getWebOrders] failed:", err);
    const e = err as { code?: string; message?: string };
    const detail = e?.code ? `${e.code} ${e.message ?? ""}`.trim() : e?.message ?? String(err);
    return { ok: false, error: `Website orders failed to load: ${detail}` };
  }
}
```
Caller `page.tsx` `load()`: add `if (!d.ok) throw new Error(d.error);` before
`setOrders(d.rows)` — the existing `catch` turns it into `toast.error(e.message)`.

> **Note (2026-07-18):** first deploy (`9fb94af`) *threw* `UserFacingError` and was still
> redacted in prod — corrected to the return-as-data shape above.
### Success Criteria
#### Automated (the deterministic gate — must be green)
- [ ] Build passes: `NODE_OPTIONS=--dns-result-order=ipv4first npm run build`
      (the DNS flag per memory `build-needs-ipv4-dns`)
- [ ] Types pass: `npx tsc --noEmit`
#### Manual (human verification)
- [ ] Deploy to prod (push to `main` / redeploy on Vercel).
- [ ] Open `https://essencefits.com/web-orders` while logged in as admin. The toast now
      shows a **real** reason (expected: `42703 column "deliverystatus" does not exist`, or a
      connection/env error), not the generic mask.
- [ ] Confirm the same error appears in **Vercel → your project → Logs (Runtime)** tagged
      `[getWebOrders] failed:` (this is the durable observability we're adding).

**Pause here** — record the exact unmasked message; it selects the Phase 2 branch below.

---

## Phase 2: Apply the fix the unmasked error dictates
Pick the branch matching the message revealed in Phase 1. **(A) is the predicted case.**

### (A) `column "deliverystatus" does not exist` (or similar 42703)  ← most likely
The DB Vercel uses is missing the migration.
### Changes / steps
1. In **Vercel → Settings → Environment Variables**, read the prod `DATABASE_URL` and
   confirm which Supabase DB/host it targets.
2. Apply the idempotent patch to **that exact** DB:
   `db/pg/patches/2026-07-17-delivery-status.sql` (via `node db/pg/apply.mjs` pointed at that
   `DATABASE_URL`, or run the SQL in the Supabase SQL editor for that project).
3. Verify: `SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND
   column_name='deliverystatus';` returns a row **on the DB Vercel uses**.

### (B) Connection / auth / secret error (e.g. `SESSION_SECRET`, ECONNREFUSED, auth failed)
Fix the offending Vercel env var (`DATABASE_URL` or `SESSION_SECRET`) so it matches the
working DB / the secret that mints admin cookies; redeploy.

### (C) `0A000 cached plan must not change result type` (transient post-DDL)
Confirm the column now exists (A) — this class self-clears once pooled connections cycle; if
it persists, restart the Supabase pooler / rotate the connection. No code change.

### Success Criteria
#### Automated
- [ ] (A) `information_schema` check returns `deliverystatus` on the prod DB.
#### Manual (human verification)
- [ ] `https://essencefits.com/web-orders` loads the list with **no** toast error.
- [ ] Browser console shows `POST /web-orders → 200` (not 500).
- [ ] Changing an order's Delivery dropdown persists (exercises `setWebDeliveryStatus`).

**Pause here** for confirmation before Phase 3.

---

## Phase 3: Prevent silent recurrence (hardening)
### Changes
1. **Keep the Phase 1 unmasking** as the permanent pattern; apply the same try/catch→log→
   `UserFacingError` wrapper to the sibling read actions that can 500 the page:
   `getWebOrderDetails` (`web-orders/actions.ts:112`) and, if desired, the shared
   `getOrderDetails`/list reads in `orders/actions.ts`.
2. **Document the deploy ordering** in `db/pg/patches/` README or CLAUDE notes: *"apply a
   column-adding patch to the prod `DATABASE_URL` BEFORE deploying code that SELECTs it —
   builds do not run migrations."* (This is the exact trap that caused the revert saga.)
### Success Criteria
#### Automated
- [ ] Build passes: `NODE_OPTIONS=--dns-result-order=ipv4first npm run build`
- [ ] Types pass: `npx tsc --noEmit`
#### Manual (human verification)
- [ ] Force a read error in a scratch check (e.g. temporarily point a local query at a bad
      column) and confirm the toast + Vercel log show the real reason — i.e. masking can't
      silently return.

## Testing Strategy
No unit suite gates this. Verification is manual against prod after each deploy, per the
criteria above. The single most important check is the **Phase 1 unmasked message** — it
converts a guessing game into a one-line diagnosis. The E2E suite runs against the live DB
(memory `e2e-order-flow-suite` / `dont-load-test-live-db`) so do **not** run it as part of
this fix — a single read-only `information_schema` check is sufficient and safe.

## References
- Research: `workflow/research/2026-07-18-server-components-render-digest-error.md`
- Masking pattern to follow: `src/lib/userError.ts:1-14`;
  existing correct usage: `web-orders/actions.ts:82-86` (`verifyWebPayment`)
- Failing action: `src/app/(main)/web-orders/actions.ts:11-66`
- Auth path (ruled out): `src/proxy.ts:56-60`, `src/lib/adminAuth.ts:74-79`
- Migration: `db/pg/patches/2026-07-17-delivery-status.sql`; applier: `db/pg/apply.mjs`
- Industry standard considered: surfacing server-action failures as typed, returned data
  (rather than thrown Errors that Next strips in prod) is the documented Next.js App Router
  practice; this plan follows the repo's own established `UserFacingError` convention, which
  already embodies it. Source: Next.js docs, "Error Handling" for Server Actions/Functions.
