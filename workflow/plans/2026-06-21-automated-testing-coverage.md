---
date: 2026-06-21
slug: automated-testing-coverage
status: implementing   # draft | approved | implementing | shipped
surfaces: [storefront, admin, server-actions, lib, test-harness]
research: workflow/research/2026-06-21-automated-testing-coverage.md
estimated_manual_effort: 5h 20m
---

# Automated Testing Coverage (Storefront + Admin) — Implementation Plan

## Overview
Stand up a full automated test suite for the EssenceFit Next.js app — **Vitest** for unit + server-action integration tests against a dedicated seeded SQL Server test DB, and **Playwright** for end-to-end browser coverage of every storefront and admin flow (account creation, ordering, DTF, admin order entry, payments, stock, finance, settings).

## Estimated Manual Effort
**5h 20m** — total human-in-the-loop time only: overviewing/reviewing each phase's changes, running the manual verification at each pause (esp. confirming the test-DB harness and the first E2E run on the reviewer's machine), and the final `/validate`. Implementation is done by Claude Code, so **no development hours are counted**. Includes a 10% buffer.

## Current State
- **No tests, no runner, no CI.** `package.json:5-9` has only `dev`/`build`/`start`; no test deps (`package.json:10-37`). Quality gate today is `npx tsc --noEmit`.
- **Single Next.js 16 / React 19 repo**; logic in **28 `actions.ts` server actions**; one route handler `POST /api/upload` (`src/app/api/upload/route.ts:25`).
- **Auth**: customer = HMAC `ef_customer` cookie via `SESSION_SECRET` (`src/lib/customerAuth.ts:11-79`); admin = **localStorage `authUser`** guarded client-side (`src/lib/useAuth.ts:24-47`, `src/app/(main)/layout.tsx:27-43`) — no admin cookie/middleware.
- **DB**: mssql singleton from `DB_*` env (`src/lib/db.ts:3-21`); blank-stock resolver is SQL function `dbo.fn_StockVariantId` (`db/18_shared_stock.sql:24-42`). Schema = ordered migrations `db/00..22_*.sql`, applied by `db/apply.mjs` (`db/apply.mjs:1-51`); seeds `db/seed.sql`, `db/seed_demo.sql`.
- **Surface**: 16 storefront `(shop)` pages, 25 admin `(main)` pages, `(auth)` login/register. Order/stock invariants documented in `workflow/research/2026-06-21-order-and-stock-sync-audit.md`.

## Desired End State
- `npm run test:unit` (Vitest) and `npm run test:e2e` (Playwright) both run green locally.
- A one-command DB harness (`npm run test:db:reset`) drops/recreates a dedicated test DB, applies all migrations, and loads a deterministic seed.
- Unit tests cover pure `lib/` logic; integration tests cover every order/stock/account/catalog server action and its invariants; E2E tests cover every storefront and admin page's primary flows.
- A `TESTING.md` documents how to run everything. `tsc --noEmit` stays green.

## What We're NOT Doing
- No CI/GitHub Actions pipeline (deferred — local scripts only this round).
- No load/performance, visual-regression, mutation, or security/pentest testing.
- No real external calls (Google Maps tiles, any WhatsApp/email/SMS send) — those are stubbed or asserted at the UI boundary only.
- No refactor of app code to make it "more testable" beyond tiny, behavior-preserving export tweaks if strictly required (called out if so).
- No adding server-side admin auth enforcement (documented gap; out of scope here).

## Touchpoints per surface
> Single repo; "surfaces" are test layers. Single-tenant app — no `CompanyKey`/tenancy concerns.
- **Test harness**: `package.json` scripts + devDeps; `vitest.config.ts`; `playwright.config.ts`; `.env.test`; `test/db/reset.mjs`; `db/seed_test.sql`; `test/fixtures/` (auth + data helpers); `test/setup/` (global setup/teardown); `.gitignore` (uploads/test artifacts), `playwright-report/`, `test-results/`.
- **Unit (Vitest)**: `src/lib/*` + `src/components/shop/format.ts` + `src/lib/useAuth.ts` → `test/unit/*.test.ts`.
- **Integration (Vitest, real test DB)**: server actions in `src/app/(shop)/account/actions.ts`, `(shop)/checkout/actions.ts`, `(shop)/customize/actions.ts`, `(main)/orders/actions.ts`, `(main)/web-orders/actions.ts`, `(main)/catalog/actions.ts`, `(main)/stocks/actions.ts` → `test/integration/*.test.ts`.
- **E2E storefront (Playwright)**: all `(shop)` pages → `test/e2e/shop/*.spec.ts`.
- **E2E admin (Playwright)**: all `(main)` + `(auth)` pages → `test/e2e/admin/*.spec.ts`.

