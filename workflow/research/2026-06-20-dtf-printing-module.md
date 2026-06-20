---
date: 2026-06-20
topic: "DTF printing customization module — customer design-upload page, DTF Orders admin module, per-product DTF-printable flag, and connected stock updates"
repo_commit: c668293
status: complete
tags: [research, dtf, storefront, orders, stock, catalog]
---

# Research: DTF Printing Customization Module

> Note: this is the single-repo **essencefit-dashboard** (Next.js 16 App Router + MSSQL via `mssql`), not the Maraebiz three-repo workspace the /research skill targets. Sections below are adapted to this codebase: Storefront, Admin, Data layer, Cross-cutting.

## Research Question
The owner wants a DTF (Direct-to-Film) printing customization feature: (1) a separate customer-facing page where a customer customizes a printable garment, uploads **multiple** of their own design files plus a free-text note, and sees our suggestions; (2) a separate **"DTF Orders"** admin module; (3) a per-product flag so the back office can mark **which** t-shirts/shorts/skinners are DTF-printable (e.g. a Sport T-Shirt may be non-printable); (4) when an order is placed, **stock decrements everywhere** and all modules stay in sync. This document maps what exists today to ground the build.

## Summary
- A "DTF" feature already exists but it is **admin-only and unrelated to the storefront catalog or stock**: it's a WhatsApp **quote/price builder** backed by `DtfPriceItems`, `DtfQuotes`, `DtfTemplates` (`db/10_dtf_printing.sql`, `db/11_dtf_advance_charges.sql`). Its "garments" (Regular Tee / Oversize / Short / Skinner) are rows in `DtfPriceItems`, **not** real `Products`. Reusable name, but it does not satisfy any of the four asks.
- The real **catalog/stock/order engine** is the storefront e-commerce stack: `Products` → `ProductVariants(Qty, Cost/SellingPrice)` keyed by Size+Color, `Orders`/`OrderItems`, `Sales`, `StockHistory`, `OrderStatusLogs`, `Customers`. `ProductVariants.Qty` is the **single source of truth** for stock — every module reads it, so decrementing it once propagates everywhere.
- Product-level boolean flags are an established, trivial pattern: `Products.IsActive`, `IsFeatured`, `IsNewArrival` (just added). A new `Products.IsDtfPrintable` flag follows the exact same path (migration → catalog actions → admin toggle → storefront query). This is the right home for "which garments can be printed".
- The customer order pipeline is `createWebOrder` (`src/app/(shop)/checkout/actions.ts`): a single transaction that re-reads price+stock server-side, validates availability, upserts the customer, inserts `Orders` (with `Source='web'`) + `OrderItems`, decrements `ProductVariants.Qty`, and logs status. A DTF custom order should mirror this transaction and add design/note metadata.
- The admin **"Website Orders"** module (`src/app/(main)/web-orders/`) is the precise template for a **"DTF Orders"** admin module: it queries `Orders WHERE Source='web'`, reuses the shared `updateOrderStatus`/`getOrderDetails` engine, and is registered via a `Sidebar` nav item + `ADMIN_ONLY_ROUTES`.
- File uploads already work via `POST /api/upload` (`src/app/api/upload/route.ts`) with an allow-listed folder set. It does **not** yet allow a `designs`/`dtf` folder — that set needs one new entry. Images max 5 MB; the customer slip upload path already uses this for bank slips.

## Detailed Findings

### Data layer (db/ + live MSSQL — schema files are mostly empty stubs; live DB is source of truth)
- **Existing DTF (quote builder, unrelated to catalog):**
  - `DtfPriceItems(Category in Garment|Print|Overhead|Profit|Charge, Name, Amount, Unit, …)` — `db/10_dtf_printing.sql:22`. Seeds garments Regular/Oversize/Short/Skinner and print rates (`:105`).
  - `DtfQuotes(...)` saved quotations with `BreakdownJson` (`db/10_dtf_printing.sql:44`); advance/extra columns added in `db/11_dtf_advance_charges.sql`.
  - `DtfTemplates(...)` WhatsApp message templates (`db/10_dtf_printing.sql:80`).
- **Catalog / stock core (real products):**
  - `Products(Id, Name, Slug, SKU, CategoryId, CostPrice, SellingPrice, CompareAtPrice, Description, ImageUrl, IsActive, IsFeatured, IsNewArrival, SortOrder, CreatedAt)` — storefront columns added additively in `db/12_ecommerce.sql:11`; `IsNewArrival` in `db/15_new_arrivals.sql`.
  - `ProductVariants(Id, ProductId, SizeId, ColorId, Qty, CostPrice, SellingPrice)` — the unit of stock & pricing. `Qty` is decremented on order, restored on edit/delete.
  - `ProductImages(Id, ProductId, Url, ColorId, SortOrder)` — per-colour gallery (`db/12_ecommerce.sql:34`).
  - `Categories`, `Sizes`, `Colors` lookups (`src/app/(main)/stocks/actions.ts:6`).
  - `Orders(Id, Customer, CustomerPhone, SecondaryPhone, Address, CustomerEmail, Notes, CustomerId, Source, PaymentMethod, PaymentSlipUrl, PaymentVerified, PaymentStatus, OrderDate, CompletedAt, WaybillId, PackagePrintPrice, Subtotal, ManualDiscount, Discount, DeliveryFee, Total)` — web columns in `db/12_ecommerce.sql:73`. `Source='web'` discriminates storefront orders.
  - `OrderItems(Id, OrderId, VariantId, Qty, SellingPrice)`.
  - `Sales`, `StockHistory(VariantId, ChangeQty, Reason, PreviousQty, NewQty, PriceAtChange, CreatedAt)`, `OrderStatusLogs`, `DispatchMessages`, `Customers(Id, Name, Phone, Address, Email, PasswordHash)`.

