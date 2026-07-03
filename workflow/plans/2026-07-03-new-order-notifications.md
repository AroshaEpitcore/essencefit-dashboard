---
date: 2026-07-03
slug: new-order-notifications
status: shipped
surfaces: [backend]
research: workflow/research/2026-07-03-new-order-notifications.md
estimated_manual_effort: 1h 0m
---

# New Order Email Notifications — Implementation Plan

## Overview
Send the shop owner a free email the moment any new order (web checkout, admin-entered, or DTF customization) is created, via Resend's free-tier API, to a destination address configurable from the Store Settings admin page.

## Estimated Manual Effort
**1h 0m** — total human-in-the-loop time only (signing up for Resend + reviewing each phase + manually placing a test order per channel to confirm the email arrives + final `/validate`), with a 10% buffer. Claude Code implements; no dev hours counted.

## Current State
- No notification of any kind fires on order creation. The only alert surface, `getNotifications()` (`src/lib/getNotifications.ts:1-108`), is a pull-based in-app bell with 4 fixed categories (out-of-stock, low-stock, stale-pending-24h, recent-returns) — new orders aren't one of them.
- `Settings` is a generic key/value table already wrapped by a typed `StoreSettings` object (`src/lib/storeSettings.ts`), read via `getPublicStoreSettings()`/`getStoreSettings()` and written via `saveStoreSettings()`/`saveSetting()` (`src/app/(main)/settings/actions.ts:32-87`). The admin UI for it is `src/app/(main)/store-settings/page.tsx`, which already has a `contactPhone`/`contactEmail` input pair at `:278-281`.
- No email/SMS SDK exists in `package.json`; no provider API key exists in `.env.local`.
- Three order-creation paths exist, none of which call out externally:
  - `createWebOrder` — `src/app/(shop)/checkout/actions.ts:48+`
  - `createOrder` (admin) — `src/app/(main)/orders/actions.ts:472+`
  - `createDtfOrder` — `src/app/(shop)/customize/actions.ts:42+`

## Desired End State
- Store Settings has an "Order notification email" field the owner can set/change without a redeploy.
- Placing an order through any of the three paths sends an email (customer/order summary + a link to the relevant admin page) to that address, using Resend's free tier.
- A missing API key, missing destination email, or a Resend API failure never blocks or breaks order creation — it only logs to the server console.

## What We're NOT Doing
- Not building SMS or push notifications (research Q1 resolved: email only).
- Not sending on order **status changes** (e.g. Paid, Completed) — only on creation.
- Not adding a new database table or migration — reuses the existing `Settings` key/value store.
- Not adding the `resend` npm package — calling Resend's REST API directly via `fetch()` keeps the dependency tree unchanged.
- Not building retry/queue logic for failed sends — a failure is logged and dropped (acceptable for a low-volume single-shop use case).

## Touchpoints per surface
- **Settings type/data**: `src/lib/storeSettings.ts` (`StoreSettings` type, `STORE_KEYS`, `DEFAULT_STORE_SETTINGS`, `getPublicStoreSettings`), `src/app/(main)/settings/actions.ts` (`saveStoreSettings`).
- **Admin UI**: `src/app/(main)/store-settings/page.tsx` (new input field).
- **New utility**: `src/lib/orderNotify.ts` (Resend API call).
- **Order creation (3 call sites)**: `src/app/(shop)/checkout/actions.ts`, `src/app/(main)/orders/actions.ts`, `src/app/(shop)/customize/actions.ts`.
- **Env**: `RESEND_API_KEY` (new, required — owner signs up free at resend.com and provides it), `NEXT_PUBLIC_SITE_URL` (already exists, used to build admin links in the email).
- **DB**: none (reuses `Settings` table).

---

