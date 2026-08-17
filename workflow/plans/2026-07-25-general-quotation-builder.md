---
date: 2026-07-25
slug: general-quotation-builder
status: shipped   # draft | approved | implementing | shipped
surfaces: [dashboard]   # single Next.js app (essencefit-dashboard); Maraebiz three-repo template N/A
research: workflow/research/2026-07-25-general-quotation-builder.md
estimated_manual_effort: 1h 20m
---

# General Quotation Builder — Implementation Plan

## Overview
Add a general-purpose (non-DTF) quotation builder at `/quotations`: enter customer details + free-form line items, save quotes to a new `Quotations` table, and download a branded PDF that pulls our logo and business details from the existing Store Settings. Mirrors the proven DTF Quote Builder + Invoices patterns. No tax/VAT line (per decision).

## Estimated Manual Effort
**1h 20m** — total human-in-the-loop time only: overviewing/reviewing each of the 4 phases, manual verification at each pause (creating a test quote, downloading + eyeballing the PDF, confirming the logo/business block renders), and the final `/validate`. Implementation is by Claude Code, so **no development hours are counted**. Includes a 10% buffer.

## Current State
- **DTF quote pattern to mirror**: `src/app/(main)/dtf/actions.ts:112,126,172` (`getQuotes`/`saveQuote` with `DTF-1001` ref generation/`deleteQuote`) and UI `src/app/(main)/dtf/page.tsx:572` (`QuoteBuilder`). Table `DtfQuotes` DDL at `db/pg/schema.sql:280`.
- **Business logo/details already stored**: `src/lib/storeSettings.ts:138` `getPublicStoreSettings()` returns `storeName`, `logo`/`logoDark`/`logoLight`, `contactPhone`, `contactEmail`, `bank`, `social`. Logo files live under `public/uploads/store/*` (same-origin).
- **PDF pattern**: `src/lib/pdfGenerator.ts` and inline in `src/app/(main)/invoices/page.tsx:30,173` — build HTML string → hidden 210mm container → `html2pdf().set(opt).from(el).save()`. `html2pdf.js` + `pdf-lib` installed. Neither current template renders the logo (they hard-code "EssenceFit" text) — logo/business block is net-new.
- **DB**: Postgres via mssql-compat shim (`src/lib/db.ts` → `getDb()`); lowercase columns mapped back to PascalCase in `src/lib/columnCase.ts` (hand-edited — memory `colmap-generator-stale`).
- **Nav**: static `navItems` array in `src/components/layout/Sidebar.tsx:37`.
- **Gate**: no lint/typecheck npm script (only `dev`/`build`/`start`/`test:e2e`). `next build` touches the live DB + Google Fonts (fragile — memories `dont-load-test-live-db`, `build-needs-ipv4-dns`). Use `npx tsc --noEmit` as the per-phase gate.

## Desired End State
A `/quotations` page (admin) where the owner:
1. fills customer name/phone/optional email+address, adds N line items (description, qty, unit price → auto amount), sets optional discount / other charge, a "Valid Until" date, and notes;
2. sees a live-updating grand total;
3. clicks **Save** → row persisted with an auto `QUO-1001` ref, appears in a "Recent Quotations" list (with delete);
4. clicks **Download PDF** → a branded A4 PDF with our logo + business details (from Store Settings), the itemised table, totals, validity date, and bank details in the footer.

## What We're NOT Doing
- No child `QuotationItems` table — line items live in one `ItemsJson` column.
- No convert-quotation-to-order flow.
- No email/WhatsApp sending of the quote (download only for v1).
- No editing of a saved quote (create + delete only, like DTF quotes); re-create if wrong.
- No changes to the existing Invoices or DTF PDF templates.
- No tax/VAT line at all (dropped by decision).

