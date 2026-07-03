---
date: 2026-07-03
slug: pdp-description-placement-redesign
status: implementing
surfaces: [web]
research: workflow/research/2026-07-03-pdp-description-placement-redesign.md
estimated_manual_effort: 35m
---

# PDP description: move to right column + redesign — Implementation Plan

## Overview
Move the PDP product description out of the left column (currently under the gallery) into the right-hand buy box, directly under the Add to cart/Buy now buttons, and restyle it to match the reference screenshot: an uppercase "DESCRIPTION" heading, a bold uppercase body paragraph, a bulleted feature list, and a 2x2 grid of icon + bold-text trust badges.

## Estimated Manual Effort
**35m** — reviewing the diff, manually checking the PDP (both a product with a multi-line Description and one with a single-line/empty Description, at both desktop and mobile widths), and the final `/validate` pass. Includes a 10% buffer.

## Current State
- `src/app/(shop)/product/[slug]/page.tsx:96-101` builds `footerSlot` as a plain sentence-case "Description" heading + one `whitespace-pre-line` paragraph of `product.Description`.
- `src/components/shop/ProductView.tsx:98-122` (default, non-stacked grid) renders that `footer` in `md:col-start-1 md:row-start-2` — the left column, under the gallery — while the buy box (`header` + `AddToCart`) sits sticky in the right column.
- `src/components/shop/AddToCart.tsx:159-273` is the buy box; it currently renders nothing after the Add to cart/Buy now button row (line 270).
- `product.Description` (`src/lib/storefront.ts:35`) is one free-text `string | null` — no structured bullets, no trust-badge data anywhere in the codebase or `StoreSettings`.
- The `stacked` layout (`ProductView.tsx:81-96`, used only for `SelectByImage` custom-design products via `DesignPicker.tsx`) already renders `footer` right after `AddToCart` — it needs no layout change, only picks up the new content automatically once `footerSlot` is redesigned.

## Desired End State
- On the default (color/size) PDP layout, the description block no longer appears under the gallery in the left column; it appears directly under the Add to cart/Buy now buttons in the right-hand buy box column.
- The description block shows: an uppercase, letter-spaced "DESCRIPTION" heading; the first non-empty line of `product.Description` as a bold uppercase paragraph; any further non-empty lines as a bold uppercase bullet list; and below that, a fixed 2x2 grid of 4 icon+text trust badges (shipping, secure payment, returns, made-in note).
- Mobile layout (single column) is unaffected in ordering — gallery → buy box → description was already the mobile order; it keeps the same relative position, just restyled.
- The `stacked`/`DesignPicker` flow keeps working (footer still renders after `AddToCart`), picking up the new visual design with no code change to `ProductView.tsx`'s stacked branch.

## What We're NOT Doing
- Not adding a new `Description`-adjacent DB field or admin UI for a "features" list — bullets are derived by splitting the existing `product.Description` text.
- Not adding a new `StoreSettings` key for the trust badges — the 4 badges are hardcoded, site-wide, matching the "hardcode" decision from planning.
- Not changing `ReviewsSection` or the "You may also like" grid below it.
- Not touching the `stacked`/`DesignPicker` layout's structure (only its inherited content changes).

## Content decisions (business copy — please confirm/edit)
No existing shipping-time or return-window policy text exists anywhere in this codebase to source real numbers from (checked `StoreFooter.tsx`, `storeSettings.ts`, the returns admin pages). Rather than inventing specific claims (e.g. a fabricated "30 days" return window) the 4 hardcoded badges use safe, generic copy consistent with what's actually stated elsewhere on the site (`StoreFooter.tsx`: "island-wide delivery, cash on delivery"):
1. `Truck` icon — "Island-wide delivery"
2. `ShieldCheck` icon — "Safe & secure payment"
3. `RotateCcw` icon — "Easy returns & exchanges"
4. `BadgeCheck` icon — "Quality guaranteed"

These are plain strings in the component — trivial to edit later if the store has (or wants to commit to) more specific policy language.

## Touchpoints
- **Web app (this repo, Next.js)**:
  - `src/app/(shop)/product/[slug]/page.tsx` — rewrite `footerSlot` (new heading/paragraph/bullets/trust-badge markup; parse `product.Description` into a first-line + remaining-lines split).
  - `src/components/shop/ProductView.tsx` — default grid: remove the `md:col-start-1 md:row-start-2` footer cell; render `{footer}` after `<AddToCart .../>` inside the sticky right column instead. `stacked` branch: no change needed.
  - No backend/API/db changes — `product.Description` is already fetched and passed through as-is.

