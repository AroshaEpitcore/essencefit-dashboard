---
date: 2026-06-19
slug: ecommerce-storefront-transformation
status: shipped   # draft | approved | implementing | shipped
surfaces: [database, storefront, admin]
research: workflow/research/2026-06-19-ecommerce-storefront-transformation.md
estimated_manual_effort: 4h 45m
repo: essencefit-dashboard (single Next.js 16 repo)
database: InvFin (MSSQL) — name & connection UNCHANGED
gate: npm run build
---

# EssenceFit E-commerce Storefront — Implementation Plan

## Overview
Turn the internal "EssenceFit" admin dashboard into a professional, mobile-responsive
**public e-commerce website** (browse categories/products, product images, deals/cut-prices,
cart, guest checkout, optional customer accounts, COD + bank-transfer payment) while keeping
the existing admin dashboard fully in charge of add/edit/delete/update — all over the **same
`InvFin` database and connection**, with every schema change **additive and backward-compatible**.

## Estimated Manual Effort
**4h 45m** — total human-in-the-loop time only (reviewing each phase + manual verification at
each pause + the final `/validate`). Implementation is done by Claude Code, so no development
hours are counted. Includes a 10% buffer.

## Decisions (locked)
- **Payments:** COD + Bank transfer. Bank transfer = customer uploads a deposit slip at
  checkout; admin verifies and marks the order Paid. No external gateway / no merchant signup.
- **Checkout auth:** Guest checkout (name/phone/address, like today) with an **optional**
  "create account to track orders". Accounts are not required to buy.
- **Currency / locale:** LKR, Sri Lanka (matches existing delivery fees, phone masks, couriers).
- **Image storage:** server filesystem under `public/uploads/...` via a Next Route Handler
  (self-hosted SQL Express box; no cloud bucket needed). Served statically by `next start`.
- **Cart:** client-side (localStorage + React context) for guests, **re-validated against live
  stock & price on the server at checkout**. A DB-backed cross-device cart is out of scope (noted).
- **Sessions:** signed `httpOnly` cookie for customer accounts (HMAC via `SESSION_SECRET`),
  using Next `cookies()`. Admin keeps its existing localStorage scheme unchanged.
- **Deals / cut price:** a `CompareAtPrice` column on `Products`. If `CompareAtPrice > SellingPrice`,
  storefront shows the old price struck through + a discount %. A "Deals" page lists all such products.

## Current State (from research)
- Next.js 16 App Router, React 19, Tailwind 3, raw `mssql` via `"use server"` actions, bcrypt.
  Gate = `npm run build`. `@/*` → `./src/*`. (`package.json`, `tsconfig.json`)
- Root `/` → `redirect("/login")` (`src/app/page.tsx:4`); root layout forces global dark theme
  (`src/app/layout.tsx:17`). Everything functional is under `(main)` behind a client-side
  localStorage auth gate (`src/app/(main)/layout.tsx:27`, `src/lib/useAuth.ts`).
- Catalog is admin/inventory-shaped: `Products(Name,SKU,CategoryId,CostPrice,SellingPrice)`,
  `ProductVariants(Size×Color×Qty×prices)`, flat `Categories/Sizes/Colors`. CRUD already exists
  in `src/app/(main)/stocks/actions.ts` (`addProduct :71`, etc.) and the variant-resolution chain
  in `src/app/(main)/orders/actions.ts` (`getProductsByCategory :19` … `getVariant :63`).
- Orders are COD/courier-waybill, staff-entered; `createOrder()` (`orders/actions.ts:379`) is a
  full transaction (customer upsert + stock reduction + Sales rows + dispatch). No cart, no
  payment table, no customer auth, no product images.
- `Settings` Key/Value store with upsert `saveSetting()` (`src/app/(main)/settings/actions.ts:27`)
  — reusable for store config with no schema change.
- Live data: 150 Orders, 155 Customers, 129 Variants, 5 Products, 3 Categories. Must not break.

## Desired End State
- Visiting `/` shows a polished, mobile-responsive **storefront home** (hero, featured products,
  deals, category tiles) — no login required.
- Customers can browse categories, search/filter products, open a product page with an image
  gallery + size/color picker + live stock + cut-price display, add to cart, and check out as a
  guest (COD or bank-transfer-with-slip). The order appears in the **admin Orders page** instantly,
  reduces stock, and creates/links the customer — exactly like a staff order.
