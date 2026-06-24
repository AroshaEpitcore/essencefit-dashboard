---
date: 2026-06-23
slug: supabase-migration
status: implementing
surfaces: [data-layer, schema, hosting]
research: workflow/research/2026-06-23-supabase-migration.md
estimated_manual_effort: 8h 15m
---

# SQL Server → Supabase (PostgreSQL) Migration — Implementation Plan

## Overview
Migrate `essencefit-dashboard` off Microsoft SQL Server onto Supabase (managed
PostgreSQL) so it can be hosted for $0, keeping the app's structure and behaviour
intact. Strategy: a **compatibility shim** in `src/lib/db.ts` that preserves the existing
`.request().input().query() → .recordset` API (so the ~200 call-sites keep their shape),
plus **per-query T-SQL→PostgreSQL translation** of the SQL strings, plus a translated
Postgres schema.

## Estimated Manual Effort
**8h 15m** — human-in-the-loop time only (Claude Code does the implementation): exporting
the desktop schema, reviewing each phase's diff, manually testing the storefront / checkout
/ orders / stock / DTF flows at each pause, and the final `/validate`. Includes a 10% buffer.

## Current State
- All DB access funnels through one `mssql` pool (`src/lib/db.ts:1-22`,
  `encrypt:false, trustServerCertificate:true`).
- **39 files / ~200+ call-sites** use the `request().input(name, sql.Type, value)` +
  `@param` + `result.recordset` pattern; `sql` is imported from `"mssql"` in ~30 files for
  type markers (`sql.NVarChar`, `sql.UniqueIdentifier`, `sql.MAX`) and `sql.Transaction`
  (8 files). Canonical example `src/lib/auth.ts:11-31`; upsert via `MERGE`
  `src/app/(main)/settings/actions.ts:40-47`.
- Schema is T-SQL: `UNIQUEIDENTIFIER`/`NEWID()`, `NVARCHAR`, `DATETIME2`, `BIT`,
  `DECIMAL`/`MONEY`; one scalar UDF `dbo.fn_StockVariantId` (`db/18_shared_stock.sql:24-42`);
  0 stored procs/triggers/views.
- **Base schema is NOT in git** — `db/00_init.sql`…`db/09_sprocs.sql`, `db/seed.sql` are
  0 bytes; only patches `db/10`…`db/22` have content and they `ALTER` tables that live only
  on the desktop SQL Express instance.
- Test harness (`test/db/reset.mjs`) is SQL Server-specific (`DBCC CLONEDATABASE`).
- Deterministic gate available: `npm run build` (`next build --turbopack`).

## Desired End State
- App runs against a Supabase Postgres database via a Postgres driver, with **no `mssql`
  dependency** remaining.
- `npm run build` is green; every user flow (storefront browse, login/register, checkout,
  admin orders, stock, DTF orders, dashboard/reports, settings) works against Supabase when
  manually exercised.
- A reproducible Postgres schema lives in `db/pg/` and provisions a fresh Supabase project.
- App deployable to Vercel free with Supabase env vars.

## What We're NOT Doing
- **Not** adopting the Supabase JS client, PostgREST, Supabase Auth, RLS, or realtime —
  Supabase is used purely as **plain Postgres via its connection string**. (Can be a later
  follow-up.)
- **Not** rewriting call-sites to idiomatic positional `$1` params — the shim preserves the
  `.input()/@param/.recordset` API on purpose (clean `pg` rewrite was the rejected
  alternative; see References).
- **Not** porting the full automated test suite to Postgres in this plan beyond making
  `npm run build` green and a minimal seed run; the vitest/playwright harness rework
  (`test/db/reset.mjs`) is tracked separately under the automated-testing-coverage work.
- **Not** migrating historical production data by default — schema-first. Data ETL is an
  explicit decision in Phase 4.

## Touchpoints
- **Connection/shim**: `src/lib/db.ts` (rewrite to Postgres + compat builder), new
  `src/lib/sqlShim.ts` (`sql` type-marker + `Transaction` stand-in), `db/apply.mjs` &
  `test/db/reset.mjs` (Postgres-aware).
- **Schema**: new `db/pg/schema.sql` (translated base + patches consolidated), new
  `db/pg/functions.sql` (`fn_StockVariantId` as plpgsql), `db/pg/seed_test.sql`.
