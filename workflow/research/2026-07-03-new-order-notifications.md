---
date: 2026-07-03
topic: "Is there a free way to get email or mobile (SMS/push/WhatsApp) notifications when a new order comes in?"
repo_commit: 566591c
status: complete
tags: [research, notifications, orders, dtf, whatsapp, email]
---

# Research: New Order Notifications

> Single-repo **essencefit-dashboard** (Next.js 16 App Router, Postgres/Supabase via raw `pg`). Sections adapted to this codebase.

## Research Question
The owner has no way to know when a new order (web, admin, or DTF) comes in unless they manually open the dashboard. They want a **free** way to be alerted by email or to their mobile phone (SMS/push/WhatsApp) the moment a new order arrives.

## Summary
**Nothing today notifies anyone of anything outside the app.** There is exactly one notification surface — an in-app bell icon fed by `getNotifications()` — and it is a **pull-based read model**, not a push/alert system: it's called on page load/poll, queries the DB for four specific conditions (out-of-stock, low-stock, stale-pending-orders-over-24h, recent-returns), and returns a list to render. **A brand-new order is not one of its four categories** — placing an order does not appear in the bell at all, let alone reach email or a phone.

No outbound-communication capability exists anywhere in the codebase:
- **No email library** (no `nodemailer`, `resend`, `@sendgrid/mail`, etc.) and no email-related env vars (`SMTP_*`, `RESEND_API_KEY`, etc.) in `package.json`/`.env.local`.
- **No SMS/push library** (no `twilio`, `web-push`) and no service worker or VAPID keys for browser push.
- **The "Whatsapp" admin page is not a messaging integration.** It only queries stock availability and formats text for the owner to **manually copy-paste** into WhatsApp — it makes zero outbound HTTP calls (`src/app/(main)/whatsapp/actions.ts` is 100% read queries).
- **Supabase is used only as a Postgres host** (`DATABASE_URL` via raw `pg.Pool`) plus its Storage API for file uploads (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are referenced only in `src/app/api/upload/route.ts`). No Supabase Auth emails, Realtime, or Edge Functions are used, so there's no existing Supabase-side hook to piggyback on.
- **None of the three order-creation paths fire any notification.** `createWebOrder` (checkout), `createOrder` (admin), and `createDtfOrder` (customize) all insert rows and adjust stock, but none call out to anything external — confirmed by grepping all three for `notify`/`sendEmail`/`sendSms`/`webhook`/`push` (zero matches).

So today: the *only* way the owner learns of a new order is by opening `/orders`, `/web-orders`, or `/dtf-orders` and looking.

## Detailed Findings

### The one existing notification surface — in-app only, pull-based
- `src/lib/getNotifications.ts` — a single server action, `getNotifications()`, called by whatever renders the bell icon. Runs 4 independent queries each capped `LIMIT 10` (or 5):
  1. Out of stock (`ProductVariants.Qty = 0`) — `:18-37`
  2. Low stock (`Qty BETWEEN 1 AND 5`) — `:40-60`
  3. Stale pending orders (`Orders.PaymentStatus='Pending' AND OrderDate < now()-24h`) — `:63-83`
  4. Recent returns in the last 24h (`SalesReturns`) — `:86-105`
- The `NotificationItem["type"]` union is `"low_stock" | "out_of_stock" | "stale_pending" | "recent_return"` (`:6-11`) — **no `"new_order"` variant exists**. A freshly-placed order (still `Pending`, still under 24h old) produces **zero** notification items until it's already 24h overdue.
- This is polled/read on demand (no websocket, no `setInterval` push from the server) — the dashboard page does poll it client-side every 30s (`src/app/(main)/dashboard/page.tsx:105`, `setInterval(loadDashboard, 30000)`) but that only refreshes the in-app view while the owner already has the tab open.

### WhatsApp page — a stock-lookup text generator, not a send API
- `src/app/(main)/whatsapp/actions.ts` — two functions: `getProductCategories()` and `getSizesWithColors(categoryId)`, both plain `SELECT` queries against `Categories`/`ProductVariants`/`Products`/`Sizes`/`Colors`. Neither makes an HTTP request. No `fetch`/`axios` call anywhere in the file.
- `src/app/(main)/whatsapp/page.tsx` (not fully re-read here, but per the actions it consumes) builds a message the owner sends manually — consistent with the existing memory note that most real orders come in via WhatsApp and get hand-entered through the admin order form, not the storefront.
- The **DTF quote-builder** (`src/app/(main)/dtf/`) has its own `DtfTemplates` table of message text (`db/10_dtf_printing.sql`) for the same manual-copy-paste pattern — also not a send API.

