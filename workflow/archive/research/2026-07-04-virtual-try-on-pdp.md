---
date: 2026-07-04
topic: "Virtual try-on on the PDP (like merakiclothings.com's 'Try It On'): what exists in this codebase today to support it, how the reference site implements it, and what external services provide the AI try-on generation"
repo_commit: 6a571b5
status: complete
tags: [research, pdp, virtual-try-on, ai, upload, supabase]
---

# Research: Virtual try-on for the PDP

## Research Question
The user wants a virtual try-on feature on the product detail page, modeled on https://merakiclothings.com/products/ribline-oversize-tee-obsidian — a "Try It On" button that opens a 2-step flow: (1) shows the product to try on, (2) customer uploads/takes a photo, then AI generates an image of them wearing the garment, with a Terms/Privacy consent line and an "AI can make mistakes" disclaimer. What exists in this codebase today that such a feature would build on, and how does the reference site actually do it?

## Summary
**Reference site**: merakiclothings.com is a Shopify store using the **GenLook** virtual try-on app (`virtual_try_on_genlook_button_VMhY6a` widget IDs are visible in its page source). GenLook is a closed Shopify App Store widget — it cannot be installed on this custom Next.js site. The UX the user described (product preview → photo upload → instant AI render → disclaimers) is GenLook's standard widget flow.

**This codebase**: a single Next.js App Router repo. The PDP is a server component (`src/app/(shop)/product/[slug]/page.tsx`) composing a client `ProductView` (two-column grid: gallery left, sticky buy box right). Every building block a try-on feature needs already exists in some form:
- **Customer image upload pipeline**: browser `FormData` → `POST /api/upload` (Route Handler) → Supabase Storage REST API → public CDN URL back to the client. Used today by the DTF customize flow, reviews, and feedback.
- **Modal/drawer pattern**: `QuickView.tsx` — a context-provider slide-in drawer mounted once in the shop layout, opened from anywhere via `useQuickView().open(id)`.
- **Product imagery**: per-color image URLs (Supabase CDN) resolved in `ProductView.activeImages` — the exact garment image a try-on API would need is already available client-side on the PDP.

**What does NOT exist**: any AI/ML integration (no AI packages in `package.json`), no image-processing library (`sharp` absent), and no server-side secret-key proxy pattern for third-party AI APIs (the only external APIs used server-side are Supabase Storage and Resend email). The try-on *generation* itself would be a new external dependency — the main developer-facing options are the FASHN API (~$0.075/image, cheaper at volume; purpose-built for garment try-on) and Google's Gemini image model / Vertex "Virtual Try-On" (~$0.039/image); open-source models (e.g. IDM-VTON) are hosted on Replicate.

## Detailed Findings

### PDP structure (where a "Try It On" button would live)
- Route: `src/app/(shop)/product/[slug]/page.tsx:35-199` — async server component, `dynamic = "force-dynamic"` (:18). Fetches product via `getProductBySlug` (`src/lib/storefront.ts:362-381`), plus variants, per-color images, reviews, related products in a `Promise.all` (:47-55).
- Two branches at `page.tsx:168-179`: `SelectByImage` products → `DesignPicker`; ordinary products → `ProductView`.
- `src/components/shop/ProductView.tsx` (client) is the composition root; owns `colorId` state (:44) and computes `activeImages` (:46-54) — color-specific image URLs → fallback chain to shared → `product.ImageUrl`. **This is the garment image a try-on API call would consume, already resolved client-side.**
- Desktop layout (:98-126): grid `md:grid-cols-2` — gallery left; right sticky column renders `header` slot → `AddToCart` → `footer` slot. Natural insertion points for a try-on button: (a) inside `AddToCart.tsx` near the buy buttons (:255-273 per prior research), (b) as a new slot/prop in the right column, or (c) below the gallery. (Documenting options only; placement is a Plan decision.)
- `StickyProductBar` (`ProductView.tsx:69-78`) mirrors buy actions in a mobile sticky bar via `actionsRef`.

