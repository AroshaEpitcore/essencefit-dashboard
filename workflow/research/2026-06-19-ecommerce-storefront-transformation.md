---
date: 2026-06-19
topic: "Transform the EssenceFit admin dashboard into a full customer-facing e-commerce website + admin dashboard (cart, checkout, deals, categories, product images, customer accounts, payments) without changing the DB name/connection"
repo: essencefit-dashboard (single Next.js repo)
commit: 336b9e4
database: InvFin (MSSQL / SQL Express — unchanged per requirement)
status: complete
tags: [research, ecommerce, storefront, nextjs, mssql, products, auth, orders]
---

# Research: E-commerce Storefront Transformation (as-is documentation)

> NOTE: The `/research` command template targets a different "Maraebiz" 3-repo
> platform. This project is a **single Next.js repo** at `C:\essencefit-dashboard`.
> The template has been adapted: this document records **what exists today** in
> this repo and the live `InvFin` database. It does **not** propose the design —
> that belongs to the Plan phase (`/plan ecommerce-storefront-transformation`).

## Research Question
The project is currently an internal admin dashboard ("EssenceFit", internal name
`invfin-web`) for an apparel + DTF-printing business. The goal is to turn it into a
professional, mobile-responsive **e-commerce website with a public storefront**
(browse categories/products, product images, cart, checkout, deals/cut-prices,
customer login, payment methods) **plus** the existing admin dashboard for full
add/edit/delete/update of everything — while **keeping the DB name and connection
unchanged** (`InvFin`). This research maps the current codebase and schema as a
foundation for that plan.

## Summary
- **Stack:** Next.js 16 (App Router, `--turbopack`), React 19.2, TypeScript 5,
  Tailwind 3.4, server actions (`"use server"`), `mssql` 11 (raw SQL, no ORM),
  `bcryptjs` for password hashing. Charts via `recharts`, toasts via
  `react-hot-toast`, icons via `lucide-react`, PDF via `pdf-lib`/`html2pdf.js`.
- **There is no public storefront today.** Every functional page lives under the
  `(main)` route group and is gated to logged-in staff/admin. The root `/` simply
  `redirect("/login")`. There are no customer-facing catalog/cart/checkout routes.
- **Auth is internal-only and client-side.** `Users` table holds staff/admin
  accounts (`Role` = `Admin` | staff). Login returns a user object stored in
  `localStorage` (`authUser`); route gating happens client-side in
  `(main)/layout.tsx` + `useAuth`. There is **no session cookie, no JWT, no
  middleware, no customer account concept** (customers are passwordless records
  created from orders).
- **The product model exists but is admin/inventory-shaped, not storefront-shaped.**
  `Products` has `Name, SKU, CategoryId, CostPrice, SellingPrice` only — **no
  image, no description, no slug, no published/active flag, no compare-at ("cut")
  price**. `ProductVariants` = Size × Color × Qty × prices. `Categories`/`Sizes`/
  `Colors` are flat lookup tables (`Name` only — no image/slug/description).
- **Orders are COD/waybill-shaped (Sri Lanka), not online-payment-shaped.** Orders
  are created by staff with customer name/phone/address + a courier `WaybillId`;
  `PaymentStatus` is `Pending|Paid|Partial|Completed|Canceled`; `DeliveryFee` is
  noted as "always 0 by your rule". There is **no online payment integration, no
  payment gateway, no cart persistence**.
- **No image upload pipeline exists.** `public/` holds only static brand/demo
  assets; there is no upload handler, no blob/file storage, no `ImageUrl` column.
- The DB has **real production data**: 150 Orders, 155 Customers, 129
  ProductVariants, 5 Products, 3 Categories, 2 Users. Any transformation must be
  **additive/backward-compatible** so the existing admin flows keep working.

## Detailed Findings