- **Query bodies**: all 28 `src/app/**/actions.ts` + `src/lib/*.ts` DB consumers
  (storefront, auth, customerAuth, dtfPricing, dtfSettings, storeSettings,
  getNotifications, storefront, sitemap, invoiceActions).
- **Env/deploy**: `.env.local`/`.env.test`/Vercel — `DATABASE_URL` (Supabase pooled conn),
  drop `DB_USER/DB_PASSWORD/DB_SERVER/DB_NAME` or map them; keep `SESSION_SECRET`,
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

---

## Phase 0: Export desktop schema & create Supabase project (prerequisite)
### Changes
#### Manual — export schema-only from desktop SQL Express
SSMS → database → Tasks → Generate Scripts → entire database → Advanced → "Types of data
to script = Schema only", "Script USE DATABASE = False" → save as `db/full_schema.sql`.
(Choose "Schema and data" if existing products/lookups should be carried — see Phase 4.)
#### Manual — create Supabase project
supabase.com → New project → record the **connection string** (use the **pooled** /
"Transaction" connection on port 6543 for serverless) → becomes `DATABASE_URL`.
### Success Criteria
#### Automated
- [ ] `db/full_schema.sql` exists and is non-empty (`wc -c db/full_schema.sql` > 0).
#### Manual
- [ ] Supabase project reachable with the connection string (e.g. `psql "$DATABASE_URL" -c "select 1"`).

**Pause here** — Phases 1+ are blocked until `full_schema.sql` exists.

---

## Phase 1: Postgres driver + compatibility shim
### Changes
#### `src/lib/sqlShim.ts` (new) — `sql` type markers + Transaction stand-in
Export a default `sql` object whose members (`NVarChar`, `NChar`, `Int`, `Decimal`,
`DateTime2`, `Bit`, `UniqueIdentifier`, `MAX`, `Float`, `BigInt`) are no-op marker
functions/values, plus a `Transaction` class wrapping the pg transaction API, so the ~30
files that `import sql from "mssql"` only need their import path swapped.
#### `src/lib/db.ts` — replace `mssql` with `postgres.js`
```ts
import postgres from "postgres";
const client = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 5 });

// Compat builder: preserves .request().input(name,_type,value).query(text) → {recordset}
function request() {
  const params: unknown[] = [];
  const named: Record<string, number> = {};
  const api = {
    input(name: string, _type: unknown, value: unknown) {
      if (!(name in named)) { params.push(value); named[name] = params.length; }
      else params[named[name] - 1] = value;
      return api;
    },
    async query(text: string) {
      const sqlText = text.replace(/@(\w+)/g, (_m, n) => `$${named[n]}`);
      const rows = await client.unsafe(sqlText, params);
      return { recordset: rows, rowsAffected: [rows.count ?? rows.length] };
    },
    batch(text: string) { return api.query(text); },
  };
  return api;
}
export async function getDb() { return { request, /* transaction factory */ }; }
```
(Transaction flows use `client.begin(async tx => …)` wrapped to expose `.request()/.commit()/.rollback()` semantics the 8 callers expect.)
#### Swap imports — `from "mssql"` → `from "@/lib/sqlShim"`
Mechanical replace across all ~30 files (verified by build).
#### `package.json` — remove `mssql`/`@types/mssql`, add `postgres`.
### Success Criteria
#### Automated
- [~] `npm run build`: TypeScript + compilation fully green; static prerender step requires a reachable DB (blocked until Phase 2 schema + DATABASE_URL). Driver used: `pg` (not postgres.js — imperative transaction API; see note below).
- [x] `grep -r "from \"mssql\"" src/` returns nothing.

