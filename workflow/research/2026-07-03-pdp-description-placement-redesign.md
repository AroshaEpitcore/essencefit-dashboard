---
date: 2026-07-03
topic: "PDP description section: current placement and design, vs. moving it to the right column under the buy buttons with a new visual design (heading + bold body + bullet list + 2x2 icon/trust-badge grid)"
repo_commit: 7fa6801
status: complete
tags: [research, pdp, product-page, description, storefront]
---

# Research: PDP description section — placement and design

## Research Question
Where does the product description currently render on the PDP, how is the page's two-column layout built, and what data is available (or missing) to support: (1) moving the description into the right-hand buy-box column, under the Add to cart/Buy now buttons, and (2) restyling it to match a reference screenshot — uppercase "DESCRIPTION" heading, bold uppercase body paragraph, a bulleted feature list, and a 2x2 grid of icon + text trust badges (shipping, secure payment, returns, made-in-X)?

## Summary
The PDP is a single Next.js repo (no multi-repo split). The page is composed as `src/app/(shop)/product/[slug]/page.tsx` (server component) which builds two React-node "slots" — `headerSlot` (tags/title/rating/price/size-chart link) and `footerSlot` (just the description, wrapped in a bordered block) — and hands them to the client component `ProductView.tsx`, which lays out a CSS grid: gallery in column 1/row 1, buy box (`header` + `AddToCart`) in column 2/row 1 (sticky), and `footer` (the description) in column 1/row 2 — i.e. **directly under the gallery, in the left column, not in the right column at all**. There is also a `stacked` mode used by `DesignPicker.tsx` where gallery → header → AddToCart → footer all stack vertically in one column.

`product.Description` is a single free-text `string | null` column (Postgres `Products.Description`), rendered as one `whitespace-pre-line` paragraph — there is no bullet-list field, no icon/trust-badge data, and no admin UI for shipping/returns/warranty copy anywhere in the storefront or the generic `Settings` key/value store. The bulleted list and the 2x2 icon grid in the reference screenshot have no backing data source today; they would need either free-text parsing (e.g. splitting `Description` on newlines into bullets) or new structured fields/settings.

## Detailed Findings

### Page composition — `src/app/(shop)/product/[slug]/page.tsx`
- `headerSlot` (`page.tsx:66-95`): `ProductTags`, category label, `<h1>` title, rating stars/link, server-rendered price block, and (if set) `SizeChartButton`.
- `footerSlot` (`page.tsx:96-101`): the **only** thing in it is the description block:
  ```tsx
  const footerSlot = product.Description ? (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <h2 className="font-semibold text-gray-900 mb-2">Description</h2>
      <p className="text-gray-600 whitespace-pre-line leading-relaxed">{product.Description}</p>
    </div>
  ) : null;
  ```
  Plain sentence-case "Description" heading (`font-semibold`, no letter-spacing/uppercase), body text is normal-case `text-gray-600`, no bullet list, no icon grid.
- Both slots are passed into either `DesignPicker` (`page.tsx:136`, for `product.SelectByImage` products — a "choose a printed design" flow) or `ProductView` (`page.tsx:138-145`, the normal color/size flow) as `header`/`footer` props.
- Below both, the page independently renders `ReviewsSection` (`page.tsx:148-152`) and a "You may also like" `ProductCard` grid (`page.tsx:154-161`) — these are outside the header/footer slot system entirely.

### Two-column grid — `src/components/shop/ProductView.tsx`
- Owns `colorId` state so gallery and picker stay in sync; computes `activeImages` from the selected color.
- Non-stacked (default) layout (`ProductView.tsx:98-122`):
  ```tsx
  <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
    <div className="md:col-start-1 md:row-start-1"><ProductGallery .../></div>
    <div className="md:col-start-2 md:row-start-1 md:sticky self-start" style={{ top: "calc(var(--header-h, 132px) + 1.5rem)" }}>
      {header}
      <AddToCart .../>
    </div>
    {footer && <div className="md:col-start-1 md:row-start-2">{footer}</div>}
  </div>
  ```
  So today: **gallery (col 1, row 1) → buy box (col 2, row 1, sticky) → description (col 1, row 2, i.e. under the gallery, left column)**. On mobile (`grid` collapses to 1 column) the DOM order is gallery → buy box (header+AddToCart) → description, so mobile already shows description after the buttons; only the desktop `md:` breakpoint routes it to the left column.
