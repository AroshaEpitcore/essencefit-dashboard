---
date: 2026-06-20
slug: dtf-printing-module
status: shipped
surfaces: [backend, storefront, admin, db]
research: workflow/research/2026-06-20-dtf-printing-module.md
estimated_manual_effort: 2h 20m
---

# DTF Printing Customization Module — Implementation Plan

## Overview
Add a customer-facing **Customize** page where shoppers pick a DTF-printable garment (size/colour), upload multiple design files + a note, see an admin-priced estimate, and submit a request; the request lands in a new admin **DTF Orders** module where confirming it reserves (decrements) the blank garment's variant stock so Inventory/Stocks/Sales stay in sync. A new `Products.IsDtfPrintable` flag controls which garments are printable.

## Estimated Manual Effort
**2h 20m** — total human-in-the-loop time only (reviewing each phase + manual verification at each pause + final `/validate`), with a 10% buffer. Claude Code does the implementation, so no development hours are counted.

## Current State
- DTF today is an **admin-only WhatsApp quote/price builder** (`DtfPriceItems`, `DtfQuotes`, `DtfTemplates` — `db/10_dtf_printing.sql`, admin UI `src/app/(main)/dtf/`). Not linked to real catalog products or stock.
- Real catalog/stock/order engine: `Products` → `ProductVariants(Qty, Cost/SellingPrice)` (Size+Color) → `Orders`/`OrderItems` → `Sales`/`StockHistory`. `ProductVariants.Qty` is the single source of truth for stock (`src/app/(main)/orders/actions.ts:263` reduce, `:281` restore).
- Per-product boolean flags are an established pattern: `Products.IsActive/IsFeatured/IsNewArrival` flow through `src/app/(main)/catalog/actions.ts` + a toggle in `catalog/page.tsx`; storefront reads them in `src/lib/storefront.ts` (e.g. `getNewArrivals`).
- Web order creation `createWebOrder` (`src/app/(shop)/checkout/actions.ts:48`) is the transaction template; admin `web-orders` (`src/app/(main)/web-orders/actions.ts`) is the Source-filtered admin module template. Modules register in `src/components/layout/Sidebar.tsx:33` + `src/lib/useAuth.ts:12` (`ADMIN_ONLY_ROUTES`).
- Uploads: `POST /api/upload` (`src/app/api/upload/route.ts`); `SAFE_FOLDERS` (`:18`) has no `designs` entry; images only, 5 MB cap.
- Settings are a generic Key/Value `Settings` table wrapped by `src/lib/storeSettings.ts`; it already has `contactPhone`, `contactEmail`, `social.whatsapp`.
- DB migrations are additive/idempotent, numbered `NN_name.sql` in `db/`, applied manually with a small `mssql` node script (as done for `db/15_new_arrivals.sql`).

## Desired End State
- A printable garment can be marked in the admin catalog (Printer toggle + edit checkbox); only marked, active garments appear on the Customize page.
- `/customize` lets a customer choose a printable garment + size/colour + qty, pick print positions, upload 1+ designs (image/PDF, ≤25 MB), add a note, enter their contact details, see a live estimate + a disclaimer that the final price may change after artwork review, see the shop WhatsApp/contact, and submit.
- Submitting creates a `DtfOrders` row (status `Pending`, no stock change) + `DtfOrderDesigns` rows, and shows a confirmation.
- A new **DTF Orders** admin module lists requests, shows full detail (designs gallery, price breakdown, customer contact, note), lets admin edit the final price/advance and move status. **Confirm** decrements the chosen variant's `Qty` and logs `StockHistory`; **Cancel** of a confirmed order restores it. Double-deduct is guarded by a `StockDeducted` flag.
- Intro note + "our suggestions" are admin-editable from a new "Customize Page" tab in `/dtf`.

## What We're NOT Doing
- No online payment / advance collection on the Customize page (payment stays in the existing WhatsApp/advance flow). No `Sales`/finance rows created for DTF orders (revenue stays in the existing quote tooling) — DTF revenue reporting is out of scope.
- Not overloading the `Orders` table or the `web-orders` module; DTF uses its own tables/module.
- Not changing existing web-order cancellation stock behaviour.
- Not auto-generating WhatsApp messages from DTF orders (the existing `DtfTemplates` tooling already covers messaging).
- No editing/replacing the customer's submitted designs from admin (view/download only).

