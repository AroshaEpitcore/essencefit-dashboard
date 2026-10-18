---
date: 2026-10-18
topic: "Admin-configurable promo modals/popups for the storefront"
repo: essencefit-dashboard (Next.js 16 App Router, Postgres via sqlShim)
status: complete
tags: [research, storefront, admin, popups, promo, analytics]
---

# Research: Admin-configurable promo modals/popups

> Note: the `/research` skill is written for the Maraebiz 3-repo workspace. This
> project is the single Next.js repo `essencefit-dashboard`, so the template is
> adapted to one repo. Research done inline (the Maraebiz sub-agents are scoped
> to a different codebase).

## Research Question
How to add a feature where the shop owner creates/customizes reusable promo
**popups** from the admin panel — showing new items, discounts, coupon codes, or
announcements — with real-ecommerce behaviour (trigger rules like "after 30s",
targeting, frequency capping, scheduling, analytics) and a polished design.

## Summary
The codebase already has every pattern needed; nothing like this exists yet.
- **Storefront-wide client UI** is mounted once in `src/app/(shop)/layout.tsx`
  (`CookieConsent`, `PageView`). A popup renderer follows the exact same shape:
  a `"use client"` component gated by `localStorage`, dropped into that layout.
- **Admin CRUD over a dedicated table** is modelled by `store-gallery`
  (`GalleryItems` table + `src/app/(main)/store-gallery/actions.ts` with
  `requireAdmin()` + INSERT/UPDATE/DELETE). A `Popups` table + a
  `src/app/(main)/promos/` admin page/actions mirror this directly.
- **Public config reads** are done in `src/lib/storeSettings.ts`
  (`getPublicStoreSettings`) and `src/lib/storefront.ts` (active/published
  queries). A `getActivePopups()` reader belongs alongside these.
- **Beacon analytics** already exist: `PageView` → `POST /api/track` →
  `page_views` insert. Impression/click/conversion tracking for popups copies
  this pattern (and must be rate-limited — see Open Questions).
- **DB migrations**: add to `db/pg/schema.sql`, a dated file in
  `db/pg/patches/`, and apply the live `ALTER/CREATE`. `.query()` reads need
  lowercase→PascalCase entries in `src/lib/columnCase.ts`.

## Detailed Findings

### Storefront-wide client component mount point
- `src/app/(shop)/layout.tsx` composes the storefront: providers
  (`CartProvider`/`WishlistProvider`/`QuickViewProvider`), `StoreHeader`,
  `StoreFooter`, then **`<CookieConsent />`** and **`<PageView />`** as the last
  siblings. A `<PromoPopup settings={...}/>` (or self-fetching) goes here.
- The layout is `async` and already fetches via `Promise.all` incl.
  `getPublicStoreSettings()`. Comment at top warns **not** to call `cookies()`
  here (it forces every page dynamic and kills the home page ISR) — so popup
  config must be fetched without per-request cookies (a cacheable table read).

### Client-provider / gating pattern (model for the popup renderer)
- `src/components/shop/CookieConsent.tsx` — `"use client"`; `useEffect` reads
  `localStorage[STORAGE_KEY]`; renders a `fixed inset-x-0 bottom-0 z-[60]`
  overlay; writes choice to localStorage + a 1-year cookie; wrapped in try/catch
  for private mode. This is the exact template for "show once / frequency cap"
  and for the overlay/z-index/escape behaviour.
- `src/components/shop/PageView.tsx` + `POST /api/track`
  (`src/app/api/track/route.ts:98` inserts into `page_views`) — the beacon
  pattern to copy for popup impression/click tracking. (track has **no rate
  limit** today — a known gap, must add for the popup events endpoint.)

### Admin CRUD over a dedicated table (model to mirror)
- Table: `galleryitems` (`db/pg/schema.sql:379`), plus child tables
  `galleryimages:390`, `galleryitemproducts:402`.
- Actions: `src/app/(main)/store-gallery/actions.ts` — every exported function
  starts with `await requireAdmin()`; list (`getAdminGalleryItems:29`), fetch-
  for-edit (`:73`), upsert (`saveGalleryItem:112` → UPDATE `:130` / INSERT
  `:140`), delete (`deleteGalleryItem:173`). Uses `sql.UniqueIdentifier` inputs
  and PascalCase column names in the SQL.
- This is the blueprint for `Popups` CRUD: list / get-for-edit / save (insert or
  update) / delete / toggle-active, all `requireAdmin()`-gated server actions.