> Phase 1 deviations/notes:
> - Driver = `pg` (node-postgres), not `postgres.js` — the codebase's imperative `new sql.Transaction(pool)`/`begin()/commit()` pattern maps cleanly to `pg`'s client BEGIN/COMMIT, not postgres.js's callback-scoped transactions.
> - Shim = `src/lib/sqlShim.ts` (preserves `.input()/.query()/.recordset`, `sql.<Type>` markers, `Transaction`/`Request`); `src/lib/db.ts` rewritten + re-exports `sql`.
> - Collateral fixes needed to reach a green compile (unrelated to the data layer, flagged for review): restored `@react-google-maps/api` to package.json (was installed-but-unsaved); excluded the SQL-Server-coupled, untracked test harness (`test/`, `playwright.config.ts`, `vitest.config.ts`) from `tsconfig` — it imports `mssql` and uninstalled deps and is tracked under the separate testing-coverage plan; fixed pre-existing recharts 3.6.0 `Tooltip` formatter type errors in `dashboard/page.tsx` + `analysis/page.tsx` (params are `number|undefined` / `string|undefined` in recharts 3.6.0).
> - `.env.local`: added `DATABASE_URL` (txn pooler 6543) + `DIRECT_URL` (session pooler 5432) — password placeholder to be filled by owner.
#### Manual
- [ ] App boots (`npm run dev`); login page loads and a trivial read (e.g. storefront
  categories) returns without a driver error against an empty Supabase DB (expect empty
  results, not a crash).

**Pause here** for confirmation before translating query bodies.

---

## Phase 2: Translate the Postgres schema & provision Supabase
### Changes
#### `db/pg/schema.sql` (new) — consolidated, translated DDL
Translate `db/full_schema.sql` + patches `db/10`…`db/22` into one idempotent Postgres
script: `UNIQUEIDENTIFIER`→`uuid` (`default gen_random_uuid()`), `NVARCHAR(n)`→`text`/`varchar(n)`,
`DATETIME2`→`timestamptz`, `BIT`→`boolean`, `MONEY`→`numeric(18,2)`; `NEWID()`→`gen_random_uuid()`,
`SYSUTCDATETIME()`/`GETDATE()`→`now()`; DDL guards (`IF OBJECT_ID`/`COL_LENGTH`/`sys.indexes`)
→ `CREATE TABLE/INDEX IF NOT EXISTS` & `ADD COLUMN IF NOT EXISTS`; drop all `GO`.
#### `db/pg/functions.sql` (new) — `fn_StockVariantId` as `plpgsql`/`sql` function.
#### `db/apply.mjs` — Postgres runner
Swap to `postgres.js`, drop `GO`-splitting (Postgres runs the file as statements).
### Success Criteria
#### Automated
- [ ] `node db/apply.mjs db/pg/schema.sql` then `db/pg/functions.sql` run clean against Supabase.
- [ ] All expected tables exist (`psql "$DATABASE_URL" -c "\dt"` lists Users, Products,
  Categories, Customers, Orders, Colors, Sizes, Variants, ProductImages, DtfOrders, … ).
#### Manual
- [ ] Spot-check key tables' columns match the app's expectations (e.g. `Orders` has
  `Source, CustomerEmail, PaymentVerified, Province, StockDeducted`).

**Pause here** for confirmation the schema is correct before mass query edits.

---

## Phase 3: Translate read-path T-SQL (storefront, catalog, reports, dashboard)
### Changes
Translate T-SQL inside query strings (the shim already handles params/results) across the
read-heavy files: `src/lib/storefront.ts`, `src/app/(main)/catalog/actions.ts`,
`(main)/dashboard/actions.ts`, `(main)/analysis/actions.ts`, `(main)/reports/actions.ts`,
`(main)/inventory/actions.ts`, `(main)/stock-history/actions.ts`, `app/sitemap.ts`,
`src/lib/getNotifications.ts`, `src/lib/storeSettings.ts`.
Translations: `TOP n`→`LIMIT n` (and `TOP (@n)`→`LIMIT $n` form), `OFFSET…FETCH NEXT`→
`LIMIT…OFFSET`, `ISNULL`→`COALESCE`, `GETDATE()/SYSUTCDATETIME()`→`now()`, `DATEADD(d,-7,…)`→
`now() - interval '7 days'`, `FORMAT(x,'yyyy-MM')`→`to_char(x,'YYYY-MM')`,
`DATENAME/DATEPART(WEEKDAY,…)`→`to_char(…, 'Day')`/`extract(dow …)`, `CONVERT/CAST`→`::type`,
`[Bracket]`→`"Bracket"`. `CASE`, CTEs, `FULL OUTER JOIN`, `STRING_AGG` unchanged.
### Success Criteria
#### Automated
- [ ] `npm run build` green.
#### Manual
- [ ] Against a Supabase DB seeded with a few products: storefront home, category page,
  product quick-view, search, and the admin **dashboard + a report** render correct numbers.

**Pause here** for confirmation.

---