### Storefront (customer-facing — `src/app/(shop)/`)
- Route group `(shop)` with shared `layout.tsx` (Cart/Wishlist/QuickView providers, `StoreHeader`, `StoreFooter`). A new customer page would be a new folder, e.g. `src/app/(shop)/customize/page.tsx`.
- Header nav (`src/components/shop/StoreHeader.tsx:78`): links to `/shop`, per-category, `/deals`. A "Customize"/"DTF Print" entry would be added here (desktop nav `:78`, mobile nav `:128`).
- Order placement: `createWebOrder(payload)` (`src/app/(shop)/checkout/actions.ts:48`):
  - Re-reads `v.Qty` + price per variant inside the transaction (`:69`), rejects if `qty > stock` (`:81`).
  - Upserts `Customers` by phone (`:106`), inserts `Orders` with `Source='web'`, `PaymentStatus='Pending'` (`:142`), inserts `OrderItems` and runs `UPDATE ProductVariants SET Qty = Qty - @Qty` (`:181`), writes an `OrderStatusLogs` row (`:188`).
  - `notes` free-text and `paymentSlipUrl` already flow through (`:149`,`:153`) — the same shape can carry a customer DTF note / uploaded design URLs (the latter needs new storage, see Open Questions).
- Product card / detail provide the variant selection UX a customizer can reuse: `ProductCard.tsx`, `ProductView.tsx`, `AddToCart.tsx`, `CartContext.tsx` (cart items are `{variantId, qty}` — `WebOrderItem` in `checkout/actions.ts:27`).
- Storefront read helpers live in `src/lib/storefront.ts` (e.g. `getFeaturedProducts`, `getNewArrivals`, `searchProducts`); a `getDtfPrintableProducts()` would follow `getNewArrivals` (`src/lib/storefront.ts`) using `WHERE p.IsActive=1 AND p.IsDtfPrintable=1`.
- Image upload from the browser: components POST `FormData{file, folder}` to `/api/upload` and store the returned `url` (pattern in `src/app/(main)/catalog/page.tsx:24` `uploadFile`). Reused by checkout slip upload.

### Admin (back office — `src/app/(main)/`)
- Module shape is consistent: a folder with `page.tsx` (`"use client"`) + `actions.ts` (`"use server"`), registered in `src/components/layout/Sidebar.tsx` `navItems` (`:33`) and gated by `ADMIN_ONLY_ROUTES` in `src/lib/useAuth.ts:12`.
- **Website Orders** = the template for **DTF Orders** (`src/app/(main)/web-orders/actions.ts`): `getWebOrders()` selects `Orders WHERE Source='web'` (`:6`), `verifyWebPayment` flips `PaymentVerified` then calls shared `updateOrderStatus(orderId,'Paid')` (`:23`), `setWebOrderStatus` and `getWebOrderDetails` delegate to the shared `orders/actions.ts` engine (`:33`,`:41`).
- **Storefront Catalog** (`src/app/(main)/catalog/`) is where per-product flags are toggled. `getCatalogProducts`/`getProductForEdit`/`updateProductStorefront`/`toggleProductFlag` (`src/app/(main)/catalog/actions.ts`) already carry `IsActive/IsFeatured/IsNewArrival`. Adding `IsDtfPrintable` means: type field, SELECT columns, the UPDATE, and the `toggleProductFlag` union — then a toggle column + checkbox in `catalog/page.tsx` (mirrors the New-arrival toggle just added at `catalog/page.tsx` Sparkles column).
- **Existing DTF admin** (`src/app/(main)/dtf/page.tsx` + `actions.ts`) is the quote/price/template manager. Reusable for pricing math/templates, but it has no order list and no stock linkage.

### Stock synchronisation (how "everywhere" stays in sync)
- The shared engine in `src/app/(main)/orders/actions.ts`:
  - `validateAndReduceStock(tx, items)` (`:263`) checks then `UPDATE ProductVariants SET Qty = Qty - @Qty`.
  - `restoreStockFromOrder(tx, orderId)` (`:281`) adds quantities back from `OrderItems` — called on **edit** (`updateOrder`) and **delete** (`deleteOrder`), **not** on status→Canceled.
  - `updateOrderStatus` (`:486`) recreates/deletes `Sales` rows on Paid/Completed but does **not** touch stock.
