---
date: 2026-06-21
slug: dtf-order-customer-tracking
status: implementing
surfaces: [storefront, admin-data, db]
research: workflow/research/2026-06-21-dtf-order-customer-tracking.md
estimated_manual_effort: 1h 30m
---

# Order Account & Tracking (Web + DTF) — Implementation Plan

## Overview
Make every order trackable by the customer: require a password at **both** the web checkout and the DTF customize submit so an account is always created (or the logged-in account is used) and the customer is auto-signed-in; link DTF orders to the account; show **all** orders (regular + DTF) together in "My orders"; and add a DTF tracking page. Also backfill existing orders to accounts by phone/email.

## Estimated Manual Effort
**1h 30m** — total human-in-the-loop time only (reviewing each phase + manual verification at each pause + final `/validate`), with a 10% buffer. Claude Code implements; no dev hours counted.

## Current State
- Customer session via signed cookie `ef_customer` over `Customers`; `getCurrentCustomer()` returns the account only when `PasswordHash IS NOT NULL` (`src/lib/customerAuth.ts:49,60`).
- **Web checkout account is optional with a loophole:** `checkout/page.tsx` has a "Create an account" checkbox that can be unticked, and even when ticked the password can be empty → `createWebOrder` is called with `password: undefined` → a **guest** `Customers` row (no `PasswordHash`) that **cannot log in** (`checkout/page.tsx:36,85-96`; `checkout/actions.ts:101-137`). This is why a placed order isn't trackable.
- `createWebOrder` upserts the customer by phone and sets `Orders.CustomerId`; auto-logs-in only when an account is created (`checkout/actions.ts:96-137,150,200`).
- `getMyOrders()` returns only regular `Orders WHERE CustomerId=@Cid` (`account/actions.ts:100-115`); `/account` + `/account/orders` render it; rows link to `/order/[id]` (`account/page.tsx:36-47`, `account/orders/page.tsx:39`).
- **DTF orders are not linked or trackable:** `DtfOrders` has no `CustomerId`; `createDtfOrder` never reads the session, never creates/links a customer, and there is no customer-facing DTF view (`db/16_dtf_orders.sql`; `src/app/(shop)/customize/actions.ts`).
- DTF form collects name/phone/whatsapp/email/address but **no password** (`src/app/(shop)/customize/CustomizeForm.tsx`).

## Desired End State
- Placing a web order or DTF request while **logged out** requires a password (phone already required; email optional) → account created + auto-signed-in; a "Log in" link lets returning customers sign in first. Logged-in customers skip the password and the order links to their account.
- `My orders` lists **both** regular and DTF orders (matched by `CustomerId` or phone/email), newest first, DTF rows carrying a "Custom" badge and linking to a `/dtf-order/[id]` tracking page; regular rows link to `/order/[id]`.
- A DTF tracking page shows status, garment/variant/qty/prints, uploaded designs, and estimate/final price.
- Existing `Orders` and `DtfOrders` are backfilled to accounts by phone/email, so prior orders (incl. the test DTF order) appear after login.

## What We're NOT Doing
- No online payment for DTF (unchanged); no Sales/finance rows for DTF.
- No passwordless "track by phone + number" page (we chose required accounts).
- No social/OTP login; password auth only (existing scheme).
- No changes to admin order/DTF modules beyond what the linkage needs.
- No email/SMS notifications.

## Touchpoints per surface
- **DB**: `db/17_order_account_linkage.sql` — `DtfOrders.CustomerId` (+index); backfill `Orders.CustomerId` & `DtfOrders.CustomerId` by phone/email.
- **Storefront actions**: `checkout/actions.ts` (`createWebOrder` session-link + require password), `customize/actions.ts` (`createDtfOrder` session-link/create + `CustomerId`), `account/actions.ts` (`getMyOrders` merged; new `getMyDtfOrder`).
- **Storefront UI**: `checkout/page.tsx` (required password + login link), `customize/CustomizeForm.tsx` (required password + login link + prefill), `account/page.tsx` + `account/orders/page.tsx` (merged list + badge), new `src/app/(shop)/dtf-order/[id]/page.tsx`.
- **Tenancy**: single-tenant — n/a.
- **App / Public site**: none.