## Phase 4: Translate write-path T-SQL + transactions (orders, checkout, stock, DTF, settings)
### Changes
Translate the write/transactional files: `(main)/orders/actions.ts`,
`(shop)/checkout/actions.ts`, `(main)/stocks/actions.ts`, `(main)/sales/actions.ts`,
`(main)/returns/actions.ts`, `(main)/dtf-orders/actions.ts`, `(shop)/customize/actions.ts`,
`(main)/web-orders/actions.ts`, `(main)/dispatch/actions.ts`, `(main)/finance/actions.ts`,
`(main)/expenses/actions.ts`, `(main)/users/actions.ts`, `(main)/customers/actions.ts`,
`(main)/color-requests/actions.ts`, `(main)/settings/actions.ts`, `(main)/dtf/actions.ts`,
`(shop)/account/actions.ts`, `(auth)/login|register/actions.ts`, `src/lib/auth.ts`,
`src/lib/customerAuth.ts`, `src/lib/dtfPricing.ts`, `src/lib/dtfSettings.ts`,
`orders/invoiceActions.ts`.
Translations: `MERGE`→`INSERT … ON CONFLICT (key) DO UPDATE` (settings, dtf page settings),
`OUTPUT INSERTED.Id`→`RETURNING Id`, `SCOPE_IDENTITY()`→`RETURNING`, `WITH (UPDLOCK)`→
`FOR UPDATE`, plus the read-path translations above. Convert the 8 `new sql.Transaction(pool)`
flows to the shim's transaction wrapper.
### Success Criteria
#### Automated
- [ ] `npm run build` green.
- [ ] `grep -rE "MERGE |OUTPUT INSERTED|SCOPE_IDENTITY|UPDLOCK|GETDATE\(|SYSUTCDATETIME|ISNULL\(| TOP " src/` returns nothing.
#### Manual
- [ ] End-to-end: register/login (admin + customer), create an admin order (stock deducts),
  web checkout, a DTF order, a return, and a settings save — all succeed against Supabase.

**Pause here** for confirmation.

---

## Phase 5: Data migration (optional) + deploy to Vercel
### Changes
#### (Optional) data ETL — only if Phase 0 chose "Schema and data"
Move desktop data into Supabase (e.g. `pgloader`-style export/transform, or per-table CSV
export → `\copy`), mapping `UNIQUEIDENTIFIER`→`uuid`, `BIT`→`boolean` etc.
#### Vercel deploy
Push branch → import to Vercel → set env vars (`DATABASE_URL`, `SESSION_SECRET`,
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) → deploy → add `essencefits.com` → update Hostinger DNS.
### Success Criteria
#### Automated
- [ ] Vercel production build succeeds.
#### Manual
- [ ] Production URL serves the storefront against Supabase; a test order completes end-to-end.
- [ ] (If data migrated) row counts for Products/Orders/Customers match the desktop source.

**Pause here** — final confirmation, then `/validate supabase-migration`.

---

## Testing Strategy
No green automated suite covers the DB layer yet (the vitest/playwright harness +
`test/db/reset.mjs` are SQL Server-specific and tracked separately). The gate for this plan
is `npm run build` plus the **manual flow checks** listed per phase against a Supabase DB
seeded with a small dataset (translate `db/seed_test.sql` → `db/pg/seed_test.sql` during
Phase 2). Reworking `test/db/reset.mjs` to provision a Postgres test DB is a fast-follow,
not a blocker for cutover.

## References
- Research: `workflow/research/2026-06-23-supabase-migration.md`
- Patterns to follow: `src/lib/auth.ts:11-31` (call-site shape the shim preserves),
  `src/app/(main)/settings/actions.ts:40-47` (`MERGE`→`ON CONFLICT`),
  `db/18_shared_stock.sql:24-42` (UDF to port).
- Industry standard considered: idiomatic migrations swap `mssql`→`pg`/`postgres.js` with
  positional `$1` params (cleaner, but rewrites every line of 200+ sites). This plan instead
  keeps a thin compat shim to minimise churn/risk, accepting slightly less idiomatic code —
  a deliberate trade chosen because the app has no abstraction layer and no green test suite
  to catch a 200-site mechanical rewrite. `postgres.js` (`client.unsafe(text, params)`) is
  the chosen driver; Supabase is used as plain Postgres via its pooled connection string
  (Supabase docs: "Connecting to your database" — Transaction pooler, port 6543).
