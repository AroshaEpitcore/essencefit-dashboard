---
date: 2026-06-21
topic: "DTF order customer tracking — link DTF customization orders to the storefront account so a logged-in customer can track them like regular web orders"
repo_commit: c15a1ff
status: complete
tags: [research, dtf, customer-account, orders, tracking, auth]
---

# Research: DTF Order Customer Tracking

> Single-repo **essencefit-dashboard** (Next.js 16 App Router + MSSQL). Sections adapted to this codebase.

## Research Question
When a customer places a DTF customization order, it currently goes into the admin DTF Orders module but the customer has no way to find/track it — there's no link to their storefront account and no customer-facing view. How does the existing customer auth + regular-web-order tracking work, what does the DTF flow capture today, and what are the exact gaps to connect DTF orders to a customer's account and a tracking view?

## Summary
- The storefront has a working **customer account system**: signed-cookie session (`ef_customer`) over the `Customers` table, with register/login/logout, an account hub (`/account`), an orders list (`/account/orders`), and a profile page. Reads are safe in server components via `getCurrentCustomer()`.
- **Regular web orders are linked to the account** through `Orders.CustomerId`. `createWebOrder` upserts the `Customers` row by phone and stores its id on the order; `getMyOrders()` returns `Orders WHERE CustomerId = <session customer>`; the account pages render that list, each linking to `/order/[id]` for tracking.
- **DTF orders are NOT linked to any account.** The `DtfOrders` table has **no `CustomerId` column** (only free-text `CustomerName/Phone/WhatsApp/Email/Address`). `createDtfOrder` does **not** read the session (`getCurrentCustomer`), does **not** upsert/attach a `Customers` row, and there is **no** customer-facing list or detail/tracking page for DTF orders. The post-submit confirmation is an in-page success state showing only the `Ref` — it's not retrievable later.
- Net effect: a customer who places a DTF request cannot see it after leaving the page, and logging in shows nothing DTF-related. This is the gap to close.

## Detailed Findings

### Customer auth / session (`src/lib/customerAuth.ts`)
- Cookie `ef_customer`, 30-day, HMAC-signed token carrying `{cid, exp}` (`customerAuth.ts:11,22,28`).
- `getCurrentCustomer()` verifies the cookie and loads the customer **only if `PasswordHash IS NOT NULL`** (i.e., a real account, not a guest) (`customerAuth.ts:49,60`).
- `setSessionCookie(customerId)` / `clearSessionCookie()` — mutate only in server actions/route handlers (`customerAuth.ts:65,76`).