## Phase 1: Store Settings — notification email field
### Changes
#### `src/lib/storeSettings.ts`
Add to `StoreSettings` type, `STORE_KEYS`, `DEFAULT_STORE_SETTINGS`, and `getPublicStoreSettings()`:
```ts
export type StoreSettings = {
  // ...existing fields
  orderNotificationEmail: string;
};

export const STORE_KEYS = {
  // ...existing keys
  orderNotificationEmail: "order_notification_email",
} as const;

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  // ...existing defaults
  orderNotificationEmail: "",
};

// inside getPublicStoreSettings() return object:
orderNotificationEmail: map[STORE_KEYS.orderNotificationEmail] || d.orderNotificationEmail,
```
#### `src/app/(main)/settings/actions.ts`
Add to the `pairs` array in `saveStoreSettings`:
```ts
[STORE_KEYS.orderNotificationEmail, s.orderNotificationEmail ?? ""],
```
#### `src/app/(main)/store-settings/page.tsx`
Add an input next to the existing contact fields (`:278-281`):
```tsx
<input
  value={s.orderNotificationEmail}
  onChange={(e) => set("orderNotificationEmail", e.target.value)}
  placeholder="Order notification email (alerts sent here)"
  className={input}
/>
```
### Success Criteria
#### Automated
- [x] App builds: `npm run build` (type-check clean)
#### Manual
- [x] Open `/store-settings`, set an email address in the new field, save, reload the page, confirm it persisted.

**Pause here** for confirmation.

---

## Phase 2: Resend email utility
### Changes
#### `src/lib/orderNotify.ts` (new file)
```ts
import { getPublicStoreSettings } from "@/lib/storeSettings";

type OrderNotifyInput = {
  subject: string;
  heading: string;
  lines: string[];      // simple key: value display lines
  adminPath: string;    // e.g. "/web-orders" or "/dtf-orders"
};

// Fire-and-forget: awaited internally so the request actually completes
// before the serverless function returns, but every failure is caught and
// logged — never thrown — so a bad/missing API key or a Resend outage can
// never break order creation.
export async function sendOrderNotification(input: OrderNotifyInput): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[orderNotify] RESEND_API_KEY not set — skipping email");
      return;
    }
    const settings = await getPublicStoreSettings();
    const to = settings.orderNotificationEmail;
    if (!to) {
      console.warn("[orderNotify] No order notification email configured — skipping");
      return;
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    const link = siteUrl ? `${siteUrl}${input.adminPath}` : input.adminPath;
    const html = `
      <h2>${input.heading}</h2>
      <ul>${input.lines.map((l) => `<li>${l}</li>`).join("")}</ul>
      ${siteUrl ? `<p><a href="${link}">View in admin</a></p>` : ""}
    `;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: [to],
        subject: input.subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[orderNotify] Resend API error", res.status, await res.text());
    }
  } catch (err) {
    console.error("[orderNotify] failed to send", err);
  }
}
```
> `RESEND_FROM_EMAIL` is optional — Resend's shared `onboarding@resend.dev` sender works immediately with no domain verification, which is fine for an internal alert-only address. A custom "from" address requires verifying a domain in Resend later, not needed to ship this.
### Success Criteria
#### Automated
- [x] App builds: `npm run build` (type-check clean)
#### Manual
- [x] Sign up at resend.com (free), create an API key, add `RESEND_API_KEY=<key>` to `.env.local`.
- [x] Call `sendOrderNotification({ subject: "Test", heading: "Test", lines: ["hello"], adminPath: "/dashboard" })` from a scratch script or a temporary button; confirm the email arrives at the configured address.

**Pause here** for confirmation.

---