## Touchpoints per surface
- **DB**: `db/16_dtf_orders.sql` — `Products.IsDtfPrintable BIT`; tables `DtfOrders`, `DtfOrderDesigns`.
- **Admin data/actions**: `catalog/actions.ts` (flag CRUD), new `src/lib/dtfPricing.ts` (estimate), new `src/app/(main)/dtf-orders/actions.ts` (list/detail/confirm/cancel/status/price), `src/app/(main)/dtf/actions.ts` (page-content settings), `src/app/(main)/settings/actions.ts` pattern reused for keys.
- **Admin UI**: `catalog/page.tsx` (toggle+checkbox), `src/app/(main)/dtf-orders/page.tsx` (new), `src/app/(main)/dtf/page.tsx` (new "Customize Page" tab), `Sidebar.tsx` + `useAuth.ts` (registration).
- **Storefront**: `src/lib/storefront.ts` (`getDtfPrintableProducts`, `getDtfGarment`), new `src/app/(shop)/customize/page.tsx` + client component + `actions.ts`, `StoreHeader.tsx` nav link.
- **API**: `src/app/api/upload/route.ts` (designs folder, PDF, 25 MB).
- **Tenancy note**: single-tenant app (one DB, no CompanyKey concept) — n/a.
- **App / Public site**: none (no RN app or separate marketing site in this repo).

---

## Phase 1: DB migration (flag + DTF order tables)
### Changes
#### Migration — `db/16_dtf_orders.sql`
Additive, idempotent. Apply with the same throwaway `mssql` node script used for `15_new_arrivals.sql`.
```sql
/* 16_dtf_orders.sql — DTF customization orders + printable flag (idempotent) */

IF COL_LENGTH('Products','IsDtfPrintable') IS NULL
  ALTER TABLE Products ADD IsDtfPrintable BIT NOT NULL
        CONSTRAINT DF_Products_IsDtfPrintable DEFAULT 0;
GO

IF OBJECT_ID('dbo.DtfOrders','U') IS NULL
BEGIN
  CREATE TABLE dbo.DtfOrders (
    Id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_DtfOrders_Id DEFAULT NEWID()
                                            CONSTRAINT PK_DtfOrders PRIMARY KEY,
    Ref           NVARCHAR(20)  NOT NULL,                 -- e.g. DTF-O-1001
    -- customer contact (collected on submit)
    CustomerName  NVARCHAR(200) NOT NULL,
    CustomerPhone NVARCHAR(50)  NOT NULL,
    WhatsApp      NVARCHAR(50)  NULL,
    Email         NVARCHAR(200) NULL,
    Address       NVARCHAR(500) NULL,
    -- chosen garment (real catalog product/variant)
    ProductId     UNIQUEIDENTIFIER NOT NULL,
    VariantId     UNIQUEIDENTIFIER NULL,                  -- size+colour variant; NULL if none chosen
    Qty           INT           NOT NULL CONSTRAINT DF_DtfOrders_Qty DEFAULT 1,
    PrintOptions  NVARCHAR(300) NULL,                     -- comma list e.g. "Front Print, A3 Print"
    CustomerNote  NVARCHAR(MAX) NULL,
    -- pricing (estimate computed from DtfPriceItems + garment price; admin may override)
    GarmentPrice  DECIMAL(10,2) NOT NULL CONSTRAINT DF_DtfOrders_Garment DEFAULT 0,
    PrintCharges  DECIMAL(10,2) NOT NULL CONSTRAINT DF_DtfOrders_Print   DEFAULT 0,
    EstimatedTotal DECIMAL(10,2) NOT NULL CONSTRAINT DF_DtfOrders_Est    DEFAULT 0,
    BreakdownJson NVARCHAR(MAX) NULL,
    FinalTotal    DECIMAL(10,2) NULL,                     -- admin-set
    AdvanceAmount DECIMAL(10,2) NULL,                     -- admin-set
    -- lifecycle
    Status        NVARCHAR(20)  NOT NULL CONSTRAINT DF_DtfOrders_Status DEFAULT 'Pending',
                  -- Pending | Confirmed | InProduction | Ready | Completed | Canceled
    StockDeducted BIT           NOT NULL CONSTRAINT DF_DtfOrders_Stock  DEFAULT 0,
    AdminNote     NVARCHAR(MAX) NULL,
    CreatedAt     DATETIME2     NOT NULL CONSTRAINT DF_DtfOrders_Created DEFAULT SYSUTCDATETIME(),
    ConfirmedAt   DATETIME2     NULL
  );
  CREATE INDEX IX_DtfOrders_Status ON dbo.DtfOrders(Status);
END
GO

IF OBJECT_ID('dbo.DtfOrderDesigns','U') IS NULL
BEGIN
  CREATE TABLE dbo.DtfOrderDesigns (
    Id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_DtfOrderDesigns_Id DEFAULT NEWID()
                                          CONSTRAINT PK_DtfOrderDesigns PRIMARY KEY,
    DtfOrderId UNIQUEIDENTIFIER NOT NULL,
    Url        NVARCHAR(500) NOT NULL,
    Kind       NVARCHAR(20)  NOT NULL CONSTRAINT DF_DtfOrderDesigns_Kind DEFAULT 'image', -- image | pdf
    SortOrder  INT           NOT NULL CONSTRAINT DF_DtfOrderDesigns_Sort DEFAULT 0
  );
  CREATE INDEX IX_DtfOrderDesigns_OrderId ON dbo.DtfOrderDesigns(DtfOrderId);
END
GO
```
Ref generation: compute in the create action as `DTF-O-` + a zero-padded count (mirrors `DtfQuotes.QuoteRef` style).
### Success Criteria
#### Automated (deterministic gate)
- [x] Migration applies cleanly: running the node `mssql` script prints the new column length = 1 and both tables exist (re-runnable with no error).
- [x] App builds: `npm run build`
#### Manual
- [ ] In SSMS/query, `SELECT` on `DtfOrders`/`DtfOrderDesigns` returns empty sets; `Products.IsDtfPrintable` defaults to 0.