- Because all dashboards (Inventory, Stocks `getStockItems` `WHERE Qty>0`, Stock History, Sales, Reports) read `ProductVariants.Qty`, a single decrement inside the order transaction is automatically reflected everywhere. `StockHistory` is written by manual stock ops (`stocks/actions.ts:176`) and transfers — **not** by order placement (web or admin).

### Cross-cutting connection points
- Upload contract: browser `uploadFile()` (`catalog/page.tsx:24`) ⇄ `POST /api/upload` (`api/upload/route.ts:22`). `SAFE_FOLDERS` (`route.ts:18`) = `products, categories, slips, store, hero, misc` — no design folder yet.
- Order contract: storefront `createWebOrder` (`checkout/actions.ts:48`) writes `Orders(Source='web')` ⇄ admin `getWebOrders`/`updateOrderStatus` read/advance the same rows.
- Product flag contract: `Products.Is*` columns ⇄ catalog admin toggles ⇄ storefront `src/lib/storefront.ts` queries.

## Code References
- `db/10_dtf_printing.sql:22,44,80` — existing DTF quote-builder tables (not catalog-linked).
- `db/12_ecommerce.sql:11,34,73` — storefront Product/ProductImages/Orders columns.
- `db/15_new_arrivals.sql` — example additive boolean-flag migration to copy for `IsDtfPrintable`.
- `src/app/(shop)/checkout/actions.ts:48,69,81,142,181,188` — web order transaction + stock decrement.
- `src/app/(main)/orders/actions.ts:263,281,343,486` — stock reduce/restore + status→Sales engine.
- `src/app/(main)/web-orders/actions.ts:6,23,33,41` — Source-filtered admin order module (template).
- `src/app/(main)/catalog/actions.ts` & `page.tsx` — per-product flag CRUD + admin toggle UI.
- `src/app/(main)/stocks/actions.ts:111,176,194` — variant create/stock change + StockHistory + `getStockItems`.
- `src/components/layout/Sidebar.tsx:33` & `src/lib/useAuth.ts:12` — admin module registration + access gate.
- `src/app/api/upload/route.ts:18,22` — upload endpoint + allowed folders.
- `src/components/shop/StoreHeader.tsx:78,128` — storefront nav (where a Customize link goes).

## Architecture / Conventions Observed
- DB migrations are **additive & idempotent** (`IF COL_LENGTH(...) IS NULL ALTER TABLE …`), numbered `NN_name.sql` in `db/`; applied manually (a small `mssql` node script works, as used for `IsNewArrival`).
- All IDs are `UNIQUEIDENTIFIER` generated app-side via `crypto.randomUUID()`.
- Server Actions (`"use server"`) per feature in `actions.ts`; client pages in `page.tsx`. Multi-write flows use `new sql.Transaction(pool)` with try/commit/rollback.
- Prices & stock are always **re-read server-side** in the order transaction; client values are never trusted.
- New order "types" are modelled by the `Orders.Source` discriminator (`'web'` vs admin/NULL) rather than separate order tables.
- Product feature flags are plain `BIT` columns on `Products` surfaced through the catalog admin and storefront queries.

## Related Prior Work (from workflow/)
- `workflow/research/2026-06-19-ecommerce-storefront-transformation.md` — the storefront/catalog/orders build this feature extends.
- `workflow/research/2026-06-20-color-images-and-quick-view.md` — per-colour images & quick view (variant/colour UX a customizer can reuse).

## Open Questions (for the Plan phase, not decided here)
1. **Custom order modelling:** reuse `Orders` with a new `Source='dtf'` (+ a `DtfOrderItems`/design table), or a dedicated `DtfOrders` table? Reusing `Orders` inherits stock/status/sales/dispatch for free; a separate table isolates DTF-specific fields (designs, placement, print options).
2. **Design storage:** multiple uploads per order → a new `SAFE_FOLDERS` entry (e.g. `designs`) and a child table (e.g. `DtfOrderDesigns(OrderId/ItemId, Url, SortOrder)`) vs a JSON column. Current upload cap is 5 MB/image — print artwork may need a higher limit / more types (PDF, SVG, AI).
3. **Stock on the printable garment:** does a DTF order consume the chosen `ProductVariant.Qty` (blank garment stock) like a normal order? Assumed yes per the ask ("stocks should update everywhere").
4. **Cancellation stock behaviour:** today status→Canceled does **not** restore stock (only edit/delete do). Decide whether DTF (and web) cancellations should restore.
5. **Pricing:** does the customer order use the garment's `SellingPrice` only, or add DTF print charges from `DtfPriceItems` (Print/Overhead/Profit/Charge)? Connecting the two would unify the quote builder with real orders.
6. **"Our suggestions":** static copy on the page, or an admin-managed list (could reuse `DtfTemplates` or a small settings table)?

## Next
Research saved to `workflow/research/2026-06-20-dtf-printing-module.md`. Recommend `/clear`, then `/plan dtf-printing-module` to shape the implementation (resolve the Open Questions there).
