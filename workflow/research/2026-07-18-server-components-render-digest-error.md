---
date: 2026-07-18
topic: "Production 'An error occurred in the Server Components render' (digest) error seen at https://essencefits.com/web-orders"
repo_commit: 53759de
project: essencefit-dashboard (Next.js 16 App Router + Supabase/pg + Vercel)
status: complete
tags: [research, web-orders, server-actions, error-masking, delivery-status, postgres-plan-cache]
---

# Research: production "Server Components render" digest error on /web-orders

> Note: the `/research` command is authored for the multi-repo **Maraebiz** workspace.
> This project is the single-repo **essencefit-dashboard** (Next.js + Supabase). The
> template has been adapted accordingly — there is no backend/app/public-site split here.

## Research Question
On `https://essencefits.com/web-orders`, production shows: *"An error occurred in the
Server Components render. The specific message is omitted in production builds… A digest
property is included…"*. Where does this originate, and how does it connect to the
delivery-status commit history the user pointed at ("check committ")?

## Summary
The pasted text is **Next.js's generic production error** — the real message is stripped
server-side and only a `digest` hash is exposed. It is **not** a bug unique to the
`/web-orders` component.

The whole `(main)` admin shell — **all 29 pages, including `web-orders/page.tsx`** — is
`"use client"`. None of them fetch from the DB during SSR; every row of data reaches the
page through **server actions** invoked from `useEffect`/handlers on the client. Because of
that, a DB/auth failure inside those actions is caught in the page's `try/catch` and shown
as a **toast**, while the *full-page* Next digest error comes from a **server-side throw
whose message was stripped**.

All the evidence — the commit saga, the "post-DDL plan-cache transient" note, and the two
relevant memory notes — points at the **server-action → Postgres path** that the
delivery-status feature newly touched: `getWebOrders` (and the shared `orders` queries) now
reference `o.DeliveryStatus`. Deploying that column reference against the live Supabase DB
around the `ALTER TABLE orders ADD COLUMN deliverystatus` DDL produces raw Postgres errors
(missing column, or **"cached plan must not change result type"**, SQLSTATE `0A000`, on
pooled `pg` connections holding stale plans). Production strips the message → the exact
digest error the user pasted. That is precisely why the feature was applied→reverted 3×.

**The digest value is the only thing that definitively identifies the throw** — and
server-side error capture was *removed* in the current HEAD (`53759de` deleted
`src/instrumentation.ts` / `onRequestError`), so the digest must now be read from **Vercel
runtime function logs**.

## Detailed Findings

### The failing route is client-only
- `src/app/(main)/web-orders/page.tsx:1` — `"use client"`. Data comes from
  `getWebOrders(...)` called in `load()` inside `useEffect` (`page.tsx:68-94`); the
  `catch` turns any failure into `toast.error(...)` (`page.tsx:80-84`). A DB failure here
  is a **toast**, not a full-page error.
- `src/app/(main)/layout.tsx:1` — the admin shell is also `"use client"`; during SSR it
  renders `<FullScreenLoader/>` while `authLoading` (`layout.tsx:53-55`), so the page's DB
  path never runs server-side.
- Every `(main)/*/page.tsx` (all 29, incl. `orders`, `dashboard`, `web-orders`) begins with
  `"use client"`. The **only** server component in the `/web-orders` tree is the root
  `src/app/layout.tsx` (metadata + `next/font/google` Inter + `new URL(SITE_URL)` shell) —
  which has no delivery-status coupling.
- The error the user *sees* is rendered by `src/app/(main)/error.tsx` (the admin error
  boundary), which surfaces `error.digest` at `error.tsx:25-27` ("Reference: …").

### The data path the delivery feature changed
- `src/app/(main)/web-orders/actions.ts:11` `getWebOrders` — `"use server"` action;
  `await requireAdmin()` (`actions.ts:17`), then `SELECT … o.DeliveryStatus … FROM Orders`
  (`actions.ts:33-49`). **No try/catch** around the query → a raw DB error propagates out
  of the action and is stripped by production.
- Shared order queries also gained the column: `src/app/(main)/orders/actions.ts:243`
  (SELECT `o.DeliveryStatus`), `:276` (INSERT column list includes `DeliveryStatus`), and
  `updateDeliveryStatus` at `:787-810`.
- `verifyWebPayment`/`setWebOrderStatus` (`web-orders/actions.ts:70-102`) *do* wrap in
  try/catch but only convert `UserFacingError` via `userErrorMessage`; **raw DB errors are
  rethrown** (`actions.ts:85, 100`) → stripped in prod.

### Why production hides the real message
- `src/lib/userError.ts:1-14` — documents the exact behavior: "Next.js strips thrown Error
  messages from server actions in production ('The specific message is omitted…')." Only
  `UserFacingError` messages cross the boundary as data; everything else becomes a digest.
  Raw `pg` errors are never `UserFacingError`, so they are always masked.

### The schema / migration state
- `db/pg/patches/2026-07-17-delivery-status.sql` — `ALTER TABLE orders ADD COLUMN IF NOT
  EXISTS deliverystatus text NOT NULL DEFAULT 'Processing'` + index. Idempotent, mirrored
  in `db/pg/schema.sql:135,419`.