**Pause here** for confirmation before the next phase.

---

## Phase 2: Catalog "DTF printable" flag
### Changes
#### `src/app/(main)/catalog/actions.ts`
- Add `IsDtfPrintable: boolean` to `CatalogProduct`.
- Add `p.IsDtfPrintable` to the `getCatalogProducts` and `getProductForEdit` SELECTs.
- Add `isDtfPrintable: boolean` to `ProductStorefrontInput`; bind `@IsDtfPrintable` and add `IsDtfPrintable=@IsDtfPrintable` to the `updateProductStorefront` UPDATE.
- Extend `toggleProductFlag` field union to `"IsActive" | "IsFeatured" | "IsNewArrival" | "IsDtfPrintable"`.
#### `src/app/(main)/catalog/page.tsx`
- Import `Printer` from lucide-react.
- Add a **"DTF"** column with a Printer toggle (mirrors the `Sparkles`/New column), calling `quickToggle(p, "IsDtfPrintable")` (extend its field union).
- Add `isDtfPrintable` state to the edit modal: load it, include in the `updateProductStorefront` payload, and add a **"DTF printable"** checkbox next to Featured/New arrival.
#### `src/lib/storefront.ts`
- Add `getDtfPrintableProducts(): Promise<StoreProduct[]>` — `WHERE p.IsActive=1 AND p.IsDtfPrintable=1 ORDER BY p.SortOrder, p.Name` (clone `getNewArrivals`, with `attachColors`).
- Add `getDtfGarment(slugOrId)` returning the product + variants for the customize picker (reuse `getProductBySlug` + `getProductVariants` shapes).
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] In `/catalog` Products tab, the DTF (Printer) toggle turns on/off and persists after reload; the edit modal checkbox matches.
- [ ] `getDtfPrintableProducts()` (verified via the Customize page in Phase 5) returns only marked+active products.

**Pause here** for confirmation.

---

## Phase 3: Upload support for design files
### Changes
#### `src/app/api/upload/route.ts`
- Add `"designs"` to `SAFE_FOLDERS`.
- Add `application/pdf` → `pdf` to `EXT`; add a `DOC_TYPES = new Set(["application/pdf"])`.
- Accept images, videos (unchanged), **and** PDFs; for the `designs` folder allow image + PDF and set the size cap to **25 MB** (introduce `MAX_DESIGN = 25*1024*1024`). Return `kind: "pdf"` for PDFs.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] `POST /api/upload` with `folder=designs` accepts a PNG and a PDF (≤25 MB), rejects a 30 MB file and an unsupported type, and returns a `/uploads/designs/...` URL.