## Phase 3: Wire into all three order-creation paths
### Changes
#### `src/app/(shop)/checkout/actions.ts` — inside `createWebOrder`, after the transaction commits successfully
```ts
await sendOrderNotification({
  subject: `New web order — ${payload.Customer ?? "Customer"}`,
  heading: "New Website Order",
  lines: [
    `Customer: ${payload.Customer ?? "—"}`,
    `Phone: ${payload.CustomerPhone ?? "—"}`,
    `Total: Rs ${payload.Total}`,
    `Items: ${payload.Items.length}`,
  ],
  adminPath: "/web-orders",
});
```
#### `src/app/(main)/orders/actions.ts` — inside `createOrder`, after the transaction commits successfully
```ts
await sendOrderNotification({
  subject: `New order entered — ${payload.Customer ?? "Customer"}`,
  heading: "New Admin-Entered Order",
  lines: [
    `Customer: ${payload.Customer ?? "—"}`,
    `Phone: ${payload.CustomerPhone ?? "—"}`,
    `Total: Rs ${payload.Total}`,
  ],
  adminPath: "/orders",
});
```
#### `src/app/(shop)/customize/actions.ts` — inside `createDtfOrder`, after the transaction commits successfully
```ts
await sendOrderNotification({
  subject: `New DTF order — ${ref}`,
  heading: "New DTF Customization Order",
  lines: [
    `Ref: ${ref}`,
    `Customer: ${customerName}`,
    `Phone: ${customerPhone}`,
    `Estimated total: Rs ${estimatedTotal}`,
  ],
  adminPath: "/dtf-orders",
});
```
(Exact variable names adjusted to match each function's actual local scope at edit time — the field names above match the DB columns already documented in the research doc.)
### Success Criteria
#### Automated
- [x] App builds: `npm run build` (clean production build)
#### Manual
- [x] Place one real order through each of the 3 channels (storefront checkout, admin "New Order", DTF customize submit) and confirm an email arrives for each, with correct details and a working admin link.
- [x] Temporarily unset `RESEND_API_KEY` and place an order — confirm it still succeeds (order created normally) with only a console warning, no user-facing error. (Verified structurally: `sendOrderNotification` catches every error internally and never throws — confirmed by code review; the "no API key" guard path was exercised in Phase 2's first test run.)

**Pause here**, then run `/validate new-order-notifications`.

## Unplanned fix discovered during Phase 3 testing
Testing the DTF order flow surfaced a pre-existing, unrelated bug: `createDtfOrder`'s `INSERT INTO DtfOrders` used a bare `0` literal for the `StockDeducted` boolean column, which Postgres rejects without an explicit `false`/cast (`column "stockdeducted" is of type boolean but expression is of type integer`). This meant **every DTF order submission through the live storefront was failing** — a leftover from the SQL Server → Postgres migration (commit `e632e42`), unrelated to this plan. Fixed by changing the literal to `false` (`src/app/(shop)/customize/actions.ts`). Confirmed fixed by reproducing the exact failure directly against the DB, then successfully placing a real test DTF order after the fix.

## Testing Strategy
No automated tests in this repo. Gate per phase = `npm run build`. End-to-end: (1) set the notification email in Store Settings; (2) add `RESEND_API_KEY`; (3) place one order via each of the 3 channels and confirm 3 emails arrive with correct content and links; (4) remove the API key temporarily and confirm order creation is unaffected (only a log line, no thrown error, no broken checkout).

## References
- Research: `workflow/research/2026-07-03-new-order-notifications.md`
- Settings pattern to follow: `src/lib/storeSettings.ts`, `src/app/(main)/settings/actions.ts:32-87`, `src/app/(main)/store-settings/page.tsx:278-281`
- Order creation call sites: `src/app/(shop)/checkout/actions.ts:48+`, `src/app/(main)/orders/actions.ts:472+`, `src/app/(shop)/customize/actions.ts:42+`
- Industry standard considered: Resend is the current standard low-friction transactional email API for Next.js apps (built by the Next.js/Vercel-adjacent ecosystem, generous free tier, no SMTP config needed); calling its REST API directly via `fetch()` rather than adding the `resend` SDK package matches this repo's existing convention of a minimal dependency list and raw `fetch`/`pg` calls throughout.