### No email/SMS/push capability in the dependency tree or config
- `package.json` dependencies (full list): `@radix-ui/react-tooltip`, `@react-google-maps/api`, `bcryptjs`, `es-toolkit`, `framer-motion`, `html2pdf.js`, `lucide-react`, `next`, `node-fetch`, `pdf-lib`, `pg`, `react`, `react-dom`, `react-hot-toast`, `react-tooltip`, `recharts` — no mail/SMS/push SDK among them. `node-fetch` is a generic HTTP client that *could* call a third-party API but nothing currently does.
- `.env.local` keys present: `DATABASE_URL`, `DB_NAME`, `DB_PASSWORD`, `DB_SERVER`, `DB_USER`, `DIRECT_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` — no email/SMS provider key of any kind.
- No `public/sw.js` or any service worker; no `web-push` package; no VAPID key pair anywhere — so browser push notifications aren't wired up either (would need to be built from scratch).

### Order creation paths — none call out externally
- `src/app/(shop)/checkout/actions.ts` `createWebOrder` — inserts `Orders`+`OrderItems`, decrements stock, writes `OrderStatusLogs`. No external call.
- `src/app/(main)/orders/actions.ts` `createOrder` — same shape for admin-entered orders. No external call.
- `src/app/(shop)/customize/actions.ts` `createDtfOrder` — inserts `DtfOrders`(+`DtfOrderDesigns`). No external call.
- Confirmed via grep for `notify|sendEmail|sendSms|webhook|push` across all three files — zero matches.

## Code References
- `src/lib/getNotifications.ts:1-108` — the only notification surface; new orders aren't one of its categories.
- `src/app/(main)/dashboard/page.tsx:82-107` — client-side 30s poll of dashboard data (in-app only, requires the tab to be open).
- `src/app/(main)/whatsapp/actions.ts:1-63` — stock-lookup text generator, no send capability.
- `db/10_dtf_printing.sql` — `DtfTemplates` table, same manual-copy-paste pattern.
- `src/app/api/upload/route.ts` — the only place `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are used (Storage uploads).
- `src/app/(shop)/checkout/actions.ts`, `src/app/(main)/orders/actions.ts`, `src/app/(shop)/customize/actions.ts` — the three order-creation paths, none of which notify externally.
- `package.json:10-26` — full dependency list, no mail/SMS/push SDK.

## Architecture / Conventions Observed
- All "alerts" in this app today are **pull-based, in-app, and DB-query-driven** — there is no event/webhook/queue pattern anywhere for reacting to a row being inserted.
- The WhatsApp/DTF-template features establish a **manual-relay convention**: the app prepares text, a human sends it. There is no precedent in this codebase for the app itself sending anything.
- Supabase's role here is narrowly scoped to (a) Postgres hosting via a pooled connection string and (b) Storage for uploaded files — its broader platform features (Auth email, Realtime, Edge Functions, Database Webhooks) are unused and not wired into the app's connection setup, though they are available on a Supabase project without additional cost on typical free/low tiers and could reach the same database.

## Related Prior Work (from workflow/)
- None — no prior research or plan touches notifications, alerts, email, or SMS.

## Open Questions (for the Plan phase, not decided here)
1. **Channel choice**: email (e.g. a free-tier transactional email API like Resend/Brevo — both have free tiers), SMS (free tiers are rare and typically country-restricted; Sri Lankan SMS gateways often aren't free), a free push channel (browser Web Push — free, no third party, but requires the owner to keep a browser/PWA session granted), or reusing WhatsApp (WhatsApp Cloud API has a free tier of conversations/month but needs Meta Business verification) — each has different setup cost and reliability trade-offs the owner should choose between.
2. **Trigger point**: fire from `createWebOrder`/`createOrder`/`createDtfOrder` directly (real-time, simplest), or a periodic poll/cron comparing against `OrderStatusLogs`/`CreatedAt` (decouples the order path from the notification path, easier to retry on failure)?
3. **Which events count**: every new order regardless of channel (web/admin/DTF), or just unattended ones (e.g. skip admin-entered orders since the owner typed them in themselves)?
4. **Where credentials live**: a new provider means a new API key in `.env.local`/Vercel env vars — the owner needs to actually sign up for whichever free service is chosen before this can be implemented.

## Next
Saved to `workflow/research/2026-07-03-new-order-notifications.md`. Recommend `/plan new-order-notifications` once the owner has picked a channel (Open Question 1) — that choice determines almost everything else in the plan.