- `src/lib/columnCase.ts:62` — `"deliverystatus": "DeliveryStatus"` **is** present, so the
  pg→PascalCase remap (`sqlShim.ts:26-30`) is correct. The column mapping is **not** the bug.
- **Migrations are not run on deploy**: `package.json` `build` is just `next build`; there
  is no `postinstall`/migrate hook. The patch must be applied to Supabase manually
  (`db/pg/apply.mjs`), which creates a code-vs-schema race window on each deploy.

### Connection / pooler layer (plan-cache mechanism)
- `src/lib/sqlShim.ts:34-44` `getPool()` — a single `pg` `Pool` (`max` =
  `DB_POOL_MAX ?? 5`) over `DATABASE_URL` (Supabase pooler). Long-lived pooled connections
  are exactly what hold stale cached plans after a DDL, producing `0A000 "cached plan must
  not change result type"` until they cycle — the "post-DDL plan-cache transient" the commit
  messages name.

### Commit history the user flagged ("check committ")
`git log` on `db/pg/patches/2026-07-17-delivery-status.sql`:
- `0fcf2fb` add → `feb9e10` revert → `10c7bb4` reapply → `a498190` revert →
  `b6965ba` reapply ("schema already live; prior errors were post-DDL plan-cache
  transients") → `c49874b` revert → `618c981` debug (onRequestError→DB, preview only) →
  `53759de` (HEAD) "Remove temporary diagnostics; **delivery feature stays**".
- HEAD therefore **ships the delivery code** (SELECTs `o.DeliveryStatus`) but **removed**
  the server-side error capture (`src/instrumentation.ts` deleted in `53759de`).

## Code References
- `src/app/(main)/web-orders/page.tsx:68-84` — client `load()` + toast-on-fail (DB error ≠ full-page error)
- `src/app/(main)/web-orders/actions.ts:33-49` — `getWebOrders` SELECT incl. `o.DeliveryStatus`, no try/catch
- `src/app/(main)/orders/actions.ts:243,276,787-810` — shared Orders SELECT/INSERT + `updateDeliveryStatus`
- `src/lib/userError.ts:1-14` — why prod strips server-action error messages (the digest)
- `src/app/(main)/error.tsx:25-27` — where the `digest` is shown to the admin
- `src/lib/sqlShim.ts:34-44` — single pg Pool over the Supabase pooler (stale-plan surface)
- `src/lib/columnCase.ts:62` — `deliverystatus`→`DeliveryStatus` remap present (not the bug)
- `db/pg/patches/2026-07-17-delivery-status.sql` — the DDL; not auto-applied on deploy
- `package.json` `build: next build` — no migration step on deploy

## Architecture / Conventions Observed
- **Client-page + server-action** everywhere in `(main)`; SSR renders a loader, so admin DB
  errors normally appear as toasts. A full-page digest error means a throw escaped an action
  (or the SSR shell) rather than being caught.
- **Deliberate error masking**: only `UserFacingError` messages survive to the client
  (`userError.ts`); raw infra/DB errors are intentionally opaque in prod (digest only).
- **mssql-shaped API over `pg`** via `sqlShim.ts`; PascalCase remap driven by the
  hand-maintained `columnCase.ts`.
- **Schema drift is manual**: DDL patches live in `db/pg/patches/` and are applied
  out-of-band, so every column-adding deploy has a race window with the live DB.

## Related Prior Work (from workflow/ and memory)
- Memory `server-action-errors-masked` — prod strips thrown Error messages; return
  `{ ok:false, error }` via `UserFacingError`. Explains the exact digest wording.
- Memory `dont-load-test-live-db` — `.env.local` `DATABASE_URL` == prod DB; exhausting the
  Supabase pooler yields intermittent prod 500s that "look like a code bug, isn't." Same
  generic-error signature; a second candidate trigger for the same digest.
- Memory `orders-mostly-via-whatsapp` — most orders are admin-entered, not web; the
  `/web-orders` list is often near-empty (consistent with the SSR empty-state).
- `workflow/plans/2026-07-05-storefront-admin-gap-analysis.md`,
  `workflow/{research,plans}/2026-06-21-order-and-stock-sync-audit.md` — prior order/stock
  work referencing `getWebOrders`.

## Open Questions
1. **What is the actual `digest`?** HEAD removed `instrumentation.ts`, so read it from
   **Vercel → Project → Logs (Runtime)**: find the log line whose `digest` matches the one
   shown as "Reference:" on the error page. That line carries the real message + stack + (if
   Postgres) the SQLSTATE — the single fact that resolves surface (server action vs SSR
   shell) and cause (missing column vs `0A000` plan cache vs pooler exhaustion).
2. Is `deliverystatus` actually present in the **prod** Supabase DB right now (was the patch
   applied, or only reverted in code)? A `\d orders` / `information_schema.columns` check
   settles the code-vs-schema race.
3. Is the failure **persistent or transient**? Persistent ⇒ real schema/query mismatch or
   pooler exhaustion; transient-then-clears ⇒ the post-DDL cached-plan cycle the commits
   assumed.
4. Are `SESSION_SECRET` / `DATABASE_URL` set in the Vercel prod env? Missing `SESSION_SECRET`
   makes `requireAdmin` → `secret()` throw in prod (`adminAuth.ts:22-28`) — another masked
   throw with the same digest signature, unrelated to delivery.