### Public config reads
- `src/lib/storeSettings.ts:147` `getPublicStoreSettings()` reads the generic
  `Settings` key/value table (`SELECT key, value FROM Settings`) and maps keys
  (`STORE_KEYS`) into a typed `StoreSettings` object (server-component safe).
- `src/lib/storefront.ts` holds the active/published storefront queries
  (`getActiveCategories`, `getFeaturedProducts`, `getCategoryPreviews`) used by
  the shop layout. A `getActivePopups()` (filter active + within schedule +
  ordered by priority, blank-aware if it references products) lives here.

### DB migration + column mapping conventions
- Schema source of truth for fresh installs: `db/pg/schema.sql` (`CREATE TABLE
  IF NOT EXISTS ...`). Idempotent patches for existing DBs:
  `db/pg/patches/<YYYY-MM-DD>-*.sql` (e.g. `2026-10-14-order-dtf-lines.sql`).
  Live changes are applied directly against `DIRECT_URL` (Supabase session
  pooler) — single statements only; **never** many-connection scripts (prod DB).
- `.query()` wraps results through `src/lib/columnCase.ts` (lowercase Postgres
  column → PascalCase the app expects). Any new column read via `.query()` needs
  an entry (e.g. recently added `"isdtf": "IsDtf"`). `queryRaw` bypasses the
  remap when aliases must stay lowercase (charts).
- Postgres is case-insensitive for unquoted identifiers, so INSERT/UPDATE can be
  written in PascalCase and still hit lowercase columns.

### Admin nav / page shell
- Admin pages live under `src/app/(main)/<feature>/page.tsx` with a sibling
  `actions.ts`. The `(main)` layout + `proxy.ts` matcher enforce admin auth
  (HMAC `ef_admin` cookie). A new `/promos` route must be added to the
  `proxy.ts` `config.matcher` list and to the sidebar nav.

### Error-handling + security conventions to follow
- Money/user-facing server actions return `{ ok, error }` (via
  `UserFacingError`) because prod strips thrown `Error` messages (see
  `src/lib/userError.ts`). Admin popup mutations should follow this.
- Public endpoints that write (the popup event/track endpoint) must be
  rate-limited (`consumeRateLimit`, used in checkout/login/account/reviews).

## Code References
- `src/app/(shop)/layout.tsx` — storefront composition + where to mount the popup; no-`cookies()` ISR caveat.
- `src/components/shop/CookieConsent.tsx` — localStorage-gated fixed overlay (frequency-cap template).
- `src/components/shop/PageView.tsx` + `src/app/api/track/route.ts:98` — beacon → DB insert analytics pattern.
- `src/app/(main)/store-gallery/actions.ts:29,73,112,173` — admin CRUD-over-table blueprint.
- `db/pg/schema.sql:379` (`galleryitems`) — table definition style.
- `db/pg/patches/2026-10-14-order-dtf-lines.sql` — idempotent patch style.
- `src/lib/storeSettings.ts:147` — public config reader.
- `src/lib/storefront.ts` — active/published storefront query home.
- `src/lib/columnCase.ts` — column case map for `.query()`.
- `src/proxy.ts:129` — matcher list to extend for `/promos`.
- `src/lib/userError.ts` — `{ ok, error }` pattern.

## Architecture / Conventions Observed
- One Next.js repo; admin `(main)` + storefront `(shop)` route groups; Postgres
  via a SQL-Server-shaped shim (`sql.UniqueIdentifier`, `.query()` + columnCase).
- Storefront-wide behaviour = a single `"use client"` component in the shop
  layout, gated by localStorage, overlaid with Tailwind + a high z-index.
- Config that the storefront reads = either the `Settings` K/V table (singletons)
  or a dedicated table with a public reader in `storefront.ts` (collections).
- Images are uploaded via `POST /api/upload` (Supabase bucket) and stored as CDN
  URLs on the row — the popup image field reuses this.

## Open Questions
- **Caching vs freshness**: popups should be fetchable without `cookies()` to
  preserve ISR; a short `revalidate` or tag-based revalidation on save keeps the
  list fresh without making pages dynamic.
- **Event endpoint abuse**: the popup impression/click endpoint needs rate
  limiting (track currently has none).
- **Coupon linkage**: coupon codes don't exist yet as a system — a popup can
  *display* a code now; auto-applying it at checkout is a separate feature.
- **Targeting scope for v1**: how much targeting (page rules, new-vs-returning,
  device) to ship first vs. later.