---

## Phase 1: DB — DTF customer link + backfill
### Changes
#### `db/17_order_account_linkage.sql` (idempotent; apply with the throwaway `mssql` node script)
```sql
IF COL_LENGTH('DtfOrders','CustomerId') IS NULL
  ALTER TABLE DtfOrders ADD CustomerId UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_DtfOrders_CustomerId')
  CREATE INDEX IX_DtfOrders_CustomerId ON DtfOrders(CustomerId);
GO
-- Backfill DTF orders to a customer by phone, else email (prefer a real account).
UPDATE d SET d.CustomerId = c.Id
FROM DtfOrders d
JOIN Customers c ON c.Phone = d.CustomerPhone
WHERE d.CustomerId IS NULL;
UPDATE d SET d.CustomerId = c.Id
FROM DtfOrders d
JOIN Customers c ON c.Email = d.Email
WHERE d.CustomerId IS NULL AND d.Email IS NOT NULL;
GO
-- Backfill any unlinked regular orders by phone/email too.
UPDATE o SET o.CustomerId = c.Id
FROM Orders o
JOIN Customers c ON c.Phone = o.CustomerPhone
WHERE o.CustomerId IS NULL;
GO
```
### Success Criteria
#### Automated
- [x] Migration applies cleanly (node `mssql` script prints `DtfOrders.CustomerId` length = 16 and re-runs with no error).
- [x] App builds: `npm run build`
#### Manual
- [ ] In SQL, the existing test DTF order now has a `CustomerId` if a `Customers` row shares its phone.

**Pause here** for confirmation.

---

## Phase 2: Web checkout — require an account
### Changes
#### `src/app/(shop)/checkout/page.tsx`
- When **not** logged in: make the password **required** (remove the opt-out/empty-password path), keep the explainer, and add an "Already have an account? **Log in**" link → `/account/login?next=/checkout`. Validate `password.length >= 6` before placing.
- When logged in: keep the existing prefill + a small "Ordering as <name>" note; no password field.
- Always pass `password` when not logged in (no `makeAccount` toggle).
#### `src/app/(shop)/checkout/actions.ts` — `createWebOrder`
- Read `getCurrentCustomer()`. If a session exists, link the order to that `CustomerId` (skip password handling). If no session, **require** a valid password (`>= 6`, else throw) and create the account (existing path) — guests-without-account no longer possible. Keep the existing auto-login.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] Logged out: placing an order without a password is blocked; with a password it creates an account, lands on `/order/[id]`, and the header shows signed-in.
- [ ] Logged in: checkout shows no password field and the order appears in My orders.
- [ ] "Log in" link returns to checkout after signing in.

**Pause here** for confirmation.

---

## Phase 3: DTF submit — require an account + link
### Changes
#### `src/app/(shop)/customize/CustomizeForm.tsx`
- Load the session (via a passed-in `loggedIn`/account prop from the page, mirroring checkout's `getMyAccount`). When not logged in: add a **required** password field in the "Your details" section + an "Already have an account? Log in" link → `/account/login?next=/customize`. When logged in: prefill name/phone/email and hide the password.
#### `src/app/(shop)/customize/actions.ts` — `createDtfOrder`
- Read `getCurrentCustomer()`. If logged in, use that `CustomerId`. If not, **require** a password, upsert a `Customers` row by phone with the bcrypt hash (mirror `createWebOrder`'s customer upsert), set the session cookie (auto-login), and use that id. Persist `CustomerId` on the `DtfOrders` insert.
#### `src/app/(shop)/customize/page.tsx`
- Pass the current account (from `getCurrentCustomer`) into `CustomizeForm` for prefill/logged-in state.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] Logged out: DTF submit requires a password; on submit an account is created, auto-signed-in, and the `DtfOrders` row has `CustomerId`.
- [ ] Logged in: no password field; the DTF order links to the account.

**Pause here** for confirmation.

---

## Phase 4: Unified "My orders" data
### Changes
#### `src/app/(shop)/account/actions.ts`
- Rewrite `getMyOrders()` to return a **merged** list for the session customer, matched by `CustomerId OR CustomerPhone OR CustomerEmail` across:
  - regular `Orders` → `{ kind:"order", id, number, date:OrderDate, status:PaymentStatus, total:Total, count:LineCount, href:"/order/<id>" }`
  - `DtfOrders` → `{ kind:"dtf", id, number:Ref, date:CreatedAt, status:Status, total:COALESCE(FinalTotal,EstimatedTotal), count:designCount, href:"/dtf-order/<id>" }`
  - Sort by date desc. Return a typed `MyOrder[]`.
- Add `getMyDtfOrder(id)` → the DTF order (header + designs) for the owner (match by `CustomerId`/phone/email of the session, else null), for the tracking page.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] A logged-in customer who has both a web order and a DTF order sees both from `getMyOrders` (verified via the account UI in Phase 5).

