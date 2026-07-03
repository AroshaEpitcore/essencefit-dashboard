---
date: 2026-07-03
topic: "Border-radius usage across the whole website (design/admin dashboard + shop storefront)"
commit: 0f4b216
status: complete
tags: [research, design-system, tailwind, border-radius, ui]
---

# Research: Site-wide border-radius usage

## Research Question
Does the site currently have border-radius applied, where, and how consistently — as groundwork for applying a unified border-radius design language across the whole website.

## Summary
The site is a single Next.js 15 (App Router) + Tailwind app with two sections: the internal admin dashboard (`src/app/(main)/...`, ~30 pages) and the public storefront (`src/app/(shop)/...` + `src/components/shop/`). Border-radius is **not absent** — `rounded-*` utilities appear ~700 times across 59 files — but there is **no design-system layer and no radius tokens**: every page hand-writes its own Tailwind classes, and the same kind of element (stat card, button, badge, modal, input) gets a different radius value depending on which file it's in. `tailwind.config.js` extends colors, fonts, shadows and breakpoints but does not touch `borderRadius`, so every `rounded-*` class resolves to Tailwind's stock scale. There are no shared `Button`/`Card`/`Input`/`Modal` components — `src/components/ui/` only has `FullScreenLoader.tsx`, `FloatingCalculator.tsx`, and `NotificationCenter.tsx`. Layout shell elements (the `(main)` layout's `<main>` wrapper, `Sidebar`, `Topbar` root containers) and the storefront header/footer bars have **no rounded class at all** (deliberately edge-to-edge, screen-spanning chrome). No `<table>` elements are used anywhere; data grids are built from divs.

## Detailed Findings

### Design tokens
- `tailwind.config.js:1-49` — `theme.extend` customizes `colors`, `fontFamily`, `boxShadow.card`, and `screens`. **No `borderRadius` key exists**, so `rounded-*` classes fall back to Tailwind's default scale (`sm`=2px, DEFAULT=4px, `md`=6px, `lg`=8px, `xl`=12px, `2xl`=16px, `3xl`=24px, `full`=9999px).
- `src/app/globals.css:1-50` — no global radius reset, no CSS custom properties for radius, no `@layer components` primitives. Only font, marquee, and hero-animation rules.

### No shared component layer
- `src/components/ui/` contains only `FullScreenLoader.tsx`, `FloatingCalculator.tsx`, `NotificationCenter.tsx` — no `Button.tsx`, `Card.tsx`, `Input.tsx`, `Modal.tsx`, or `Badge.tsx`.
- Every page under `src/app/(main)/*/page.tsx` (e.g. `orders/page.tsx` at 2500+ lines, `stocks/page.tsx`, `catalog/page.tsx`, `dtf/page.tsx`) hand-writes its own buttons/cards/badges/modals inline with one-off `className` strings rather than importing a shared primitive. This means radius is set per call-site, not per component.

### Current rounded-* usage (admin dashboard, `src/app/(main)/...`)
Dominant pattern: `rounded-lg` for most cards, table-row-cards, panel sections, and buttons; `rounded-xl` for headline stat cards / larger panels / modals; `rounded-full` for avatars, status pills, and icon buttons; `rounded-2xl`/`rounded-3xl` used occasionally for large hero-style panels (e.g. `stocks/page.tsx:1313,1410,1479,1519`, `dispatch/page.tsx:102,342,387`).
- `src/app/(main)/orders/page.tsx` — ~90 occurrences, almost entirely `rounded-lg`, with `rounded-xl` for a few modal/summary panels (`:1217`, `:1679`, `:1928`, `:1937`, `:2180`, `:2550`) and `rounded-full` for avatars/status dots (`:148`, `:153`, `:1623`, `:1650`, `:2025`, `:2172`).
- `src/app/(main)/stocks/page.tsx` — ~65 occurrences, same `lg`/`xl`/`full` mix, plus `rounded-2xl` for a few larger cards (`:1313`, `:1410`, `:1479`, `:1519`).
- `src/app/(main)/dashboard/page.tsx:123,247,264,289,314,342,385,426,447,505,510` — stat cards are `rounded-xl`, one item is `rounded-lg` (`:510`), avatar is `rounded-full` (`:426`).
- `src/app/(main)/catalog/page.tsx`, `dtf/page.tsx`, `dtf-orders/page.tsx`, `whatsapp/page.tsx`, `color-requests/page.tsx`, `inventory/page.tsx`, `invoices/page.tsx`, `reports/page.tsx`, `sales/page.tsx`, `expenses/page.tsx`, `returns/page.tsx`, `suppliers/page.tsx`, `users/page.tsx`, `customers/page.tsx`, `settings/page.tsx`, `store-settings/page.tsx`, `map/page.tsx`, `stock-history/page.tsx`, `order-logs/page.tsx`, `web-orders/page.tsx`, `reviews/page.tsx`, `finance/page.tsx`, `analysis/page.tsx` — all follow the same `lg` (default)/`xl` (emphasis)/`full` (pill/avatar) convention, applied ad hoc per element rather than via a shared class.
- `src/components/layout/Sidebar.tsx:93` — one `rounded-md` on the active/hover nav-item highlight; the sidebar's own outer container has no radius (full-height edge panel).
- `src/components/layout/Topbar.tsx:59,91,109,117` — `rounded-md`/`rounded-full` on icon buttons and the account avatar; the topbar's outer bar itself has no radius (spans full width under the top edge).
- `src/components/ui/NotificationCenter.tsx:113-185` — dropdown panel mixes `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, and `rounded-full` all within one component.
- `src/components/ui/FloatingCalculator.tsx:167,206,245` — `rounded-xl`, `rounded-2xl`, `rounded-full` mixed within one component.
- `src/app/(main)/layout.tsx:70` — the floating "back to top" button is `rounded-full`; the `<main>` scroll container (`:64`) and root shell `<div>` (`:58`) carry no radius (intentional, full-bleed layout chrome).

### Auth pages
- `src/app/(auth)/login/page.tsx:95-197` and `src/app/(auth)/register/page.tsx:103-257` — heavy, consistent use of `rounded-full` (decorative background blobs) and `rounded-2xl`/`rounded-xl` (card panel, inputs, button) — these two pages are the most internally consistent in the codebase.

### Storefront (`src/app/(shop)/...`, `src/components/shop/`)
Dominant pattern: `rounded-full` for pills/avatars/social icons/nav dots (very common — `Hero.tsx`, `StoreHeader.tsx`, `ProductTags.tsx`, `CategorySlider.tsx`, `ProductSlider.tsx`, `AccountMenu.tsx`, `QuickView.tsx`), `rounded-lg`/`rounded-xl` for cards, product images and buttons, `rounded-2xl`/`rounded-3xl` for large feature panels (`ReviewsSection.tsx:66`, `ReviewCard.tsx:49`).
- **Sharp-corner outliers** (small/near-flat radius, standing out against the rest of the site): `WeeklyMvp.tsx:35`, `DesignPicker.tsx:161`, `ProductCard.tsx:130`, `AddToCart.tsx:187`, `StickyProductBar.tsx:90`, `CustomizeForm.tsx:265,296` all use `rounded-sm` (2px) — visually near-square next to neighboring `rounded-full`/`rounded-xl` elements.
- `src/components/shop/ProductGallery.tsx:61,73` — main image and thumbnails both `rounded-lg`.
- `src/components/shop/StoreHeader.tsx:246-569` — nav/search/menu mixes `rounded-full` (icon buttons, avatar) and `rounded-md` (search input, dropdown items); the header bar itself has no radius (full-width sticky bar).
- `src/components/shop/StoreFooter.tsx:15` — one `rounded-full` (social icon); footer bar itself unrounded (full-bleed).
- `src/app/(shop)/cart/page.tsx:26`, `wishlist/page.tsx:19,49`, `account/page.tsx:68`, `account/orders/page.tsx:64`, `order/[id]/page.tsx`, `dtf-order/[id]/page.tsx` — mostly `rounded-full` for avatars/icons; card containers vary between `rounded-lg` and unrounded plain `bg-white` blocks.
- `src/app/(shop)/not-found.tsx:10` — `rounded-full` icon badge.

### No `<table>` markup
- Grepped `orders/page.tsx` (largest data-heavy page) for `<table>`/`overflow-x-auto`/`overflow-hidden` — no matches. Data grids across the admin app are built from flex/grid `div` rows, not semantic tables, so there's no "table wrapper needs `overflow-hidden` to clip rounded corners" concern.

### Elements with no radius at all (full-bleed / edge chrome — likely intentional, not oversight)
- `(main)/layout.tsx:58,64` — root shell `<div>` and `<main>` scroll area.
- `Sidebar.tsx` and `Topbar.tsx` outer containers (only inner buttons/pills are rounded).
- `StoreHeader.tsx` and `StoreFooter.tsx` outer bars (only inner icons/pills/inputs are rounded).
- Several plain `bg-white`/`bg-black-500` card `<div>`s in shop pages that have no `rounded-*` class at all alongside sibling elements that do — inconsistent rather than deliberate (e.g. compare `AccountMenu.tsx:59` which is `rounded-lg` to nearby unrounded containers in the same file's card list).

## Code References
- `tailwind.config.js:1-49` — no `borderRadius` token extension.
- `src/app/globals.css:1-50` — no radius-related CSS.
- `src/app/(main)/layout.tsx:58,64,70` — shell has no radius except the floating action button.
- `src/components/layout/Sidebar.tsx:93` — only rounded element in the sidebar.
- `src/components/layout/Topbar.tsx:59,91,109,117` — icon buttons/avatar only.
- `src/components/ui/NotificationCenter.tsx:113,119,130,137,146,154,185` — five different radius values in one dropdown.
- `src/app/(main)/dashboard/page.tsx:123,247,264,289,314,342,385,426,447,505,510` — stat-card radius pattern for the admin home page.
- `src/app/(main)/orders/page.tsx` — largest single file, ~90 `rounded-*` occurrences, representative of the dominant `lg`/`xl`/`full` admin convention.
- `src/components/shop/ProductCard.tsx:92,130` — `rounded-full` (image) next to `rounded-sm` (tag/badge) in the same card.
- `src/app/(auth)/login/page.tsx:95-197`, `src/app/(auth)/register/page.tsx:103-257` — most internally consistent radius usage in the codebase (good reference pattern).

## Architecture / Conventions Observed
- No design tokens for radius; no shared UI component library — every `rounded-*` value is typed by hand at each call site.
- A loose, unwritten convention already exists in the admin section: `rounded-lg` default for cards/buttons/inputs, `rounded-xl` for emphasis/larger panels, `rounded-full` for avatars/pills/icon buttons. It's followed most of the time but not enforced anywhere, so exceptions (`rounded-md`, `rounded-2xl`, `rounded-sm`, or no radius) appear throughout.
- The storefront leans softer/rounder (`rounded-full`, `rounded-2xl`, `rounded-3xl`) than the admin dashboard, which leans more conservative (`rounded-lg`/`rounded-xl`).
- Full-bleed structural chrome (sidebar, topbar, store header/footer, page shell) is consistently left unrounded across both sections — this appears to be a deliberate, consistent pattern rather than an inconsistency.
- `rounded-sm` (2px) is the main outlier value — it appears only in storefront product/cart-adjacent components and reads as "sharp" next to the rest of the site's `lg`/`xl`/`full` values.

### Critical finding: an entire flow was built with radius deliberately stripped
A cluster of customer-facing pages centered on checkout/account uses the literal pattern `"bg-white border border-gray-XXX  p-N"` — **two spaces** where a `rounded-*` class was evidently removed. This is a distinct, consistent pattern (not scattered oversight) covering:
- `src/app/(shop)/cart/page.tsx:41,72`
- `src/app/(shop)/checkout/page.tsx:24,132,166,186,231`
- `src/app/(shop)/customize/CustomizeForm.tsx:325,348,388,395,400,403-407,434,476`
- `src/app/(shop)/account/page.tsx:40,45,54,58`
- `src/app/(shop)/account/login/page.tsx:9`
- `src/app/(shop)/account/register/page.tsx:9`
- `src/app/(shop)/account/orders/page.tsx:35,42`
- `src/app/(shop)/account/profile/ProfileForm.tsx:9`
- `src/app/(shop)/order/[id]/page.tsx:109,152,163,192` and `src/app/(shop)/dtf-order/[id]/page.tsx:70,95` (no double-space, but same unrounded `bg-white border` card style)

This is almost certainly what "the site has no border radius" refers to: the entire cart → checkout → account → order-confirmation → DTF-customize journey is completely square-cornered, while the rest of the site (product browsing, admin dashboard) does use radius.

## Related Prior Work (from workflow/)
- `workflow/plans/2026-06-19-ecommerce-storefront-transformation.md` — the only prior workflow doc that mentions radius/rounded, in the context of the original storefront build-out (not a dedicated radius audit).
- No prior research or plan doc specifically addresses a site-wide radius/design-token pass.

## Open Questions
- Should the admin dashboard and storefront share one radius scale, or intentionally keep the storefront rounder/softer than the dashboard (as they currently trend)?
- Should full-bleed chrome (sidebar/topbar/header/footer bars) gain radius (e.g. on inner edges) or stay edge-to-edge as today?
- Is a shared `Button`/`Card`/`Input`/`Badge` component layer in scope, or should the fix stay a mechanical `className` sweep across existing hand-written markup?