### Account actions & pages (`src/app/(shop)/account/`)
- `registerCustomer` — links to an existing **guest** `Customers` row with the same phone (`PasswordHash IS NULL`) or creates a new one, then sets the session (`account/actions.ts:37-67`). So guests who later register inherit their prior customer id.
- `loginCustomer` — matches by email or phone where `PasswordHash IS NOT NULL` (`account/actions.ts:70-89`).
- `getMyOrders()` — **the model query**: `SELECT … FROM Orders o WHERE o.CustomerId=@Cid ORDER BY o.OrderDate DESC` with a line count (`account/actions.ts:100-115`). Returns only regular orders (no `Source` filter, but DTF orders aren't in `Orders` at all).
- `/account` hub (`account/page.tsx`): greets the customer, shows "My orders" / "Profile" cards + recent orders; redirects to login if not signed in (`account/page.tsx:20-22,36-47`).
- `/account/orders` (`account/orders/page.tsx`): full list, each row links to `/order/{Id}` (`account/orders/page.tsx:22,39`).
- `/order/[id]` (`order/[id]/page.tsx`): order tracking/confirmation view via `getOrderForConfirmation(id)` (which filters `Source='web'`) — shows items, totals, payment method, and a "Track in My Account" link (`order/[id]/page.tsx:13,78`).

### Regular web order ↔ customer linkage (`src/app/(shop)/checkout/actions.ts`)
- `createWebOrder` upserts `Customers` by phone (creating an account if a password is supplied), then writes `Orders.CustomerId` (`checkout/actions.ts:96-137,150`). This is what makes web orders show up under the account. Stock decremented at placement; status `Pending`.

### DTF order flow today (`src/app/(shop)/customize/` + `db/16_dtf_orders.sql`)
- `createDtfOrder` (`customize/actions.ts`): validates, re-reads garment price, computes the estimate, inserts `DtfOrders` (status `Pending`, `StockDeducted=0`) + `DtfOrderDesigns`, returns `{ id, ref }`. **No `getCurrentCustomer`, no `Customers` upsert, no customer id stored** (confirmed: 0 references to `customerAuth`/`CustomerId` in the file).
- `DtfOrders` schema (`db/16_dtf_orders.sql`): has `CustomerName, CustomerPhone, WhatsApp, Email, Address` but **no `CustomerId`** (confirmed: 0 occurrences). So there is no key to join a DTF order to a `Customers` account.
- Customer-facing surface: only the in-page success state in `CustomizeForm.tsx` (shows `Ref` + a WhatsApp link). There is **no** `/account` entry, **no** DTF list query, and **no** DTF tracking detail page. The admin side (`/dtf-orders`) is the only place a DTF order can currently be viewed.

### Cross-cutting connection points
- Account list contract: `getMyOrders()` (`account/actions.ts:100`) ⇄ `/account` + `/account/orders` render. A DTF equivalent (e.g. `getMyDtfOrders()`) would mirror this, keyed by the customer.
- Identity contract: `getCurrentCustomer()` (`customerAuth.ts:49`) is how any storefront server action/page knows who is logged in — `createDtfOrder` would call it to attach the customer; a DTF tracking page would use it to authorize access.
- Guest→account bridge: `registerCustomer` links guest `Customers` rows by phone (`account/actions.ts:37`). The same phone-based association is how a DTF order placed as a guest could later surface once the customer registers/logs in.

## Code References
- `src/lib/customerAuth.ts:49,65` — session read + set.
- `src/app/(shop)/account/actions.ts:100-115` — `getMyOrders` (model for a DTF version).
- `src/app/(shop)/account/page.tsx:36-47` — account hub cards + recent orders.
- `src/app/(shop)/account/orders/page.tsx:39` — order rows link to `/order/{id}`.
- `src/app/(shop)/order/[id]/page.tsx:13,78` — order tracking detail.
- `src/app/(shop)/checkout/actions.ts:96-150` — web order customer upsert + `CustomerId` write (the linkage to copy).
- `src/app/(shop)/customize/actions.ts` — `createDtfOrder` (no customer linkage today).
- `db/16_dtf_orders.sql` — `DtfOrders` (no `CustomerId`).
- `src/app/(main)/dtf-orders/actions.ts` — admin DTF reads/status (would gain customer-aware status the customer sees).

## Architecture / Conventions Observed
- Customer identity = `Customers` row with `PasswordHash NOT NULL`; guests are `Customers` rows with `PasswordHash NULL`, bridged by phone on register.
- Orders are tied to accounts by a `CustomerId` FK-style column populated at creation; account views query by the session customer id.
- Tracking pages are server components that load by id and (for account-scoped data) authorize via `getCurrentCustomer()`; not-found/redirect on miss.
- Additive idempotent SQL migrations (`db/NN_*.sql`) applied with a throwaway `mssql` node script.
- IDs are app-generated `crypto.randomUUID()`.

## Related Prior Work (from workflow/)
- `workflow/research/2026-06-20-dtf-printing-module.md` & `workflow/plans/2026-06-20-dtf-printing-module.md` — the DTF module this extends (explicitly deferred customer-account linkage; DTF used its own tables, request-first, no online payment).
- `workflow/research/2026-06-19-ecommerce-storefront-transformation.md` — the storefront/account/order system being mirrored.

## Open Questions (decide in Plan)
1. **Attach at creation vs match on login?** Attach a `CustomerId` when the DTF order is placed (read session if logged in; else upsert a `Customers` guest by phone like `createWebOrder`) — and/or also match existing DTF orders to a customer by phone/email at login/registration. Attaching at creation is the robust primary; phone-matching covers guest-then-register.
2. **Schema:** add `DtfOrders.CustomerId` (nullable) + index. Backfill existing DTF rows by phone match?
3. **Require login to place a DTF order, or keep guest allowed?** (Currently guest-allowed; web orders are guest-allowed too.) If guest, tracking only works after they register with the same phone.
4. **Customer-facing views:** a separate `/account/dtf-orders` list + `/account/dtf-orders/[id]` (or `/dtf-order/[id]`) tracking detail, vs. merging DTF into the existing "My orders" list with a type badge. Status labels shown to the customer (Pending/Confirmed/InProduction/Ready/Completed/Canceled).
5. **Confirmation page:** replace the in-page success state with a retrievable `/dtf-order/[id]` (or account link) so the ref is trackable immediately, mirroring `/order/[id]`'s "Track in My Account".
6. **Account hub:** add a "DTF / Custom orders" card + count alongside "My orders".

## Next
Saved to `workflow/research/2026-06-21-dtf-order-customer-tracking.md`. Recommend `/plan dtf-order-customer-tracking` to resolve the open questions and shape the implementation.