## Touchpoints (single-repo Next.js app)
- **DB / schema**: new `quotations` table in `db/pg/schema.sql`; new column mappings in `src/lib/columnCase.ts`. (SQL-Server mirror files `db/full_schema.sql` are reference-only; live DB is Postgres.)
- **Server actions**: new `src/app/(main)/quotations/actions.ts` (`"use server"`, async exports only — memory `use-server-async-exports-only`): `getQuotations`, `saveQuotation`, `deleteQuotation`, `getQuotationBusinessInfo` (wraps `getPublicStoreSettings`). Each starts with `await requireAdmin()`.
- **Page/UI**: new `src/app/(main)/quotations/page.tsx` (`"use client"`) — builder form, line-items editor, live totals, save, recent list, PDF download.
- **Nav**: one entry in `src/components/layout/Sidebar.tsx`.
- **Shared constants/types**: keep line-item + business-info types in the page or a plain `.ts` module — never a non-async export from the `"use server"` file.
- **Tenancy note**: single-tenant app; no CompanyKey concept. `requireAdmin()` is the only gate (matches every other admin action).

---

## Phase 1: Data layer — `quotations` table + column map

### Changes
#### Postgres schema — `db/pg/schema.sql`
Append a new table (mirrors `dtfquotes` shape, generalised):
```sql
CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quoteref text NOT NULL,                 -- e.g. QUO-1001
  customername text,
  customerphone text,
  customeremail text,
  customeraddress text,
  itemsjson text,                         -- JSON array: [{description, qty, unitPrice, amount}]
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  othercharge numeric(12,2) NOT NULL DEFAULT 0,
  grandtotal numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  validuntil date,
  status text NOT NULL DEFAULT 'Draft',
  createdat timestamp NOT NULL DEFAULT now()
);
```
Apply the same `CREATE TABLE` against the live Postgres DB using the existing apply path (`db/pg/apply.mjs`) — or run the statement directly. (Live DB == prod; run only this one idempotent DDL, never a load/seed script — memory `dont-load-test-live-db`.)

#### Column map — `src/lib/columnCase.ts`
Add any mappings not already present (hand-edit; do NOT run the generator):
```ts
"quotations": "Quotations",
"customeremail": "CustomerEmail",
"customeraddress": "CustomerAddress",
"itemsjson": "ItemsJson",
"othercharge": "OtherCharge",
"grandtotal": "GrandTotal",
"validuntil": "ValidUntil",
// quoteref, customername, customerphone, subtotal, discount, notes, status, createdat — verify present, add if missing
```

### Success Criteria
#### Automated (deterministic gate)
- [x] Typecheck clean: `npx tsc --noEmit`
#### Manual
- [x] `quotations` table exists in the live Postgres DB (`\d quotations` or a `SELECT` returns 0 rows without error).
- [x] New keys visible in `columnCase.ts`.

**Pause here** for confirmation before writing actions.

---

## Phase 2: Server actions — `src/app/(main)/quotations/actions.ts`

### Changes
#### New `"use server"` actions file (async exports only)
Mirror `dtf/actions.ts`. Types live in a colocated plain module (`src/app/(main)/quotations/types.ts`) or inline in the page — NOT exported as consts from this file.
```ts
"use server";
import { requireAdmin } from "@/lib/adminAuth";
import { getDb, sql } from "@/lib/db";
import { getPublicStoreSettings } from "@/lib/storeSettings";

export async function getQuotations() {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, QuoteRef, CustomerName, CustomerPhone, CustomerEmail, CustomerAddress,
      ItemsJson, Subtotal, Discount, OtherCharge, GrandTotal,
      Notes, ValidUntil, Status, CreatedAt
    FROM Quotations ORDER BY CreatedAt DESC LIMIT 100`);
  return res.recordset;
}