- Customers may optionally register/login to see order history & track orders.
- Admins can, from the dashboard: upload product images, edit description/slug/active/featured,
  set a compare-at (cut) price / deal, manage category images, configure store settings
  (bank details, delivery fee, banners), and verify bank-transfer payments.
- `npm run build` stays green throughout; admin flows keep working unchanged.

## What We're NOT Doing
- No external payment gateway (PayHere/Stripe), no real card processing.
- No DB-backed cross-device cart, no wishlist, no product reviews/ratings (can be added later).
- No email sending (verification/receipts) — order confirmation is on-screen + admin-side.
- No change to DB name/connection, no destructive migrations, no rename of existing admin routes.
- No multi-currency, no i18n framework (copy stays English; Sinhala templates remain admin-only).
- No automated test suite (repo has none) — verification is manual per phase + `npm run build`.

## Touchpoints (single repo)
- **Database (`InvFin`)**: additive migration `db/12_ecommerce.sql` (+ applied to live DB):
  new columns on `Products`, `Categories`, `Customers`, `Orders`; new table `ProductImages`.
- **Shared libs (`src/lib/`)**: `db.ts` (reused as-is), new `customerAuth.ts` (cookie session),
  new `storefront.ts` / catalog query helpers, new `slug.ts`, `money.ts`.
- **Admin (`src/app/(main)/`)**: extend `stocks` (product/category fields + image upload UI),
  extend `settings` (store config), extend `orders` (Source/payment columns, slip view, verify).
- **Storefront (new `src/app/(shop)/`)**: light-theme layout, home, category, product, cart,
  checkout, order-confirmation, account (login/register/orders/profile) + their server actions.
- **API**: new Route Handler `src/app/api/upload/route.ts` (multipart → `public/uploads`).
- **Config**: `next.config.ts` (images/uploads), `src/app/layout.tsx` (un-force global dark; scope
  dark to admin), `.env.local` (+`SESSION_SECRET`), `.gitignore` (+`public/uploads`).

---

## Phase 1: Database schema additions (additive migration)
### Changes
#### Migration — `db/12_ecommerce.sql`
Idempotent (`IF COL_LENGTH(...) IS NULL` / `IF OBJECT_ID(...) IS NULL`) so it's safe to re-run.
```sql
-- Products: storefront fields
ALTER TABLE Products ADD Slug NVARCHAR(250) NULL;
ALTER TABLE Products ADD Description NVARCHAR(MAX) NULL;
ALTER TABLE Products ADD ImageUrl NVARCHAR(500) NULL;          -- primary/thumbnail
ALTER TABLE Products ADD CompareAtPrice DECIMAL(18,2) NULL;    -- "cut" / original price
ALTER TABLE Products ADD IsActive BIT NOT NULL DEFAULT 1;      -- published to storefront
ALTER TABLE Products ADD IsFeatured BIT NOT NULL DEFAULT 0;
ALTER TABLE Products ADD SortOrder INT NOT NULL DEFAULT 0;

-- Product image gallery
CREATE TABLE ProductImages (
  Id uniqueidentifier NOT NULL DEFAULT NEWID() PRIMARY KEY,
  ProductId uniqueidentifier NOT NULL,
  Url NVARCHAR(500) NOT NULL,
  SortOrder INT NOT NULL DEFAULT 0,
  CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Categories: storefront fields
ALTER TABLE Categories ADD Slug NVARCHAR(150) NULL;
ALTER TABLE Categories ADD ImageUrl NVARCHAR(500) NULL;
ALTER TABLE Categories ADD Description NVARCHAR(500) NULL;
ALTER TABLE Categories ADD IsActive BIT NOT NULL DEFAULT 1;
ALTER TABLE Categories ADD SortOrder INT NOT NULL DEFAULT 0;

-- Customers: optional accounts (guests keep these NULL)
ALTER TABLE Customers ADD Email NVARCHAR(200) NULL;
ALTER TABLE Customers ADD PasswordHash NVARCHAR(200) NULL;

-- Orders: web-order + payment fields
ALTER TABLE Orders ADD Source NVARCHAR(20) NULL;              -- 'web' | NULL(admin)
ALTER TABLE Orders ADD CustomerEmail NVARCHAR(200) NULL;
ALTER TABLE Orders ADD PaymentMethod NVARCHAR(30) NULL;       -- 'COD' | 'BankTransfer'
ALTER TABLE Orders ADD PaymentSlipUrl NVARCHAR(500) NULL;
ALTER TABLE Orders ADD PaymentVerified BIT NOT NULL DEFAULT 0;
```
A one-time data backfill (separate statements) generates `Slug` for existing 5 products / 3
categories from their `Name`, and sets `Products.IsActive = 1`.
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
- [x] Re-running the introspection script shows the new columns/table on `Products`,
      `Categories`, `Customers`, `Orders`, and `ProductImages` exists.