**Pause here** for confirmation.

---

## Phase 5: Account UI — merged list with badge
### Changes
#### `src/app/(shop)/account/page.tsx` and `src/app/(shop)/account/orders/page.tsx`
- Render the merged `MyOrder[]`: use `o.href`, `o.number`, `o.date`, `o.status`, `o.total`, `o.count`; show a **"Custom"** badge when `kind==="dtf"`. Update the "My orders" count and the recent list to the merged data. Map DTF statuses through the colour map (add Confirmed/InProduction/Ready).
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] `/account` and `/account/orders` list both order types newest-first; DTF rows show "Custom" and open `/dtf-order/[id]`; regular rows open `/order/[id]`.

**Pause here** for confirmation.

---

## Phase 6: DTF customer tracking page
### Changes
#### `src/app/(shop)/dtf-order/[id]/page.tsx` (new, server)
- Load via `getMyDtfOrder(id)` (owner-scoped); `notFound()` on miss. Show: a status step indicator (Pending → Confirmed → In production → Ready → Completed; Canceled state), garment + variant + qty + print options, uploaded designs (image thumbnails / PDF links), estimate and final price/advance if set, and the shop WhatsApp contact. Reuse `money`/format and the squared storefront styling.
#### `src/app/(shop)/customize/CustomizeForm.tsx` (success state)
- Replace the bare ref display with links to `/dtf-order/<id>` ("Track my order") and `/account/orders` ("View in My Account"). (Return the new order `id` from `createDtfOrder` — already returned.)
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] After submitting a DTF order, the success screen links to `/dtf-order/[id]`, which shows the correct status/designs/price; the same page is reachable from My orders; an unrelated id is not exposed to another account.

**Pause here**, then run `/validate dtf-order-customer-tracking`.

## Testing Strategy
No automated tests. Gate per phase = `npm run build` (+ the one-off migration script in Phase 1). End-to-end manual check: (1) place a web order logged-out → account created → visible in My orders; (2) place a DTF order logged-out → account created → visible with "Custom" badge → tracking page shows status; (3) log in as a returning customer and confirm both surface; (4) confirm the pre-existing test DTF order appears after backfill. Seed: an active DTF-printable product with stock, and the seeded `DtfPriceItems`.

## References
- Research: `workflow/research/2026-06-21-dtf-order-customer-tracking.md`
- Web order linkage to mirror: `src/app/(shop)/checkout/actions.ts:96-150,200`
- Account list/query model: `src/app/(shop)/account/actions.ts:100-115`
- Session helpers: `src/lib/customerAuth.ts:49,65`
- DTF order create + schema: `src/app/(shop)/customize/actions.ts`, `db/16_dtf_orders.sql`
- Tracking page pattern: `src/app/(shop)/order/[id]/page.tsx`
- Industry standard considered: requiring an account at checkout diverges from the common "guest checkout" best practice (Baymard) — accepted here because the owner explicitly wants login-based tracking and the storefront is small; phone+password keeps friction low. (n/a external lib.)