**Pause here** for confirmation.

---

## Phase 4: DTF estimate engine + admin page-content settings
### Changes
#### `src/lib/dtfPricing.ts` (new, server)
- `getDtfPrintOptions()` → active `DtfPriceItems WHERE Category='Print'` (Id/Name/Amount) for the customer to choose from.
- `computeDtfEstimate({ garmentPrice, printNames, qty })` → reads live `DtfPriceItems`: `perPiece = garmentPrice + Σ(selected Print rates) + Σ(active Overhead) + topProfit`; `total = perPiece*qty + OrderExtra`. Returns `{ garmentPrice, printCharges, perPiece, total, breakdown }` (mirrors the formula documented in `db/10_dtf_printing.sql:200`). Single source = `DtfPriceItems`, already admin-editable in the `/dtf` Price Setup tab.
#### `src/lib/dtfSettings.ts` (new) + keys
- Add `Settings` keys `dtf_intro_note` (string) and `dtf_suggestions` (JSON string[]). Provide `getDtfPageSettings()` returning `{ introNote, suggestions, whatsapp, contactPhone }` (whatsapp/contactPhone reused from `getPublicStoreSettings`).
#### `src/app/(main)/dtf/actions.ts` + `src/app/(main)/dtf/page.tsx`
- Add server actions `getDtfPageSettings` / `saveDtfPageSettings(introNote, suggestions[])` (upsert into `Settings`, mirroring `saveStoreSettings`).
- Add a **"Customize Page"** tab to the existing DTF admin: edit intro note (textarea) + a repeatable list of suggestion lines; Save.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] In `/dtf` → Customize Page tab, saving an intro note + 3 suggestions persists after reload.
- [ ] Changing an `A3 Print` rate in Price Setup changes the estimate produced by `computeDtfEstimate` (verified on the page in Phase 5).

**Pause here** for confirmation.

---

## Phase 5: Customer Customize page (storefront)
### Changes
#### `src/app/(shop)/customize/page.tsx` (server) + `CustomizeForm.tsx` (client)
- Server page loads: `getDtfPrintableProducts()`, `getDtfPrintOptions()`, `getDtfPageSettings()`.
- Client form:
  - Garment picker (cards/select of printable products) → on select, load variants (size/colour) and set `garmentPrice = variant SellingPrice ?? product SellingPrice`.
  - Qty stepper; print-options multi-select (from `getDtfPrintOptions`).
  - **Multi-file upload** (image/PDF, ≤25 MB) to `/api/upload?folder=designs`, with thumbnails/filenames + remove; require ≥1 design.
  - Customer note textarea.
  - **Live estimate** panel (calls a server action wrapping `computeDtfEstimate`) + a disclaimer: "This is an estimate — the final price may change after we review your artwork."
  - Contact block showing shop WhatsApp/phone (from settings) and the admin-managed suggestions + intro note.
  - Customer details: name, phone, WhatsApp (optional), email (optional), address (optional). Validate name+phone+≥1 design.
- Submit → `createDtfOrder` server action.
#### `src/app/(shop)/customize/actions.ts` (new, server)
- `estimate(input)` → `computeDtfEstimate` (never trust client totals).
- `createDtfOrder(payload)`: re-read garment price + recompute estimate server-side, insert `DtfOrders` (status `Pending`, `StockDeducted=0`, generated `Ref`) + `DtfOrderDesigns` rows in a transaction. **No stock change.** Return `{ id, ref }`.
- Confirmation: redirect to `/customize/submitted?ref=...` (or inline success state) showing the ref + WhatsApp contact.
#### `src/components/shop/StoreHeader.tsx`
- Add a **"Customize"** link (desktop nav `:78` and mobile nav `:128`).
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] `/customize` lists only DTF-printable garments; choosing one shows its sizes/colours and price.
- [ ] Uploading 2 designs (one PNG, one PDF) + selecting prints updates the live estimate; the disclaimer + WhatsApp + suggestions show.
- [ ] Submitting with name+phone+designs creates a Pending `DtfOrders` row (+ design rows) and shows the confirmation ref; **stock is unchanged**.
- [ ] Submitting without a design or phone is blocked with a clear message.

**Pause here** for confirmation.