#### Manual
- [ ] Open the existing admin (orders, stocks, dashboard) — all still load and work unchanged.
- [ ] Existing 150 orders / 5 products still visible in admin.

**Pause here** for confirmation before Phase 2.

---

## Phase 2: Image upload + store-settings backend
### Changes
#### Upload Route Handler — `src/app/api/upload/route.ts`
POST multipart; validates type (jpeg/png/webp) + size (≤5MB); writes to
`public/uploads/<folder>/<uuid>.<ext>`; returns `{ url: "/uploads/..." }`.
#### Config
- `next.config.ts` — keep local `<img>`/`next/image` working for `/uploads/*` (no remote loader).
- `.gitignore` — add `public/uploads/`. Create `public/uploads/.gitkeep`.
#### Store settings helpers — extend `src/app/(main)/settings/actions.ts`
Typed getters/setters over the existing `Settings` Key/Value store for keys:
`store_name, store_logo, hero_slides(JSON), bank_details(JSON: bank/acc name/acc no/branch),
delivery_fee, free_delivery_over, contact_phone, contact_email, social(JSON), announcement`.
Add `getPublicStoreSettings()` returning a single typed object for the storefront.
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
#### Manual
- [ ] `POST` an image to `/api/upload` (via the admin UI added next phase, or curl) returns a
      `/uploads/...` URL and the file exists on disk and loads in the browser.
- [ ] Saving a store setting persists and reloads.

**Pause here** for confirmation before Phase 3.

---

## Phase 3: Admin catalog upgrade (products, categories, deals, settings UI)
### Changes
#### Product actions — extend `src/app/(main)/stocks/actions.ts`
Extend `addProduct`/`updateProduct` to persist `Description, Slug, ImageUrl, CompareAtPrice,
IsActive, IsFeatured, SortOrder`; add `setProductImages(productId, urls[])` (writes
`ProductImages`), `getProductForEdit(id)`. Auto-slug from name (unique-suffixed) via `lib/slug.ts`.
#### Category actions — extend category CRUD to set `Slug, ImageUrl, Description, IsActive, SortOrder`.
#### Admin UI — extend the products/stocks screen (`src/app/(main)/stocks/page.tsx`) and/or a new
`src/app/(main)/catalog/` screen: edit panel with description, image upload (multi, drag-sort,
calls `/api/upload`), compare-at price, active/featured toggles; category image upload. A simple
**Deals** filter (products where `CompareAtPrice > SellingPrice`).
#### Settings UI — extend `src/app/(main)/settings/page.tsx` with a "Store / Website" section
(store name, logo upload, hero slides, bank details, delivery fee, contact, socials, announcement).
#### Sidebar — add admin links (e.g. "Storefront Settings"); keep gated to admin.
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
#### Manual
- [ ] Create/edit a product with images, description, and a cut price; reload — values persist;
      images show in admin.
- [ ] Toggle a product inactive and featured; set a category image; save store settings + bank details.

**Pause here** for confirmation before Phase 4.

---

## Phase 4: Storefront foundation (route group, theme, home)
### Changes
#### Theme isolation — `src/app/layout.tsx`: remove forced global `className="dark"`; wrap the
admin `(main)` subtree in a `dark` container so admin looks identical, storefront is light.
Confirm `darkMode: 'class'` in `tailwind.config`.
#### New group `src/app/(shop)/`
- `layout.tsx` — light store shell: sticky header (logo, category nav, search box, cart icon w/
  count, account link), announcement bar, footer (contact, socials, bank info), mobile drawer.
