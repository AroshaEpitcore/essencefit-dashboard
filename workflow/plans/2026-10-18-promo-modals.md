---
date: 2026-10-18
topic: "Promo popups — admin-configurable storefront modals"
research: workflow/research/2026-10-18-promo-modals.md
status: ready
---

# Plan: Promo Popups

A reusable, admin-built popup system for the storefront — the owner creates
campaigns that show new items / discounts / coupon codes / announcements, with
real-ecommerce controls (triggers, frequency capping, targeting, scheduling)
and a polished, animated, responsive design. Built the "better way" rather than
a single hardcoded 30s popup.

## Data model

### Table `popups` (campaign definition)
| column | type | meaning |
|---|---|---|
| id | uuid pk | |
| name | text | admin label (not shown to customers) |
| isactive | bool | master on/off |
| priority | int | higher wins when several are eligible (default 0) |
| layout | text | `center` \| `corner` \| `bar` |
| heading | text | |
| body | text | |
| imageurl | text | optional (uploaded via /api/upload) |
| ctatext | text | optional button label |
| ctalink | text | optional button href |
| couponcode | text | optional — rendered with copy button |
| accentcolor | text | hex, defaults to brand primary |
| trigger | text | `immediate` \| `delay` \| `scroll` \| `exit` |
| triggervalue | int | seconds (delay) or percent (scroll); default 30 |
| frequency | text | `always` \| `session` \| `daily` \| `once` |
| showon | text | `all` \| `home` \| `shop` \| `product` (page scope) |
| device | text | `all` \| `desktop` \| `mobile` |
| audience | text | `all` \| `new` \| `returning` (visitor) |
| startat | timestamp null | schedule start (null = now) |
| endat | timestamp null | schedule end (null = never) |
| createdat | timestamp default now() | |

### Table `popup_events` (analytics)
`id, popupid, event (impression|click|dismiss), visitorid text, createdat`.
Written via a rate-limited beacon; admin shows impressions / clicks / CTR.

## Components & files
- **DB**: `db/pg/schema.sql` (+ `db/pg/patches/2026-10-18-promo-popups.sql`) + live apply. `columnCase.ts` entries for new columns read via `.query()`.
- **Reader**: `getActivePopups()` in `src/lib/storefront.ts` — active + within [startat,endat], ordered by priority desc, createdat desc.
- **Storefront renderer**: `src/components/shop/PromoPopup.tsx` (`"use client"`), mounted in `src/app/(shop)/layout.tsx` next to `CookieConsent`/`PageView`, fed the active popups as a prop (server-fetched, no `cookies()` so ISR stays intact).
- **Event API**: `src/app/api/promo-event/route.ts` — rate-limited insert into `popup_events` (mirrors `/api/track`, but throttled).
- **Admin**: `src/app/(main)/promos/page.tsx` (list + toggle + stats) and `promos/actions.ts` (requireAdmin CRUD, `{ok,error}` pattern) and an editor with **live preview**. Add `/promos` to `proxy.ts` matcher + sidebar nav.

## Storefront behaviour (PromoPopup client logic)
1. Pick eligible popups: match `showon` (current path), `device`, `audience`
   (new = no `ef_seen` cookie/localStorage marker; returning = has it), and
   schedule (client re-check). Take highest `priority`.
2. Respect frequency cap via `localStorage` key `promo:<id>` storing last-shown
   timestamp + a `dismissed`/`converted` flag:
   - `once` → never again after first show; `daily` → once per 24h;
     `session` → once per tab session (sessionStorage); `always` → every load.
3. Arm the trigger: `immediate` (next tick), `delay` (setTimeout triggervalue s),
   `scroll` (Intersection/scroll ≥ triggervalue %), `exit` (mouseout to top /
   mobile back-ish). Fire **impression** + write localStorage stamp on show.
4. On CTA click → **click** event + navigate; on close/backdrop/Esc → **dismiss**.
5. Only one popup per page load; don't stack with the cookie banner.

## Design (polished)
- **center**: backdrop `bg-black/50 backdrop-blur-sm`, card `rounded-2xl
  shadow-2xl max-w-md`, optional top image, Orbitron heading / Rajdhani body,
  accent-colored CTA, coupon chip with copy-to-clipboard + "Copied!" state,
  close ✕. Entrance: fade + scale (`@keyframes`), respects
  `prefers-reduced-motion`. Mobile: bottom-sheet (rounded-t-2xl, slide-up).
- **corner**: small card bottom-right (toast-like). **bar**: slim top/bottom
  strip. Accessible: focus trap, `role="dialog"` `aria-modal`, Esc to close,
  returns focus on close.

## Phases (each independently verifiable)
1. **DB + reader** — create tables (schema + patch + live), columnCase, `getActivePopups()`. Verify: insert a test row, reader returns it.
2. **Storefront renderer + event API** — `PromoPopup` + mount + `/api/promo-event` (rate-limited). Verify (via /run): test popup shows after its delay; impression/click/dismiss rows land.
3. **Admin CRUD + nav** — `/promos` list + editor (live preview) + actions + proxy matcher + sidebar. Verify: create in admin → shows on storefront; stats increment.
4. **Polish & deploy** — design/animation pass, targeting/frequency edge cases, typecheck, build, commit, push.

## Out of scope (v1)
- Auto-applying coupon codes at checkout (coupons aren't a system yet — popup
  only *displays* the code). A/B testing. Multi-step popups.

## Risks / notes
- Keep the layout fetch free of `cookies()` (preserve home ISR). 
- Rate-limit the event endpoint (track has none today).
- Font pairing is Orbitron/Rajdhani — design against those.