### Existing customer image-upload pipeline (the key reusable piece)
- `src/app/api/upload/route.ts:28-98` — `POST` Route Handler, `runtime = "nodejs"`. Accepts multipart `file` + `folder`; folder whitelist `SAFE_FOLDERS` (:26) currently: designs, feedback, reviews, etc. — **no "tryon"-style folder exists yet**. Validates MIME + size (images ≤5MB :23). Uploads via raw `fetch` to `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}` with the service-role key (:76-89); returns `{ url, kind }` (:91-93). Comment at :3-5: serverless FS is read-only, so uploads must go to Supabase, never `public/uploads`.
- No `@supabase/supabase-js` SDK — storage is hand-rolled REST (`package.json` confirmed; also `db/pg/storage-migrate.mjs` uses the same env vars).
- Client-side usage pattern (DTF customize, `src/app/(shop)/customize/CustomizeForm.tsx`): hidden `<input type="file" accept="image/*,...">` in a styled label (:373-383); `onUpload` (:114-133) builds `FormData` with `file` + `folder`, `fetch("/api/upload")`, keeps only the returned URL in local state; thumbnails render from that URL (:356); no delete-from-storage on remove.
- Persistence pattern: `createDtfOrder` server action (`src/app/(shop)/customize/actions.ts:43-208`) stores only URL strings in SQL (`DtfOrderDesigns` rows, :153-164) — binaries live solely in Supabase Storage.

### Existing modal/drawer pattern (the try-on UI shell precedent)
- `src/components/shop/QuickView.tsx` — context + provider mounted once in `src/app/(shop)/layout.tsx:34`:
  - `useQuickView().open(productId)` (:13-20) from any client component.
  - Fixed overlay (:46) + fade backdrop `bg-black/50` (:48-51) + right-anchored `<aside>` drawer sliding via `translate-x` transition, `max-w-md` (:53-56).
  - Loads data mid-interaction via a server action (`src/app/(shop)/quickview-actions.ts` → `getQuickViewData`, called at :32).
  - Reuses `ProductView` in `stacked` mode as drawer content (:72-116).
- This is the established pattern for "button on PDP opens an overlay flow" — exactly the shape of the reference site's try-on modal.

### Client interactivity conventions
- Local `useState`/`useMemo` only; no global state lib. Cross-page state via React Context (`CartContext.tsx`, `WishlistContext.tsx`, wired in `(shop)/layout.tsx:32-51`).
- Toasts via `react-hot-toast` (`AddToCart.tsx:5,135-152`).
- Mid-interaction server data via Server Actions called from client components (Quick View precedent).

