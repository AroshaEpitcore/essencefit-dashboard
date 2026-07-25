---
date: 2026-07-25
topic: "General quotation builder (beyond DTF): capture line items + customer details, pull business logo & details from the system, download as PDF"
repo_commit: 393ed65
repo: essencefit-dashboard (single Next.js app; Maraebiz three-repo template not applicable)
status: complete
tags: [research, quotation, pdf, settings, dtf, invoices]
---

# Research: General Quotation Builder

## Research Question
The system has a DTF-specific Quote Builder. We want a **general** quotation builder (not tied to DTF garment/print costing) that:
- captures arbitrary **line items** and **customer details**,
- stamps the quote with **our business logo and details** already stored in the system,
- can be **downloaded as a PDF**.

This document maps what already exists to model that on. (No changes proposed here — that's the Plan phase.)

## Summary
Everything needed to build a general quotation builder already exists as reusable patterns in this repo:

1. **A quote feature to mirror** — the DTF Quote Builder (`/dtf` → "Quote Builder" tab) with its `DtfQuotes` table, ref generator (`DTF-1001`), and `saveQuote`/`getQuotes`/`deleteQuote` server actions. The general version is the same shape minus the DTF-specific cost fields, plus a flexible line-items array.
2. **Business logo & details are already in the system** — the generic `Settings` key/value table, typed via `src/lib/storeSettings.ts` (`getPublicStoreSettings()`): `storeName`, `logo`/`logoDark`/`logoLight`, `contactPhone`, `contactEmail`, `bank` (bank/account details), `social`. Edited in Store Settings and saved by `saveStoreSettings`.
3. **PDF download is already solved** — `html2pdf.js` (client-side, dynamic import) is used in two places: `src/lib/pdfGenerator.ts` and inline in `src/app/(main)/invoices/page.tsx`. Pattern: build an HTML string → mount a hidden 210mm container → `html2pdf().set(opt).from(element).save()`. `pdf-lib` is also installed.

So the build is essentially: **new table + server actions (mirror DTF quotes)** + **new `/quotations` page with a line-items editor** + **a PDF template that reads `getPublicStoreSettings()` for the logo/business block** + **a Sidebar entry**.

## Detailed Findings

### Data layer (PostgreSQL via mssql-compat shim)
- DB access goes through `src/lib/db.ts` → `getDb()` returns an mssql-style pool facade backed by `pg` (`src/lib/sqlShim.ts`). Callers do `const pool = await getDb(); pool.request().input("X", sql.Type, v).query("... @X")`.
- **Postgres folds identifiers to lowercase**; the shim maps lowercase columns back to PascalCase via `src/lib/columnCase.ts`. Existing entries include `"dtfquotes": "DtfQuotes"` and `"quoteref": "QuoteRef"` (`src/lib/columnCase.ts:98,232`). ⚠️ Per project memory, `columnCase.ts` must be **hand-edited** — never run the generator (it drops needed entries). A new `quotations` table + any new columns will need entries added here.
- Live schema lives in `db/pg/schema.sql` (Postgres). `db/full_schema.sql` and `db/10_dtf_printing.sql` are the SQL-Server-flavoured originals kept for reference.

### The DTF Quote Builder — the pattern to mirror
- **UI**: `src/app/(main)/dtf/page.tsx` — `QuoteBuilder` component (`:572`), tab registered at `:95` (`{ key: "builder", label: "Quote Builder", icon: Calculator }`). It has a build form, live totals, a WhatsApp/Sinhala message generator (`msgMode` "quote"/"advance", `:591`), a save button (`:702` → `saveQuote`), and a "Recent Quotes" table with delete (`:987`–`:1013`).
- **Server actions**: `src/app/(main)/dtf/actions.ts`
  - `getQuotes()` (`:112`) — `SELECT ... FROM DtfQuotes ORDER BY CreatedAt DESC LIMIT 100`.
  - `saveQuote(q)` (`:126`) — generates the next ref (`SELECT COALESCE(MAX(NULLIF(regexp_replace(QuoteRef,'[^0-9]','','g'),'')::int),1000)+1` → `DTF-<n>`), then parameterized `INSERT`.
  - `deleteQuote(id)` (`:172`).
  - Every action starts with `await requireAdmin()` (`src/lib/adminAuth.ts`).
- **Table**: `DtfQuotes` — Postgres DDL at `db/pg/schema.sql:280`; SQL-Server DDL at `db/10_dtf_printing.sql:46` and `db/full_schema.sql:479`. Columns are DTF-costing-specific (GarmentCost, PrintCost, Packaging, Utilities, Profit, UnitPrice, Extra, FinalTotal, AdvancePct, AdvanceAmount) plus a free-form `BreakdownJson NVARCHAR(MAX)`. A **general** quote wants generic line items instead — either a child `QuotationItems` table or a JSON column like the existing `BreakdownJson`.

### Business logo & details already stored (the "our details" source)
- `src/lib/storeSettings.ts` — typed wrapper over the generic `Settings` key/value table.
  - `getPublicStoreSettings(): Promise<StoreSettings>` (`:138`) reads all `Settings` rows and returns a typed object.
  - Relevant fields for a quotation header/footer: `storeName` (`:82` default "EssenceFit"), `logo`/`logoDark`/`logoLight` (`:52`–`:54`), `contactPhone`, `contactEmail` (`:57`–`:58`), `bank: {bank, accountName, accountNo, branch}` (`:7`–`:12`), `social` (`:24`–`:29`).
  - Keys map at `STORE_KEYS` (`:64`): e.g. `store_logo`, `store_name`, `contact_phone`, `bank_details`.
- **Writes** live in `src/app/(main)/settings/actions.ts` (`saveStoreSettings`), edited in `src/app/(main)/store-settings/page.tsx`. So the owner already uploads a logo and business details there — the quotation PDF just needs to *read* them.
- Uploaded logo/image files land under `public/uploads/store/*.png` (same-origin, so `useCORS` in html2canvas resolves them fine).

### PDF generation — already solved with html2pdf.js
- Dependencies present: `html2pdf.js@^0.12.1` and `pdf-lib@^1.17.1` (package.json).
- `src/lib/pdfGenerator.ts` (client, `"use client"`): `generatePrintableHTML(data)` builds a styled invoice HTML string; `downloadPDF(data)`/`generatePDFBlob(data)` mount it in a hidden `210mm` container, wait for `document.fonts.ready` + rAF, then `html2pdf().set(opt).from(element).save()` / `.output("blob")`. Options use `jsPDF: { unit:"mm", format:"a4", orientation:"portrait" }` and `html2canvas: { scale:2, useCORS:true, backgroundColor:"#ffffff" }` (`:178`–`:190`).
- `src/app/(main)/invoices/page.tsx` repeats the same pattern **inline and self-contained** (`generateInvoiceHTML` `:30`, `downloadInvoicePDF` `:173`), plus a server action `generateInvoicePDF(orderId)` in `src/app/(main)/orders/invoiceActions.ts:8` that assembles the data (order + items + totals) for the client to render. This invoices module is the **closest existing analogue** to a quotation PDF — a quotation is essentially an invoice-style document with "Quotation" branding, a validity date, and manually-entered line items instead of order lines.
- Note: neither existing PDF template currently renders the store logo/business block — they hard-code "EssenceFit" text in the header/footer (`pdfGenerator.ts:114`, `invoices/page.tsx:158`). Pulling logo/details from `getPublicStoreSettings()` into the template is net-new (and is exactly the "add my logo and details" requirement).

### Navigation
- Sidebar items are a static `navItems` array in `src/components/layout/Sidebar.tsx:37`. A general quotation builder would add one entry here (e.g. `{ href: "/quotations", label: "Quotations", icon: FileText }`). Admin-only visibility is controlled by `ADMIN_ONLY_ROUTES` in `src/lib/useAuth.ts`.

## Cross-cutting conventions to honour (from code + project memory)
- **`"use server"` files: async function exports only.** A `const`/object export from a `"use server"` file crashes the whole module as a masked prod 500 (this caused the `/web-orders` outage). Keep shared constants/types in a plain module. (memory: `use-server-async-exports-only`)
- **Server-action errors are masked in prod.** Don't rely on thrown `Error` messages reaching the client — return `{ ok:false, error }` (UserFacingError pattern). (memory: `server-action-errors-masked`)
- **Every admin action calls `await requireAdmin()` first** (`src/lib/adminAuth.ts`).
- **Don't run load/E2E against `.env.local`** — it points at the live prod Supabase DB. (memory: `dont-load-test-live-db`)
- **`columnCase.ts` is hand-maintained** — add new table/column mappings manually. (memory: `colmap-generator-stale`)
- **Build needs IPv4 DNS**: `NODE_OPTIONS=--dns-result-order=ipv4first` for `npm run build`. (memory: `build-needs-ipv4-dns`)

## Code References
- `src/app/(main)/dtf/page.tsx:572` — `QuoteBuilder` component (UI pattern to mirror)
- `src/app/(main)/dtf/actions.ts:112,126,172` — `getQuotes` / `saveQuote` (ref generation) / `deleteQuote`
- `db/pg/schema.sql:280` — `dtfquotes` Postgres DDL (table shape to adapt)
- `src/lib/storeSettings.ts:138` — `getPublicStoreSettings()` (logo + business details source)
- `src/lib/storeSettings.ts:46,64` — `StoreSettings` type & `STORE_KEYS`
- `src/app/(main)/settings/actions.ts` — `saveStoreSettings` (where logo/details are written)
- `src/lib/pdfGenerator.ts:160,202` — `generatePDFBlob` / `downloadPDF` (html2pdf flow)
- `src/app/(main)/invoices/page.tsx:30,173` — inline HTML template + `downloadInvoicePDF` (closest analogue)
- `src/app/(main)/orders/invoiceActions.ts:8` — server action assembling PDF data
- `src/lib/db.ts:10` / `src/lib/sqlShim.ts` — DB facade
- `src/lib/columnCase.ts:98,232` — lowercase→PascalCase column map (hand-edit)
- `src/components/layout/Sidebar.tsx:37` — nav registration

## Architecture / Conventions Observed
- Feature = a route folder under `src/app/(main)/<feature>/` with a `"use client"` `page.tsx` and a colocated `"use server"` `actions.ts`; DB access via `getDb()`; admin gating via `requireAdmin()`.
- Persistent config lives in the generic `Settings` key/value table, wrapped by typed helpers (`storeSettings.ts`, `dtfSettings.ts`) with an `INSERT ... ON CONFLICT (key) DO UPDATE` upsert (`dtf/actions.ts:276`).
- PDFs are generated **client-side** from an HTML string via `html2pdf.js` (dynamic-imported to dodge SSR); server actions only assemble the data.

## Related Prior Work (from workflow/)
- `workflow/research/2026-06-20-dtf-printing-module.md` and `workflow/plans/2026-06-20-dtf-printing-module.md` — how the DTF Quote Builder + `DtfQuotes` were designed; the direct precedent for this feature.
- No prior research/plan exists for a *general* (non-DTF) quotation builder — this is net-new.

## Open Questions (for the Plan phase, not answered here)
- **Line items storage**: dedicated `QuotationItems` child table vs. a single `ItemsJson` column on `Quotations` (mirrors the existing `BreakdownJson` approach). Affects querying/reporting later.
- **Totals model**: subtotal / discount / tax(?) / delivery / grand total — which of these the business actually quotes. Sri Lanka context; existing invoices have no VAT/tax line today.
- **Logo in PDF**: whether to embed the stored logo as a `<img src="/uploads/store/...">` (same-origin, works with `useCORS`) or inline a base64 data-URI for reliability across environments.
- **Reference scheme**: `QUO-1001` style, mirroring the DTF `DTF-1001` generator.
- **Validity / expiry date** on quotations (standard on quotes; absent from invoices).
- **Convert-to-order**: whether an accepted quotation should later seed an Order (out of scope for v1 unless wanted).