---

## Phase 6: DTF Orders admin module
### Changes
#### `src/app/(main)/dtf-orders/actions.ts` (new, server)
- `getDtfOrders()` → list with `Ref, CustomerName, CustomerPhone, Status, Qty, EstimatedTotal, FinalTotal, CreatedAt, (design count)`.
- `getDtfOrderDetails(id)` → header + product/variant names (join `Products`/`Sizes`/`Colors`) + `DtfOrderDesigns` + parsed breakdown.
- `updateDtfOrderPricing(id, finalTotal, advanceAmount, adminNote)`.
- `confirmDtfOrder(id)` (transaction): guard `StockDeducted=0` and status not Canceled; if `VariantId` set, validate `Qty <= ProductVariants.Qty` then `UPDATE ProductVariants SET Qty = Qty - @Qty`, insert a `StockHistory` row (`Reason='dtf-order'`), set `Status='Confirmed'`, `StockDeducted=1`, `ConfirmedAt=now`.
- `setDtfOrderStatus(id, status)`: free transitions among `Confirmed/InProduction/Ready/Completed`; **Cancel** → if `StockDeducted=1`, restore `Qty` (+ `StockHistory` `Reason='dtf-cancel'`), set `StockDeducted=0`, `Status='Canceled'`.
- All stock writes guarded so a status can't double-deduct or double-restore.
#### `src/app/(main)/dtf-orders/page.tsx` (new, client)
- Table of requests with status chips; row → detail modal: designs gallery (image thumbnails + PDF download links), customer contact (click-to-WhatsApp), garment+variant+qty, print options, customer note, estimate breakdown, editable Final total + Advance + admin note, and Confirm / status / Cancel buttons. Toasts via `react-hot-toast` (matches `catalog/page.tsx`).
#### `src/components/layout/Sidebar.tsx` + `src/lib/useAuth.ts`
- Add `{ href: "/dtf-orders", label: "DTF Orders", icon: Shirt }` to `navItems`; add `"/dtf-orders"` to `ADMIN_ONLY_ROUTES`.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] `/dtf-orders` lists the request from Phase 5; detail shows designs (PNG preview + PDF link), breakdown, and contact.
- [ ] Editing Final total + Advance persists.
- [ ] **Confirm** decrements the chosen variant's stock (verify in `/stocks` + `/stock-history` shows a `dtf-order` row) and flips status to Confirmed; confirming again does not deduct twice.
- [ ] **Cancel** of a confirmed order restores the stock exactly once.
- [ ] Non-admin users don't see the DTF Orders nav item / are gated.

**Pause here** for confirmation, then run `/validate dtf-printing-module`.

## Testing Strategy
No automated test suite. Each phase's gate is `npm run build` (plus the one-off migration script in Phase 1). Manual verification per phase as listed above. Seed data needed: at least one **active** product marked `IsDtfPrintable` with stocked variants; the seeded `DtfPriceItems` (Garment/Print/Overhead/Profit/Charge) already exist from `db/10_dtf_printing.sql`. Verify stock end-to-end by watching one variant's `Qty` across submit (unchanged) → confirm (−qty) → cancel (+qty) in `/stocks` and `/stock-history`.

## References
- Research: `workflow/research/2026-06-20-dtf-printing-module.md`
- Stock engine to mirror: `src/app/(main)/orders/actions.ts:263` (reduce), `:281` (restore); `src/app/(main)/stocks/actions.ts:176` (StockHistory write).
- Order transaction template: `src/app/(shop)/checkout/actions.ts:48`.
- Admin Source-filtered module template: `src/app/(main)/web-orders/actions.ts`.
- Flag pattern to copy: `db/15_new_arrivals.sql` + `catalog/actions.ts` + `catalog/page.tsx` (New-arrival toggle).
- DTF pricing formula: `db/10_dtf_printing.sql:200`; price items source `db/10_dtf_printing.sql:22`.
- Settings Key/Value pattern: `src/lib/storeSettings.ts` + `src/app/(main)/settings/actions.ts`.
- Upload endpoint: `src/app/api/upload/route.ts:18`.
- Industry standard considered: n/a — followed existing repo conventions (Server Actions + `mssql` transactions, additive SQL migrations, `Orders.Source`-style discrimination via a dedicated table for the offline/reserve-on-confirm flow).