### Tech stack & configuration
- `package.json:1` — name `invfin-web`, Next `^16.1.1`, React `19.2.3`, scripts use
  `next dev/build --turbopack`. Deps: `mssql`, `bcryptjs`, `recharts`,
  `react-hot-toast`, `lucide-react`, `framer-motion`, `pdf-lib`, `html2pdf.js`,
  `node-fetch`. Dev: `tailwindcss ^3.4.17`, `typescript ^5`.
- `next.config.ts` present; `src/app/globals.css` + Tailwind. Root HTML is forced
  dark mode (`<html lang="en" className="dark">`) in `src/app/layout.tsx:17`;
  metadata title "Essencefit" (`src/app/layout.tsx:7`).
- `.env.local` — `DB_USER=sa`, `DB_PASSWORD=Pass@123`,
  `DB_SERVER=DESKTOP-65181NT\SQLEXPRESS`, `DB_NAME=InvFin`,
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=` (empty). **DB name/connection must stay.**

### Database connection (`src/lib/db.ts`)
- `src/lib/db.ts:3` — single `mssql` config from env; `encrypt:false`,
  `trustServerCertificate:true`. Module-level singleton pool via `getDb()`
  (`src/lib/db.ts:16`). Exports `{ sql }`. All data access goes through this.

### Auth (internal staff/admin only)
- `src/lib/auth.ts:7` `registerUser(username,email,password,role)` — bcrypt hash,
  inserts into `Users` (Id `UniqueIdentifier`, Role `NVarChar(20)`).
- `src/lib/auth.ts:26` `loginUser(username,password)` — looks up by `Username`,
  `bcrypt.compare`, returns `{Id,Username,Email,Role}` (no token/cookie).
- `src/lib/useAuth.ts:21` — client hook; reads `localStorage["authUser"]`.
  `isAdmin = Role === "Admin"`. `ADMIN_ONLY_ROUTES` (`src/lib/useAuth.ts:12`):
  `/finance,/expenses,/reports,/users,/settings,/dtf`. `canAccess()` lets non-admin
  staff see everything except those.
- `src/app/(main)/layout.tsx:27` — client-side gate: no `user` → `replace("/login")`;
  staff hitting an admin route → `replace("/dashboard")`. **All protection is
  client-side**; there is no server middleware enforcing it.
- `src/app/(auth)/login/page.tsx`, `(auth)/register/page.tsx` and their
  `actions.ts` — the only auth UI; both target the staff `Users` table.

### Routing / layout structure
- `src/app/page.tsx:4` — `redirect("/login")` (no landing page).
- Route groups: `(auth)` (login/register, minimal layout) and `(main)` (the whole
  dashboard, wrapped in `Sidebar` + `Topbar`, gated). There is **no public group**.
- `src/components/layout/Sidebar.tsx:31` — hardcoded `navItems` array of 21 admin
  links (dashboard, inventory, stocks, sales, orders, dtf, finance, customers,
  suppliers, reports, settings, etc.); filtered by `isAdmin`.

### Product / catalog model (admin/inventory-shaped)
- `Products` table: `Id, Name, SKU, CategoryId, CostPrice, SellingPrice, CreatedAt`.
  **Missing for storefront:** image(s), description, slug, brand, active/published,
  compare-at/cut price, featured/deal flag, SEO fields.
- `ProductVariants`: `Id, ProductId, SizeId(NULL), ColorId(NULL), Qty,
  SellingPrice(NULL), CostPrice(NULL), CreatedAt`. Variant = product × size × color;
  carries its own stock + price (falls back to product price). No variant image.
- `Categories`/`Sizes`/`Colors`: `Id, Name, CreatedAt` only (flat lookups).
- CRUD already implemented in `src/app/(main)/stocks/actions.ts`:
  - Lookups `getLookups()` (`:6`); Category/Size/Color add/update/delete (`:21–60`).
  - Product CRUD `addProduct/updateProduct/deleteProduct` (`:71–108`); `addProduct`
    auto-generates SKU `NAME-<timestamp>` (`:73`); `updateProduct` cascades price to
    all variants (`:99`).
  - `quickStock()` (`:111`) find-or-create variant, adjust `Qty`, log `StockHistory`.
  - `getStockItems()` (`:194`) joins variants→products→sizes→colors→categories,
    `WHERE Qty>0`. `transferStock()` (`:221`), `updateVariantPrices()` (`:340`).
- Order-side variant resolution in `src/app/(main)/orders/actions.ts`: cascading
  selectors `getCategories` → `getProductsByCategory` (`:19`) → `getSizesByProduct`
  (`:32`) → `getColorsByProductAndSize` (`:47`) → `getVariant` (`:63`, returns
  `VariantId, InStock, SellingPrice`). This is the closest existing analog to a
  storefront "add to cart" variant picker.

### Orders / checkout (COD + courier waybill, staff-entered)
- `Orders` columns: `Customer, CustomerPhone, SecondaryPhone, Address, WaybillId,
  PackagePrintPrice, Notes, CustomerId, PaymentStatus, OrderDate, CompletedAt,
  Subtotal, ManualDiscount, Discount, DeliveryFee, Total`.
- `OrderItems`: `Id, OrderId, VariantId, Qty, SellingPrice`.
- `src/app/(main)/orders/actions.ts:379` `createOrder()` — full transaction:
  upsert customer by phone (`upsertCustomerTx :295`), insert Order + OrderItems,
  `validateAndReduceStock()` (`:263`, throws if `Qty>InStock`), create `Sales` rows
  only when status Paid/Completed (`shouldCreateSales :343`), log `OrderStatusLogs`,
  and auto-create a `DispatchMessages` row if a `WaybillId` is present (`:458`).
- `updateOrder` (`:558`), `updateOrderStatus` (`:486`), `deleteOrder` (`:655`) all
  restore/re-reduce stock and rewrite Sales rows inside transactions.
- **No cart table, no payment/transaction table, no online payment step.**
  `DeliveryFee` is effectively 0; `OrderPayload.DeliveryFee` comment: "always 0".
- `Customers` are created/updated implicitly from orders (`Name, Phone, Address` —
  **no password / login**). 155 rows exist.

### Other admin domains (present, mostly orthogonal to storefront)
- DTF printing: `src/app/(main)/dtf/actions.ts` + `db/10_dtf_printing.sql`,
  `db/11_dtf_advance_charges.sql` (the only non-empty `db/*.sql` files). Tables
  `DtfPriceItems, DtfQuotes, DtfTemplates` — a pricing-quote calculator with
  Sinhala/English message templates. Admin-only route.
- Finance/expenses/suppliers/purchases/returns/reports/analysis/whatsapp/dispatch/
  color-requests/stock-history — each has its own `(main)/<x>/actions.ts`. Reporting
  views exist in DB: `v_FinanceSummary`, `v_ProductProfit`, `v_RecentOrders`.
- `Settings` table: generic `Key`/`Value` (NVARCHAR(max)) store — usable for global
  config (e.g. store settings) without schema changes.
- `ColorRequests` table — customers requesting unavailable colors (CustomerName,
  Phone, ProductName, ColorName, Status). Hints at latent customer-facing intent.

### Database inventory (live `InvFin`, commit-time snapshot)
- 27 base tables + 3 views. Full per-table column list captured during research.
- Key tables: `Users, Customers, Categories, Sizes, Colors, Products,
  ProductVariants, Orders, OrderItems, OrderStatusLogs, Sales, Purchases,
  Suppliers, Expenses, CashUsage, Handovers, Settings, StockHistory,
  DispatchMessages, ColorRequests, SalesReturns(+Items), PurchaseReturns(+Items),
  DtfPriceItems, DtfQuotes, DtfTemplates`.
- Row counts: Products 5, ProductVariants 129, Categories 3, Orders 150,
  Customers 155, Users 2.
- All PKs are `uniqueidentifier`; money is `decimal`; timestamps `datetime2`.
  Inserts use `crypto.randomUUID()` from app code or table defaults.

## Code References
- `src/lib/db.ts:16` — singleton MSSQL pool / connection (must remain `InvFin`).
- `src/lib/auth.ts:26` — staff login (bcrypt, no session/cookie).
- `src/lib/useAuth.ts:12` — client-side role gating + `ADMIN_ONLY_ROUTES`.
- `src/app/page.tsx:4` — root redirects to `/login` (no public landing).
- `src/app/(main)/layout.tsx:27` — client-only auth guard for the whole app.
- `src/app/(main)/stocks/actions.ts:71` — Product CRUD; `:111` stock; `:194` joins.
- `src/app/(main)/orders/actions.ts:379` — transactional order creation + stock.
- `src/components/layout/Sidebar.tsx:31` — admin nav definition.
- `db/10_dtf_printing.sql`, `db/11_dtf_advance_charges.sql` — only non-empty SQL
  migration files; `db/00–09_*.sql` and `seed.sql` are empty placeholders (the live
  schema is the source of truth, not these files).

## Architecture / Conventions Observed
- **Data access:** raw parameterized SQL via `mssql` inside `"use server"` action
  files colocated per route (`(main)/<route>/actions.ts`). No repository/ORM layer.
  Parameters bound with `.input(name, sql.Type, value)`; multi-step writes use
  `new sql.Transaction(pool)` with explicit begin/commit/rollback.
- **IDs:** `uniqueidentifier`, generated app-side with `crypto.randomUUID()`.
- **UI:** App Router client components (`"use client"`), Tailwind, lucide icons,
  `react-hot-toast`; forced dark theme at the root.
- **Auth/session:** entirely client-side via `localStorage` + a `useAuth` hook; no
  server enforcement, no cookies, no middleware.
- **Pricing:** product-level `SellingPrice` with per-variant override; `CostPrice`
  tracked for profit reporting. No discount/compare-at concept at the product level
  (discounts are applied per-order via `ManualDiscount`/`Discount`).
- **Migrations:** ad-hoc `.sql` files in `db/`, mostly empty; schema changes have
  historically been applied directly to the live DB.

## Cross-cutting Connection Points (for the Plan phase)
- A public storefront would reuse the **same `getDb()` pool and `Products /
  ProductVariants / Categories` tables**; the existing variant-resolution chain in
  `orders/actions.ts` is the natural backend for a cart/PDP.
- A customer "place order" flow can reuse `createOrder()`'s transactional
  stock-reduction + `Customers` upsert, but currently assumes staff-entered
  data and COD; online payment + customer-account linkage do not exist yet.
- New storefront concerns with **no current home**: product images & media,
  product descriptions/slugs, published/active flags, compare-at ("cut") prices &
  deals/offers, a persisted cart, customer accounts with passwords, payment
  methods/transactions, and server-enforced sessions.

## Related Prior Work (from workflow/)
- None. `workflow/research/`, `workflow/plans/`, `workflow/validation/` are empty;
  this is the first workflow document in the repo.

## Open Questions (to resolve in Plan, not here)
- Where do product images live (filesystem under `public/uploads`, DB, or external
  blob storage)? No upload pipeline exists today.
- Customer accounts: separate `CustomerUsers`/auth table vs. extending `Users` with
  a `Customer` role; how to link to the existing passwordless `Customers` (155 rows).
- Payment: online gateway (e.g. local SL gateway / Stripe / PayHere) vs.
  keep COD + add "card/bank" as a recorded method only.
- Sessions: introduce cookie/JWT + Next middleware (storefront needs real auth) vs.
  keep the current localStorage scheme for admin only.
- Discounts/deals model: per-product `CompareAtPrice` + `IsOnSale`, vs. a separate
  `Offers/Coupons` table; how it reconciles with order-level `ManualDiscount`.
- All schema additions must be **additive** to avoid breaking the 150 live orders /
  129 variants and existing admin actions.
```