export async function saveQuotation(q: {
  customerName?: string; customerPhone?: string; customerEmail?: string; customerAddress?: string;
  itemsJson: string; subtotal: number; discount: number;
  otherCharge: number; grandTotal: number; notes?: string; validUntil?: string | null;
}) {
  await requireAdmin();
  const pool = await getDb();
  const refRes = await pool.request().query(`
    SELECT COALESCE(MAX(NULLIF(regexp_replace(QuoteRef,'[^0-9]','','g'),'')::int),1000) AS LastNum
    FROM Quotations`);
  const nextNum = (refRes.recordset[0]?.LastNum || 1000) + 1;
  const quoteRef = `QUO-${nextNum}`;
  await pool.request()
    .input("QuoteRef", sql.NVarChar(20), quoteRef)
    .input("CustomerName", sql.NVarChar(150), q.customerName || null)
    .input("CustomerPhone", sql.NVarChar(30), q.customerPhone || null)
    .input("CustomerEmail", sql.NVarChar(150), q.customerEmail || null)
    .input("CustomerAddress", sql.NVarChar(300), q.customerAddress || null)
    .input("ItemsJson", sql.NVarChar(sql.MAX), q.itemsJson)
    .input("Subtotal", sql.Decimal(12,2), q.subtotal)
    .input("Discount", sql.Decimal(12,2), q.discount)
    .input("OtherCharge", sql.Decimal(12,2), q.otherCharge)
    .input("GrandTotal", sql.Decimal(12,2), q.grandTotal)
    .input("Notes", sql.NVarChar(1000), q.notes || null)
    .input("ValidUntil", sql.Date, q.validUntil || null)
    .query(`INSERT INTO Quotations
      (QuoteRef, CustomerName, CustomerPhone, CustomerEmail, CustomerAddress, ItemsJson,
       Subtotal, Discount, OtherCharge, GrandTotal, Notes, ValidUntil)
      VALUES
      (@QuoteRef, @CustomerName, @CustomerPhone, @CustomerEmail, @CustomerAddress, @ItemsJson,
       @Subtotal, @Discount, @OtherCharge, @GrandTotal, @Notes, @ValidUntil)`);
  return quoteRef;
}

export async function deleteQuotation(id: string) {
  await requireAdmin();
  const pool = await getDb();
  await pool.request().input("Id", sql.UniqueIdentifier, id)
    .query(`DELETE FROM Quotations WHERE Id=@Id`);
  return true;
}

export async function getQuotationBusinessInfo() {
  await requireAdmin();
  const s = await getPublicStoreSettings();
  return {
    storeName: s.storeName, logo: s.logoDark || s.logo || s.logoLight,
    contactPhone: s.contactPhone, contactEmail: s.contactEmail, bank: s.bank,
  };
}
```
Confirm `sql.Date` exists in `src/lib/sqlShim.ts`; if not, store `validuntil` as `NVarChar` and cast, or use `sql.DateTime2`.

### Success Criteria
#### Automated
- [x] Typecheck clean: `npx tsc --noEmit`
#### Manual
- [x] (Deferred to Phase 3, since actions are only reachable from the page.)

**Pause here** for review before building the UI.

---

## Phase 3: Builder page + nav — `src/app/(main)/quotations/page.tsx`

### Changes
#### New client page (mirror DTF `QuoteBuilder` + Invoices styling)
- Customer fields: name, phone, email (optional), address (optional), "Valid Until" date.
- **Line items editor**: repeatable rows `{ description, qty, unitPrice }`, computed `amount = qty * unitPrice`; add/remove row buttons.
- **Totals panel** (live `useMemo`): `subtotal = Σ amount`; `grandTotal = subtotal - discount + otherCharge`. Discount / otherCharge are optional inputs (default 0).
- **Save** → `saveQuotation({...})` with `itemsJson = JSON.stringify(items)`; toast the returned `QUO-####`; reload list.
- **Recent Quotations** table (from `getQuotations`) with ref, customer, grand total, date, delete button (`deleteQuotation`), and a **Download PDF** button per row (Phase 4 wires the actual generation).
- Follow the dark/light Tailwind classes used in `invoices/page.tsx`.