---

## Phase 1: Test foundation & DB harness
### Changes
#### Tooling — `package.json`
Add devDeps `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `dotenv`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`; add scripts:
```jsonc
"typecheck": "tsc --noEmit",
"test:db:reset": "node test/db/reset.mjs",
"test:unit": "vitest run",
"test:e2e": "playwright test",
"test": "npm run test:unit && npm run test:e2e"
```
#### Config — `vitest.config.ts`, `playwright.config.ts`, `.env.test`
- `vitest.config.ts`: two projects — `unit` (environment `jsdom`) and `integration` (environment `node`, `globalSetup` that loads `.env.test` and runs the DB reset once). Path alias `@` → `src`.
- `playwright.config.ts`: `webServer` runs `next build && next start -p 3100` with env from `.env.test`; `baseURL` `http://localhost:3100`; `globalSetup` resets the DB; projects for chromium; trace on first retry.
- `.env.test`: `DB_NAME=essencefit_test`, same server/creds as `.env.local`, fixed `SESSION_SECRET=test-secret`.
#### DB harness — `test/db/reset.mjs` + `db/seed_test.sql`
- `reset.mjs`: connect to `master`, `DROP`/`CREATE DATABASE essencefit_test`, then apply `db/00..22_*.sql` in numeric order via the existing batch-split logic (reuse `apply.mjs` approach), then apply `db/seed_test.sql`.
- `db/seed_test.sql`: deterministic rows — one Admin `Users` row (known username/password hash), one staff user; one registered `Customers` row (known phone/email/password); categories; **three products**: a normal sized/coloured product with stock, a **select-by-image** product with designs+stock, and a **print-on-demand** product (0 stock); their variants/images.
#### Fixtures — `test/fixtures/`
- `auth.ts`: `mintCustomerCookie(customerId)` (HMAC with `SESSION_SECRET`, mirrors `customerAuth.ts:22`); Playwright fixtures `asCustomer` (sets cookie) and `asAdmin` (sets `localStorage.authUser` via `addInitScript`).
- `db.ts`: helper to open an mssql pool to the test DB + `uniquePhone()`/`uniqueEmail()` for per-test isolation.
#### Smoke — `test/unit/smoke.test.ts`, `test/e2e/smoke.spec.ts`
- Vitest: trivial assertion + a test that the test DB connects and the seed admin exists.
- Playwright: load `/` and assert the storefront renders.
### Success Criteria
#### Automated (the deterministic gate — must be green)
- [ ] Types: `npx tsc --noEmit`
- [ ] DB harness: `npm run test:db:reset` exits 0 and creates `essencefit_test`
- [ ] Unit smoke: `npm run test:unit`
- [ ] E2E smoke: `npm run test:e2e`
#### Manual (human verification)
- [ ] Reviewer confirms `essencefit_test` is created/seeded and dev DB is untouched
- [ ] `npx playwright install` documented; first `test:e2e` run launches the built app

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 2: Unit tests — pure logic
### Changes
#### `test/unit/*.test.ts`
- `format.test.ts` — `money`, `discountPct`, `sizeRank` (`src/components/shop/format.ts`).
- `dtfPricing.test.ts`, `dtfSettings.test.ts` — pricing math (`src/lib/dtfPricing.ts`, `src/lib/dtfSettings.ts`).
- `phoneMask.test.ts` — `formatPhone`, `cleanPhoneInput` (`src/lib/phoneMask.ts`).
- `slug.test.ts` — slug generation (`src/lib/slug.ts`).
- `colorHex.test.ts` — `resolveSwatch`, `cutLineColor` (`src/lib/colorHex.ts`).
- `customerAuth.token.test.ts` — `createToken`/verify round-trip + tamper/expiry rejection (`src/lib/customerAuth.ts:18-39`).
- `useAuth.canAccess.test.ts` — admin vs staff route gating incl. `ADMIN_ONLY_ROUTES` (`src/lib/useAuth.ts:43-47`).
### Success Criteria
#### Automated
- [ ] `npx tsc --noEmit`
- [ ] `npm run test:unit` (all unit specs green)
#### Manual (human verification)
- [ ] Reviewer spot-checks a couple of asserted values match real app behavior (e.g., `money(1890)` → `Rs. 1,890`)

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 3: Integration — customer accounts & auth
### Changes
#### `test/integration/account.test.ts` (against test DB)
Cover `src/app/(shop)/account/actions.ts`:
- `registerCustomer`: new account; **links to existing guest by phone** (`:37-52`); rejects duplicate email (`:29-33`); password length rule (`:24`).
- `loginCustomer`: success by email/phone; wrong password; non-existent (`:70-89`).
- `updateMyProfile`: updates name/phone/address; optional password change rule (`:207-228`).
- `getCurrentCustomer`: valid vs invalid/expired cookie (`src/lib/customerAuth.ts:49`).
> Note: actions that mutate cookies (`setSessionCookie`) require `next/headers` `cookies()`; tests invoke the underlying DB logic and use `mintCustomerCookie` for read paths. Document any action that can't be unit-invoked outside a request and defer it to E2E (Phase 6).
### Success Criteria
#### Automated
- [ ] `npx tsc --noEmit`
- [ ] `npm run test:unit` (integration project included) green
#### Manual (human verification)
- [ ] Reviewer confirms test isolation (re-running doesn't fail on duplicate seed data)

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 4: Integration — storefront ordering & DTF
### Changes
#### `test/integration/web-order.test.ts`
Cover `createWebOrder` (`src/app/(shop)/checkout/actions.ts:51-255`):
- price re-read from DB (ignores client price); subtotal/total math.
- stock decrement through `fn_StockVariantId`; **out-of-stock rejection** (`:91`).
- province delivery fee + free-delivery threshold (`:101-109`).
- guest checkout creates account + auto sign-in; logged-in checkout links to session customer.
- `Orders`(`Source='web'`,`Pending`) + `OrderItems` + `OrderStatusLogs` + `StockHistory` rows written.
#### `test/integration/my-orders.test.ts`
- `getMyOrders` matches by CustomerId/phone/email, returns thumbs, web-only filter; `getMyOrder` ownership (returns null for others') (`src/app/(shop)/account/actions.ts`).
#### `test/integration/dtf-order.test.ts`
- `createDtfOrder` inserts `DtfOrders`(`Pending`,`StockDeducted=0`) + `DtfOrderDesigns`, links customer, no stock change (`src/app/(shop)/customize/actions.ts:42-150`).
### Success Criteria
#### Automated
- [ ] `npx tsc --noEmit`
- [ ] `npm run test:unit` green
#### Manual (human verification)
- [ ] Reviewer confirms stock numbers before/after an order match expectations against the seed

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 5: Integration — admin orders, stock & catalog
### Changes
#### `test/integration/admin-orders.test.ts`
Cover `src/app/(main)/orders/actions.ts`:
- `createOrder` normal line; **design line** (select-by-image variant); **POD line bypasses stock** (`validateAndReduceStock` skip, `:267-318`).
- `updateOrder` restore+re-deduct; `updateOrderStatus` → `Sales` on Paid/Completed; **Canceled keeps stock** (documented invariant); `deleteOrder` restores stock.
- POD never deducts/restores across create/edit/cancel/delete.
#### `test/integration/web-orders-admin.test.ts`
- `verifyWebPayment` → status Paid + Sales; `setWebOrderStatus` transitions (`src/app/(main)/web-orders/actions.ts:29-49`).
#### `test/integration/catalog-stock.test.ts`
- catalog product/category create/update/delete; `saveDesigns` create/update/remove designs (`src/app/(main)/catalog/actions.ts`); stock CRUD + `deleteProduct`/`deleteCategory` (`src/app/(main)/stocks/actions.ts:29,186`).
### Success Criteria
#### Automated
- [ ] `npx tsc --noEmit`
- [ ] `npm run test:unit` green
#### Manual (human verification)
- [ ] Reviewer confirms a POD order saves with no stock movement, and a Paid order creates Sales rows

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 6: E2E — storefront journeys (Playwright)
### Changes
#### `test/e2e/shop/*.spec.ts`
- `browse.spec.ts` — home `/`, `/shop`, `/deals`, `/category/[slug]`, `/product/[slug]` (incl. design product picker), quick view, wishlist add.
- `account.spec.ts` — register (real form) → lands logged in; logout; login; `/account` + `/account/profile` edit.
- `checkout-cod.spec.ts` — add to cart → `/cart` → `/checkout` (COD) → `/order/[id]?placed=1` confirmation → `/account/orders` shows it with thumbnail → order detail page.
- `checkout-bank.spec.ts` — bank-transfer path with **slip upload** (tiny fixture image via `/api/upload`).
- `dtf.spec.ts` — `/customize` build a DTF order with design upload → submit → `/dtf-order/[id]` tracking.
### Success Criteria
#### Automated
- [ ] `npx tsc --noEmit`
- [ ] `npm run test:e2e` (shop project) green
#### Manual (human verification)
- [ ] Reviewer watches one trace (Playwright report) of the full COD purchase to confirm realism

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 7: E2E — admin core operations (Playwright)
### Changes
#### `test/e2e/admin/*.spec.ts`
- `auth-guard.spec.ts` — real `/login` form; unauthenticated `(main)` route → `/login`; staff user → admin-only route redirects to `/dashboard` (`useAuth`/layout).
- `orders.spec.ts` — create order: normal (size/colour cascade), **design** (Design dropdown), **POD** (adds at 0 stock); edit; change status; delete; WhatsApp invoice button present.
- `web-orders.spec.ts` — verify a bank-transfer payment → Paid; change status; POD badge.
- `catalog.spec.ts` — create/edit product incl. toggling Select-by-image + Print-on-demand + saving designs; image upload.
- `stocks.spec.ts` / `inventory.spec.ts` / `stock-history.spec.ts` — adjust stock, view history.
- `sales.spec.ts` / `returns.spec.ts` / `customers.spec.ts` / `dtf-orders.spec.ts` / `color-requests.spec.ts` / `dispatch.spec.ts` — list renders + primary action per page.
### Success Criteria
#### Automated
- [ ] `npx tsc --noEmit`
- [ ] `npm run test:e2e` (admin-core project) green
#### Manual (human verification)
- [ ] Reviewer confirms the design + POD admin order specs reflect the intended UX

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 8: E2E — admin finance/reporting/settings + docs
### Changes
#### `test/e2e/admin/*.spec.ts` (remaining pages)
- `finance.spec.ts`, `expenses.spec.ts`, `suppliers.spec.ts` (purchases), `reports.spec.ts`, `analysis.spec.ts`, `invoices.spec.ts`, `dashboard.spec.ts` — render + a representative interaction/filter each.
- `settings.spec.ts`, `store-settings.spec.ts`, `users.spec.ts` — load + save a setting / create a user.
- `misc.spec.ts` — `/map` renders (Google Maps stubbed/asserted at container level), `/whatsapp`, `/order-logs` render + filter.
#### Docs — `TESTING.md`
How to run: prerequisites (SQL Server, `npx playwright install`), `.env.test`, `npm run test:db:reset`, `test:unit`, `test:e2e`, where reports land, how to add a test.
#### `.gitignore`
Add `playwright-report/`, `test-results/`, `coverage/`, `public/uploads/` test artifacts.
### Success Criteria
#### Automated
- [ ] `npx tsc --noEmit`
- [ ] Full suite: `npm test` green
#### Manual (human verification)
- [ ] Reviewer runs the full suite once on a clean checkout following `TESTING.md`

**Pause here** for human manual-test confirmation; then `/validate`.

---

## Testing Strategy
- **This IS the test suite.** The "manual" criteria are the human's review of generated tests + watching a representative Playwright trace per E2E phase, not manual app testing.
- **Determinism**: each test creates its own data with `uniquePhone()`/`uniqueEmail()`; global DB reset+seed runs once per `test:*` invocation. Date-sensitive logic (delivery ETA) asserted as ranges or with a frozen clock in unit tests.
- **Seed/data needed**: `db/seed_test.sql` provides admin user, staff user, registered customer, and normal/design/POD products with stock — covering every priority flow.
- **External services**: `/api/upload` exercised with tiny fixtures (real disk write to `public/uploads`, gitignored); Google Maps not network-tested.
- **Known app realities encoded as tests** (not changed): admin auth is localStorage-only; Canceled regular orders keep stock; POD bypasses stock.

## References
- Research: `workflow/research/2026-06-21-automated-testing-coverage.md`
- Order/stock invariants to assert: `workflow/research/2026-06-21-order-and-stock-sync-audit.md`
- Patterns to follow: server actions `src/app/(shop)/checkout/actions.ts:51`, `src/app/(main)/orders/actions.ts:475`; auth `src/lib/customerAuth.ts:18`, `src/lib/useAuth.ts:24`; DB runner `db/apply.mjs:1-51`.
- Industry standard considered: Next.js officially supports **Vitest/Jest** (unit) and **Playwright/Cypress** (E2E); for the App Router with async server components, E2E (Playwright) is the recommended way to cover full flows while Vitest covers logic. This plan follows that standard (Playwright + Vitest) rather than inventing a bespoke harness. Sources: Next.js Testing docs (nextjs.org/docs/app/building-your-application/testing), Playwright docs (playwright.dev), Vitest docs (vitest.dev).