- `page.tsx` — home: hero/slider (from settings), featured products, **Deals** strip, category
  tiles, "shop all" CTA. Fully responsive (Tailwind, mobile-first).
- Remove old `src/app/page.tsx` (root now served by `(shop)/page.tsx`).
- Storefront primitives in `src/components/shop/` (ProductCard, Price w/ cut-price, Rating-less,
  Button, SectionHeading) + a `CartContext` provider (localStorage-backed).
#### Catalog read helpers — `src/lib/storefront.ts`: `getFeaturedProducts`, `getDeals`,
`getActiveCategories`, all filtering `IsActive=1`, joining primary image + price.
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
#### Manual
- [ ] Visiting `/` shows the storefront home (light theme) with featured/deals/categories from DB.
- [ ] Admin pages (`/dashboard`, `/orders`) still render in dark theme and work.
- [ ] Header/footer responsive on mobile width; cart icon present.

**Pause here** for confirmation before Phase 5.

---

## Phase 5: Catalog browsing (category, listing, search, product page)
### Changes
#### `src/app/(shop)/category/[slug]/page.tsx` — products in a category, responsive grid.
#### `src/app/(shop)/shop/page.tsx` — all products with filters (category, size, color, price range)
and search (`?q=`), sort (newest, price asc/desc, deals). Filters reuse `Sizes/Colors`.
#### `src/app/(shop)/product/[slug]/page.tsx` — PDP: image gallery (`ProductImages`), name,
price + struck-through `CompareAtPrice` + discount %, description, **size/color variant picker**
(reuses the variant chain: sizes for product → colors for size → `getVariant` for stock/price),
live in-stock indicator, qty stepper, **Add to cart** (disabled when out of stock), "out of stock"
+ link to existing Color Request. Related products.
#### `src/lib/storefront.ts` — add `getProductBySlug`, `getProductVariantsForPDP`,
`searchProducts`, `getCategoryBySlug`. SEO `generateMetadata` per product/category.
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
#### Manual
- [ ] Open a category and the shop page; filter by size/color/price and search by name — results
      update correctly.
- [ ] Open a product, switch size/color → stock + price update; cut price shows strike + %;
      add to cart updates the header count; out-of-stock variant disables the button.

**Pause here** for confirmation before Phase 6.

---

## Phase 6: Cart + checkout (COD + bank transfer)
### Changes
#### `src/app/(shop)/cart/page.tsx` — cart from `CartContext`: line items (image, variant, price),
qty edit, remove, subtotal, delivery fee (from settings, free over threshold), total, "Checkout".
#### `src/app/(shop)/checkout/page.tsx` — guest form (name, phone, secondary phone, address, email
optional, notes), **payment method**: COD, or Bank Transfer (shows bank details from settings +
slip upload via `/api/upload`). Order summary. Places order.
#### `src/app/(shop)/checkout/actions.ts` — `createWebOrder(payload)`: a transaction mirroring
`orders/actions.ts:createOrder` — re-validate each variant's **live stock & price** server-side,
upsert customer by phone, insert `Orders` (`Source='web'`, `PaymentMethod`, `PaymentSlipUrl`,
`PaymentStatus='Pending'`, `PaymentVerified=0`), `OrderItems`, reduce stock, log status,
auto-create dispatch row if applicable. Returns `{ orderId }`. (Sales rows only once admin marks Paid.)
#### `src/app/(shop)/order/[id]/page.tsx` — confirmation: order ref, items, total, payment
instructions (bank details for transfer), "track your order".
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
#### Manual
- [ ] Add items, edit qty in cart, see correct totals + delivery fee.
- [ ] Place a COD order as guest → confirmation page shows; order appears in **admin Orders** with
      `Source=web`, stock reduced; admin can change status to Paid (Sales row created).
- [ ] Place a Bank Transfer order with a slip → slip URL stored; admin sees/opens the slip.
- [ ] Checkout blocks/over-sells nothing: ordering more than stock is rejected server-side.

**Pause here** for confirmation before Phase 7.

---