- `stacked` mode (`ProductView.tsx:81-96`, used by `DesignPicker.tsx:136`): gallery → `header` → `AddToCart` → `footer`, all in one vertical flow (no grid) — footer already ends up right after AddToCart here, but this path is only for `SelectByImage` (custom-design) products.

### Buy box contents — `src/components/shop/AddToCart.tsx`
Order of rendered content, all inside a single `<div>` returned by the component (`AddToCart.tsx:159-273`):
1. `variantPriceDiffers` selected-option price line (163-167)
2. COLOUR swatches — `w-11 h-11 rounded-sm` square color-fill buttons (169-205)
3. SIZE buttons — `rounded-full` pill buttons (207-233)
4. Stock/availability line (235-244)
5. Qty stepper — `rounded-full` bordered counter (246-253)
6. Add to cart / Buy now buttons — `flex-1 rounded-lg` (255-270; per `MEMORY.md` "Button radius preference", these were deliberately toned down from `rounded-full` to `rounded-lg`)

There is currently **nothing rendered after the Add to cart/Buy now buttons** inside `AddToCart.tsx` — the component ends right after that button row. This is the insertion point implied by "description ... under buttons."

### Gallery — `src/components/shop/ProductGallery.tsx`
Already redesigned (per recent work) to a large main image (`aspect-square`, `rounded-lg`) with a thumbnail strip — vertical on desktop (`sm:flex-col sm:w-20`), horizontal scroll row on mobile (`flex`) — plus a full-screen lightbox. Not otherwise relevant to the description-placement task except that it currently occupies the entire left column, so if the description moves out of column 1 entirely, column 1 (row 2) becomes empty/unused in the default (non-stacked) `ProductView` layout.

### Data model — `product.Description`
- Type: `Description: string | null` (`src/lib/storefront.ts:35` and `:320`).
- Fetched via `getProductBySlug` (`storefront.ts:366-379`), selected as a plain column (`storefront.ts:366`), also searchable via `ILIKE` in `getSearchResults`-style queries (`storefront.ts:259`).
- No JSON/structured variant of this field anywhere — it is stored and read as one opaque string. Any bullet points visible in the current UI come from the merchant manually typing newline-separated lines into one textarea (rendered with `whitespace-pre-line`), not from a distinct "features" list.
- No product-level or store-level field for "material composition," "shipping estimate," "secure payment," "returns window," or "made in ___" exists in `storefront.ts`, `storeSettings.ts`, or any admin action file searched.

### Store-wide settings — `src/lib/storeSettings.ts`
- Generic Key/Value `Settings` table wrapper (`storeSettings.ts:138-161`), typed via `StoreSettings` (`storeSettings.ts:46-61`) with keys like `storeName`, `announcement`, `heroSlides`, `bank`, `deliveryFee`, `contactPhone/Email`, `social`. Writes happen in `src/app/(main)/settings/actions.ts` (`saveStoreSettings`, referenced in a comment at `storeSettings.ts:4-5`).
- No existing key for shipping-estimate/secure-payment/returns/made-in copy. The `heroSlides`-style pattern (a typed JSON array stored under one settings key, with a `normaliseX()` fallback function) is the established convention this repo uses whenever admin-editable structured content is needed (see `normaliseSlides`, `storeSettings.ts:100-118`, and `normaliseProvinces`, `storeSettings.ts:121-127`) — this would be the natural model to copy if the 2x2 trust-badge grid becomes admin-configurable rather than hardcoded.