## Phase 1: Move description into the buy box + redesign
### Changes

#### `src/components/shop/ProductView.tsx`
In the default (non-stacked) return block, delete the separate footer grid cell and render `footer` after `AddToCart` inside the sticky column:
```tsx
<div
  className="md:col-start-2 md:row-start-1 md:sticky self-start"
  style={{ top: "calc(var(--header-h, 132px) + 1.5rem)" }}
>
  {header}
  <AddToCart product={product} variants={variants} colorId={colorId} setColorId={setColorId} currentImage={currentImage} actionsRef={actionsRef} />
  {footer}
</div>

{/* Description now lives above, under the buy buttons — this grid cell is removed */}
```
Remove the old `{footer && <div className="md:col-start-1 md:row-start-2">{footer}</div>}` block entirely. Grid stays `md:grid-cols-2`; column 1 now just holds the gallery.

#### `src/app/(shop)/product/[slug]/page.tsx`
Replace the `footerSlot` construction with parsed lines + the new markup:
```tsx
const descLines = (product.Description ?? "")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);
const [descLead, ...descBullets] = descLines;

const footerSlot = descLead ? (
  <div className="mt-8 pt-6 border-t border-gray-200">
    <h2 className="text-lg font-light uppercase tracking-[0.2em] text-gray-900 mb-4">Description</h2>
    <p className="font-bold uppercase text-sm leading-relaxed text-gray-900">{descLead}</p>

    {descBullets.length > 0 && (
      <ul className="mt-4 space-y-2 list-disc pl-5">
        {descBullets.map((line, i) => (
          <li key={i} className="font-bold uppercase text-sm text-gray-900">{line}</li>
        ))}
      </ul>
    )}

    <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6">
      {[
        { Icon: Truck, text: "Island-wide delivery" },
        { Icon: ShieldCheck, text: "Safe & secure payment" },
        { Icon: RotateCcw, text: "Easy returns & exchanges" },
        { Icon: BadgeCheck, text: "Quality guaranteed" },
      ].map(({ Icon, text }) => (
        <div key={text} className="flex flex-col gap-2">
          <Icon className="w-6 h-6 text-gray-900" strokeWidth={1.75} />
          <span className="text-sm font-bold text-gray-900">{text}</span>
        </div>
      ))}
    </div>
  </div>
) : null;
```
Add `Truck, ShieldCheck, RotateCcw, BadgeCheck` to the existing `lucide-react` import at the top of the file (alongside `ChevronRight`).

### Success Criteria
#### Automated (the deterministic gate — must be green)
- [x] Type-check passes: `npx tsc --noEmit -p tsconfig.json` (clean — the pre-existing unrelated `test-notify` stale-cache error is also gone now)
- [x] Production build succeeds: `npm run build`

#### Manual (human verification)
- [ ] Open a product with a multi-line Description (several non-empty lines) — confirm: heading "DESCRIPTION", bold uppercase first line as a paragraph, remaining lines as a bullet list, then the 2x2 trust-badge grid, all directly under the Add to cart/Buy now buttons in the right column (desktop width).
- [ ] Open a product with only a single-line (or no) Description — confirm no bullet list renders, and (if Description is empty/null) the whole block is skipped without leaving a gap.
- [ ] Resize to mobile width — confirm the description still appears after the buy box (same order as before, just restyled), not duplicated, not before the gallery.
- [ ] Open a `SelectByImage` (custom-design) product using the `stacked`/`DesignPicker` flow — confirm the description still renders after `AddToCart` there too, with the new styling, and nothing broke in that flow.

**Pause here** for human manual-test confirmation. This is the only phase — once confirmed, proceed to `/validate`.

## Testing Strategy
No automated test suite in this repo. Verification is manual, per the checklist above, across both PDP layout modes (default grid and stacked/DesignPicker) and both content shapes (multi-line and single-line/empty Description).

## References
- Research: `workflow/research/2026-07-03-pdp-description-placement-redesign.md`
- Layout pattern followed: `src/components/shop/ProductView.tsx:81-96` (the `stacked` branch already puts `footer` after `AddToCart` — this plan makes the default branch match that same relative order)
- Existing icon usage convention: `src/components/shop/AddToCart.tsx:6` (`lucide-react` icons imported directly, sized `w-4 h-4`/`w-5 h-5`, `text-gray-900`/`text-white`)
- Industry standard considered: n/a — this is a content-layout/visual change, not a technical pattern with an external "standard"; followed this repo's existing slot-based header/footer convention instead of introducing a new abstraction.