## Phase 7: Optional customer accounts
### Changes
#### `src/lib/customerAuth.ts` — register (bcrypt into `Customers.Email/PasswordHash`), login
(by email or phone), signed `httpOnly` cookie session (HMAC `SESSION_SECRET`), `getCurrentCustomer()`,
`logout()`. Add `SESSION_SECRET` to `.env.local`.
#### `src/app/(shop)/account/` — `login`, `register`, `(protected) orders` (history + track by
linking `Orders.CustomerId`/phone/email), `profile` (name/phone/address/password), `addresses`.
#### Checkout — if logged in, prefill details and link the order to the account; still allow guest.
#### Header — show "Account"/"Login"; protect `/account/*` (redirect to login if no session).
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
#### Manual
- [ ] Register, log out, log back in (cookie persists across reload).
- [ ] Logged-in checkout prefills + links the order; account → orders shows that order with status.
- [ ] `/account/orders` redirects to login when logged out.

**Pause here** for confirmation before Phase 8.

---

## Phase 8: Admin web-order management + polish
### Changes
#### Admin Orders — extend `src/app/(main)/orders/page.tsx` to show `Source` (Web/Admin badge),
`PaymentMethod`, a **slip thumbnail/link**, and a **"Verify payment"** action (sets
`PaymentVerified=1` and status Paid via the existing `updateOrderStatus`). Add a "Web orders" filter.
#### Polish — SEO metadata/Open Graph on storefront pages, `robots`/`sitemap` (optional),
loading/empty states, 404 for unknown slugs, accessibility pass, mobile QA across all storefront
pages, wire all storefront content to `Settings` (banners, bank, delivery, contact, socials).
#### Seed/QA — ensure the 5 existing products have images + at least one deal so the home/Deals
pages look populated.
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
#### Manual
- [ ] Admin can identify a web order, view its slip, and verify payment → status flips to Paid +
      Sales recorded.
- [ ] Full storefront walkthrough on mobile + desktop: home → category → product → cart → checkout
      → confirmation, plus account flow — all clean, responsive, no dead ends.

**Pause here** for final `/validate`.

---

## Testing Strategy
No automated test suite exists. Each phase's gate is `npm run build` (Next type-checks + lints),
plus the explicit manual steps above. Use the live `InvFin` data for verification (5 products,
129 variants); Phase 8 ensures products have images/deals so storefront pages render fully.
Verify admin flows remain unchanged after every schema/theme change.

## Rollback / Safety
- All migrations are additive + idempotent; no column drops or renames. Existing admin code keeps
  reading the same columns. Worst case, new columns sit unused.
- Storefront lives in a new `(shop)` group + new files; admin routes/actions are extended, not
  rewritten, minimizing blast radius on the 150 live orders.

## Post-ship enhancements (2026-06-20)
1. **Server-rendered PDP price** — moved the price (+ cut price / discount %) out of the client
   `AddToCart` widget into the server-rendered product page (`product/[slug]/page.tsx`) so it's in
   the initial HTML for SEO / link previews / instant paint. `AddToCart` now only shows a price note
   when a selected variant's price differs from the base. Verified: `Rs. …` + `line-through` in HTML.
2. **Auto-create customer account at checkout** — `createWebOrder` accepts an optional password;
   when given (default-on "Create an account" on checkout for logged-out buyers), it sets the
   customer's `PasswordHash` at order time and auto-signs them in (cookie). Every web order still
   upserts the `Customers` row regardless, so all buyers appear in admin.
3. **Admin Customers visibility** — `getCustomers` now returns `Email`, `HasAccount`, and
   `WebOrderCount`; the admin Customers table shows the email and a Registered/Guest + Web badge.

## References
- Research: `workflow/research/2026-06-19-ecommerce-storefront-transformation.md`
- Patterns to follow: transactional order + stock + customer upsert `src/app/(main)/orders/actions.ts:379`;
  product/variant CRUD `src/app/(main)/stocks/actions.ts:71`; variant chain `orders/actions.ts:19–83`;
  Key/Value settings upsert `src/app/(main)/settings/actions.ts:27`; bcrypt auth pattern `src/lib/auth.ts`.
- Industry standard considered: localStorage guest cart + server-side stock/price re-validation at
  checkout is standard for lightweight storefronts; signed httpOnly cookie sessions are the standard
  for self-rolled auth. Chosen over a DB cart / external session lib to match this repo's
  no-extra-dependency, raw-`mssql` conventions and single-box deployment.
```