#### Nav — `src/components/layout/Sidebar.tsx`
Add after Invoices (`:52`), reusing an imported lucide icon (e.g. `FileText` or `ClipboardList`, already imported):
```ts
{ href: "/quotations", label: "Quotations", icon: FileText },
```

### Success Criteria
#### Automated
- [x] Typecheck clean: `npx tsc --noEmit`
#### Manual
- [ ] `/quotations` loads; "Quotations" appears in the sidebar.
- [ ] Add 2–3 line items → subtotal and grand total update live and correctly.
- [ ] Save → a `QUO-####` toast shows and the quote appears in Recent Quotations.
- [ ] Delete removes it.

**Pause here** for manual-test confirmation before wiring the PDF.

---

## Phase 4: Branded PDF with logo + business details

### Changes
#### PDF template + download (self-contained in the page, like `invoices/page.tsx:173`)
- `generateQuotationHTML(quote, business)` builds an A4 HTML string:
  - **Header**: `<img src="${business.logo}">` (same-origin `/uploads/store/...`) when set, else `<h1>${business.storeName}</h1>`; plus phone/email; title "QUOTATION" and the `QuoteRef`.
  - **Bill-To** block: customer name/phone/email/address.
  - **Meta**: date, "Valid Until".
  - **Items table**: description / qty / unit price / amount.
  - **Totals**: subtotal, discount (if >0), other charge (if >0), grand total.
  - **Footer**: notes + bank details (`business.bank`) + thank-you line.
- `downloadQuotationPDF(...)`: same hidden-container + `html2pdf().set(opt).from(el).save()` flow as `invoices/page.tsx` (opts: `jsPDF a4 portrait`, `html2canvas { scale:2, useCORS:true, backgroundColor:"#ffffff" }`), filename `quotation_<customer>_<ref>.pdf`.
- Wire the per-row **Download PDF** button: call `getQuotationBusinessInfo()`, parse `ItemsJson`, render, download. Also allow downloading the just-built quote before saving (optional convenience).

### Success Criteria
#### Automated
- [x] Typecheck clean: `npx tsc --noEmit`
- [x] Full build passes: `NODE_OPTIONS=--dns-result-order=ipv4first npx next build` (final phase only; expect it to hit the live DB/fonts — run once, carefully).
#### Manual
- [ ] Download PDF on a saved quote → A4 PDF opens with the store **logo** (or name) and contact/business details in the header.
- [ ] Itemised table, discount/other lines, and grand total match the on-screen totals.
- [ ] "Valid Until" date and bank details render; filename contains the `QUO-####` ref.
- [ ] With no logo set in Store Settings, header cleanly falls back to the store name.

**Pause here** — feature complete; proceed to `/validate`.

---

## Testing Strategy
No automated test suite. Verification is manual per phase (above). Key data setup: ensure Store Settings has a logo + contact + bank details populated before Phase 4 so the branded block is exercised; also test the no-logo fallback. Do not run the E2E suite or any seeding against `.env.local` — it is the live prod DB (memory `dont-load-test-live-db`). The only DB write during dev is the single idempotent `CREATE TABLE`.

## References
- Research: `workflow/research/2026-07-25-general-quotation-builder.md`
- Patterns to follow: `src/app/(main)/dtf/actions.ts:126` (save+ref), `src/app/(main)/dtf/page.tsx:572` (builder UI), `src/app/(main)/invoices/page.tsx:173` (PDF download), `src/lib/storeSettings.ts:138` (business details), `db/pg/schema.sql:280` (table shape), `src/lib/columnCase.ts` (column map).
- Industry standard considered: n/a — followed existing repo conventions (server actions + `getDb` shim + client-side `html2pdf.js`), which already match how quotes/invoices/PDFs are done here.
- Conventions enforced: `"use server"` async-only exports (`use-server-async-exports-only`), masked prod errors (`server-action-errors-masked`), hand-edited `columnCase.ts` (`colmap-generator-stale`), build DNS flag (`build-needs-ipv4-dns`), live-DB caution (`dont-load-test-live-db`).