### External integrations present today (and absent)
- Present: Supabase Storage (upload route), Resend email (`src/lib/orderNotify.ts`, `RESEND_API_KEY`), WhatsApp deep links (`src/lib/wa.ts`), Google Maps (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`), Postgres via `pg` (`src/lib/db.ts`, `sqlShim.ts`), PDF gen (`html2pdf.js`, `pdf-lib`).
- Absent: **no AI/ML SDKs, no `sharp`/image processing, no queue/polling infrastructure** for long-running jobs. `package.json` deps: @radix-ui/react-tooltip, @react-google-maps/api, bcryptjs, es-toolkit, framer-motion, html2pdf.js, lucide-react, next, node-fetch, pdf-lib, pg, react, react-dom, react-hot-toast, react-tooltip, recharts.
- Only two API routes exist (`api/health`, `api/upload`); everything else is Server Actions. A try-on generation endpoint would be only the third Route Handler (or a new Server Action).

### Reference site implementation (merakiclothings.com)
- Platform: Shopify (footer attribution + Shopify CDN URLs).
- Try-on vendor: **GenLook** ([genlook.app](https://genlook.app/), [Shopify App Store listing](https://apps.shopify.com/genlook-virtual-try-on)) — widget element IDs `virtual_try_on_genlook_button_VMhY6a` and a `try-on-button` element with `widget_design_config` found in the raw page HTML.
- GenLook is Shopify-only (installed app, auto-injected button, no coding). Free tier: 100 base + 5/month generations; paid tiers beyond. It captures customer emails during try-on and provides analytics. **Not installable on this custom Next.js site.**
- The UX the user quoted ("Ready to try it on?", 2-step product-photo → your-photo, "Take a photo in a mirror" tip, Terms/Privacy consent, "AI can make mistakes") is GenLook's stock widget flow.

### AI try-on generation services (for a custom implementation)
As of July 2026, the developer-facing options:
- **[FASHN API](https://fashn.ai/products/api)** — purpose-built garment try-on API: model photo + garment photo (flat-lay, ghost mannequin, or on-model) → rendered try-on in ~5-17s. ~$0.075/image, dropping below $0.04 at volume; 576×864 native output, up-to-4K reframe tool. API-first, aimed exactly at custom-pipeline teams.
- **Google Gemini image model / Vertex AI Virtual Try-On** — since Dec 2025 works from a simple selfie (Gemini 2.5 Flash Image). Gemini API image output ≈ $0.039/image (1024×1024 = 1290 tokens @ $30/M). There are open-source Next.js + Gemini try-on examples (e.g. [gemini-ai-tryon on GitHub](https://github.com/oyeolamilekan/gemini-ai-tryon)).
- **Open-source models** (IDM-VTON etc.) hosted on Replicate — pay-per-run, slower cold starts.
All are server-side calls requiring a secret API key — i.e., a new Route Handler / Server Action proxy, matching the existing `/api/upload` proxy convention (secret key server-side, client gets back a URL/result).

## Code References
- `src/app/(shop)/product/[slug]/page.tsx:35-199` — PDP server component; branches to `ProductView`/`DesignPicker` at :168-179
- `src/components/shop/ProductView.tsx:44-54` — `colorId` state + `activeImages` (garment image URL resolution)
- `src/components/shop/ProductView.tsx:98-126` — two-column grid; sticky right buy column
- `src/components/shop/AddToCart.tsx:255-273` — buy buttons row (component ends there)
- `src/components/shop/QuickView.tsx:13-126` — drawer/overlay pattern (context, backdrop, slide-in, server-action data load)
- `src/app/(shop)/layout.tsx:32-51` — where shop-wide providers (Cart, Wishlist, QuickView) mount
- `src/app/api/upload/route.ts:23-98` — upload route: `SAFE_FOLDERS` whitelist (:26), validation (:23-25, 45-65), Supabase REST upload (:76-89), public URL response (:91-93)
- `src/app/(shop)/customize/CustomizeForm.tsx:114-133, 373-383` — client upload pattern (FormData → /api/upload → keep URL)
- `src/app/(shop)/customize/actions.ts:43-208` — server action persisting upload URLs to SQL rows
- `src/lib/storefront.ts:320-345, 347-381` — product/image data shapes (`StoreProductDetail`, `ProductImagesByColor`)

## Architecture / Conventions Observed
- Server pages build React-node "slots" (`header`/`footer`) and pass them into client composition components — SEO text stays server-rendered.
- Binary files never touch the DB or the serverless filesystem: browser → `/api/upload` → Supabase Storage; SQL stores URL strings only.
- Secrets stay server-side behind Route Handlers/Server Actions; client receives URLs/results (Supabase service key, Resend key follow this).
- Overlay UIs are context-provider drawers mounted once in the shop layout (QuickView), not per-page modals.
- Admin-configurable structured content goes in the `Settings` key/value table with typed JSON + `normaliseX()` fallback (per prior PDP research) — relevant if try-on needs per-product enable flags or store-wide config.
- CTA buttons are `rounded-lg`, not `rounded-full` (explicit user preference in MEMORY.md).

## Related Prior Work (from workflow/)
- `workflow/research/2026-07-03-pdp-description-placement-redesign.md` — full map of PDP composition (slots, grid, AddToCart internals); read fully and incorporated above.
- `workflow/research/2026-06-23-supabase-migration.md` + plan — how storage moved to Supabase (context for the upload route).
- `workflow/research/2026-07-04-feedback-screenshots.md` + plan — most recent reuse of the `/api/upload` folder-whitelist pattern.
- `workflow/research/2026-06-20-color-images-and-quick-view.md` — origin of the per-color image model and QuickView drawer.

## Open Questions
1. **Generation provider choice** (FASHN vs Gemini vs Replicate-hosted OSS) — cost/quality/latency trade-off; needs a Plan-phase decision, possibly a spike with one product image. All require a paid API key.
2. **Sync vs async UX**: generations take ~5-20s. Does a blocking spinner in the drawer suffice (reference site does this), or is job polling needed? No queue infra exists today.
3. **Customer photo retention**: uploads to Supabase are permanent today (no delete API). Try-on photos are sensitive personal images — does the store want auto-deletion/TTL, and does the Terms/Privacy page (referenced in the disclaimer copy) exist yet on this site?
4. **Scope**: all products or garment categories only? `SelectByImage`/DTF products have a different PDP branch (`DesignPicker`) — include or exclude?
5. **Abuse/cost control**: generations cost real money per click. Rate limiting / login gating (customer auth exists per `2026-06-23-customer-auth-and-navbar-refresh.md`) is a Plan-phase decision.
6. **Which garment image to send**: `activeImages[0]` for the selected color is available, but try-on APIs work best with flat-lay/on-model shots — is the first per-color image consistently suitable across the catalog?