### Reference screenshot content (`Screenshot 2026-07-03 221007.png`)
- "DESCRIPTION" heading: uppercase, larger/thin-weight, letter-spaced.
- Body paragraph: bold, all-caps, multi-line marketing copy.
- Bulleted list: bold, all-caps items (e.g. "70% COTTON 30% SPANDEX", "CONTRAST SIDE PIPING", "RELAXED FIT FOR EASY MOVEMENT", "MINIMALIST DESIGN THAT CAN PAIR WITH ANYTHING").
- Below that, a 2-column x 2-row grid, each cell = icon above bold text: truck icon / "Standard shipping (Estimated 3-5 days)"; shield-person icon / "Payment is 100% secure"; undo-arrow icon / "30 days to change your mind!"; leaf/plant icon / "Made in Sri Lanka".

## Code References
- `src/app/(shop)/product/[slug]/page.tsx:66-101` — `headerSlot`/`footerSlot` construction; description is the entire `footerSlot`.
- `src/app/(shop)/product/[slug]/page.tsx:135-146` — routes header/footer into `DesignPicker` (stacked) or `ProductView` (grid) depending on `product.SelectByImage`.
- `src/components/shop/ProductView.tsx:81-96` — `stacked` layout (gallery → header → AddToCart → footer).
- `src/components/shop/ProductView.tsx:98-122` — default grid layout; footer pinned to `md:col-start-1 md:row-start-2` (left column, under gallery).
- `src/components/shop/AddToCart.tsx:159-273` — full buy-box content; buttons end at line 270, nothing rendered after.
- `src/components/shop/ProductGallery.tsx:1-134` — current gallery (main image + thumbnail strip + lightbox), occupies all of column 1.
- `src/lib/storefront.ts:35,320,366-379` — `Description: string | null`, single free-text field, no structured bullets.
- `src/lib/storeSettings.ts:46-61,100-127,138-161` — `StoreSettings` shape and the JSON-array-in-a-settings-key convention (`heroSlides`, `deliveryProvinces`) that a new trust-badge setting could follow.

## Architecture / Conventions Observed
- Server-rendered "slots" (`header`/`footer` as `React.ReactNode`) are passed from the server page component into client components so SEO-relevant text (name/price/description) stays out of the client JS bundle — moving the description's *position* means moving where the `footer` prop is rendered inside `ProductView.tsx`/`AddToCart.tsx`, not re-fetching or re-typing data.
- Two distinct PDP layout modes exist (`stacked` vs. default grid) driven by `product.SelectByImage`; any layout change needs to account for both, or explicitly scope to one.
- Admin-configurable structured content in this codebase consistently goes through the `Settings` key/value table with a typed array + `normaliseX()` fallback function (see `heroSlides`, `deliveryProvinces`), rather than new dedicated DB tables/columns.
- Recent, related UI-polish history (from `MEMORY.md`): CTA buttons were intentionally changed from `rounded-full` back to `rounded-lg` per explicit user feedback — any new buttons/badges in this area should default to `rounded-lg`, not full pills, unless told otherwise.

## Related Prior Work (from workflow/)
- None found — `workflow/research/`, `workflow/plans/`, `workflow/validation/` had no prior docs on the PDP description section, gallery, or buy box (this is the first).

## Open Questions
- Should the bulleted feature list be derived by splitting `product.Description` on newlines/bullet markers, or does the merchant need a new "Features" field distinct from the free-text description? (Description is currently one opaque string with no delimiter convention enforced.)
- Should the 2x2 trust-badge grid (shipping estimate, secure payment, returns window, made-in-X) be hardcoded site-wide copy, or admin-editable via a new `StoreSettings` key (following the `heroSlides`/`deliveryProvinces` JSON-array pattern)? If admin-editable, does it belong on the per-product settings or the store-wide settings (the reference content — "Made in Sri Lanka," "30 days to change your mind" — reads as store-wide, not per-product)?
- Does moving the footer into the right column apply to both the default grid layout (`ProductView.tsx:98-122`) and the `stacked`/`DesignPicker` layout (`ProductView.tsx:81-96`), or only the default (color/size) flow? The screenshot's reference product has color/size variants, so it maps to the default flow; `SelectByImage` products weren't mentioned.
- With the description removed from column 1/row 2, does the left column just end after the gallery (more whitespace under a shorter gallery), or should something else occupy that space?
