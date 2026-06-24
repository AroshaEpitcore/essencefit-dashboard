---
date: 2026-06-23
topic: "Migrating essencefit-dashboard from Microsoft SQL Server to Supabase (PostgreSQL) for free hosting, while keeping the existing database and code working"
repo_commit: 6d409fa
branch: research/supabase-migration
status: complete
tags: [research, database, migration, supabase, postgres, mssql, hosting]
---

# Research: SQL Server → Supabase (PostgreSQL) migration

## Research Question
Can `essencefit-dashboard` be hosted for free on Supabase while keeping the existing
database and code working? What does the current Microsoft SQL Server data layer
(`mssql` driver, T-SQL schema, stored logic, all `actions.ts` files) consist of, and
what would a Supabase/Postgres migration concretely require?

## Summary

**Supabase is PostgreSQL; this app is hardwired to Microsoft SQL Server.** Moving to
Supabase is **not a hosting/config change — it is a full data-layer rewrite.** Every
layer of DB access is SQL Server-specific:

- **Driver:** `mssql` (`src/lib/db.ts`) with the `request().input(name, sql.Type, value).query("... @param ...")` named-parameter pattern and `result.recordset` reads. Postgres drivers (`pg` / `postgres.js`) use **positional `$1` params** and `result.rows` — incompatible at **every one of ~200+ call-sites** across **39 files** (28 of them `actions.ts`).
- **Schema:** T-SQL types (`UNIQUEIDENTIFIER`/`NEWID()`, `NVARCHAR`, `DATETIME2`, `BIT`, `MONEY`) and SQL Server-only DDL guards (`IF OBJECT_ID`, `COL_LENGTH`, `sys.indexes`, `GO` batches). Must be translated to Postgres DDL.
- **Queries:** Heavy use of T-SQL-only constructs — `TOP n`, `OFFSET…FETCH NEXT`, `MERGE`, `OUTPUT INSERTED`, `SCOPE_IDENTITY()`, `ISNULL` (50+), `GETDATE()`/`SYSUTCDATETIME()` (30+), `DATEADD`/`DATENAME`/`DATEPART`, `FORMAT()`, `TRY_CONVERT`, `CONVERT`, `WITH (UPDLOCK)`, `[bracket]` identifiers.

**There is no clean "keep both alive" path.** The dialects diverge at almost every
call-site, and all DB access funnels through one module (`src/lib/db.ts`), so you cannot
run SQL Server and Postgres side-by-side without maintaining two query sets. Realistic
options are a **big-bang data-layer rewrite** or **abandoning the Supabase idea** and
using a managed **SQL Server** cloud DB instead (Azure SQL free offer = zero code change —
see [[hosting-and-db-setup]]).

**Two hard blockers regardless of target:**
1. **The base schema is not in git.** `db/00_init.sql`…`db/09_sprocs.sql` and `db/seed.sql`
   are all **0 bytes**. The core tables (Users, Products, Categories, Customers, Orders,
   Colors, Sizes, Variants, StockHistory, Sales, Expenses, …) exist **only on the desktop
   SQL Express instance**. They must be exported before any migration.
2. Even the *content-bearing* SQL is incremental **patches** (`db/10`…`db/22`) that assume
   those base tables already exist.

## Detailed Findings

### Connection layer (`src/lib/`)
- `src/lib/db.ts:1-22` — single `mssql` `ConnectionPool` singleton. Config:
  `encrypt: false, trustServerCertificate: true` (local-only settings; Azure/most cloud
  SQL would need `encrypt: true`). Exports `getDb()` and the `sql` type namespace used by
  every caller for typed params.
- `src/lib/auth.ts:11-21` — representative pattern: `db.request().input("Id", sql.UniqueIdentifier, …).input("Username", sql.NVarChar(100), …).query("INSERT INTO Users … VALUES (@Id, @Username …)")`. Uses `sql.UniqueIdentifier`, `sql.NVarChar(n)`, `sql.DateTime2`.
- `src/lib/auth.ts:31` — `SELECT TOP 1 * FROM Users WHERE Username = @Username` (T-SQL `TOP`).
- Auth is **`bcryptjs`**-based (`auth.ts:9,36`) — portable, not a migration concern. Session/cookie helpers (`src/lib/customerAuth.ts`) are app-side, not DB-dialect-bound.
- Other `src/lib` DB consumers: `storefront.ts` (~15+ queries), `dtfPricing.ts`, `dtfSettings.ts`, `storeSettings.ts`, `getNotifications.ts`, `customerAuth.ts`.

### Application data layer (`src/app/**/actions.ts`, 28 files, ~200+ call-sites)
Grouped by feature (all use `mssql` via `getDb()`):
- **Auth/users:** `(auth)/login`, `(auth)/register`, `(main)/users`, `(shop)/account`.
- **Customers:** `(main)/customers` (6), `(shop)/account` (4).
- **Orders/checkout:** `(main)/orders/actions.ts` (~25+ queries, multiple transactions),
  `(shop)/checkout/actions.ts` (~15, customer upsert + order + items + stock),
  `(main)/web-orders`, `(main)/order-logs`.
- **Catalog/products:** `(main)/catalog` (~20+), `src/lib/storefront.ts` (~15+),
  `(main)/color-requests`.
- **Stock/inventory:** `(main)/stocks` (~12), `(main)/inventory` (~7), `(main)/stock-history`.
- **DTF:** `(shop)/customize`, `(main)/dtf` (~12), `(main)/dtf-orders` (~6, transactions + `WITH (UPDLOCK)`).
- **Reporting:** `(main)/dashboard` (CTEs, `FULL OUTER JOIN`), `(main)/analysis` (~12),
  `(main)/reports` (~8, multi-level CTEs), `(main)/finance`, `(main)/sales`.
- **Other:** `(main)/dispatch`, `(main)/returns` (transactions), `(main)/settings` (`MERGE`),
  `(main)/expenses`, `(main)/whatsapp`, `app/sitemap.ts`, `orders/invoiceActions.ts`.

### SQL schema (`db/` — only patches `10`–`22` have content)
- **Tables defined in patches (6):** `DtfPriceItems`, `DtfQuotes`, `DtfTemplates`
  (`db/10_dtf_printing.sql`), `ProductImages` (`db/12_ecommerce.sql`), `DtfOrders`,
  `DtfOrderDesigns` (`db/16_dtf_orders.sql`).
- **40+ `ALTER TABLE ADD COLUMN`** against base tables (Products, Categories, Customers,
  Orders, Colors) across `db/11`–`db/22` — confirming the base tables exist only on the desktop.
- **1 function:** `dbo.fn_StockVariantId` (`db/18_shared_stock.sql:24-42`) — `CREATE OR ALTER FUNCTION`, scalar UDF used for shared-stock resolution.
- **0 stored procedures, 0 triggers, 0 views** in the tracked SQL.
- **Migration runner:** `db/apply.mjs` reads `.env.local`, splits files on `^GO$`
  (`apply.mjs:29-33`), runs each batch via `pool.request().batch()`.

### T-SQL features requiring translation (with examples)
| T-SQL (current) | PostgreSQL equivalent | Example sites |
|---|---|---|
| `request().input(name, sql.Type, v)` + `@name` | positional `$1` (or named via `postgres.js`) | every call-site |
| `result.recordset` | `result.rows` | every call-site |
| `SELECT TOP n` / `TOP (@n)` | `LIMIT n` | `auth.ts:31`, `orders/actions.ts:92,136,202`, `storefront.ts` |
| `OFFSET @o ROWS FETCH NEXT @n ROWS ONLY` | `LIMIT n OFFSET o` | `order-logs:75`, `storefront.ts:108,120,133` |
| `MERGE … WHEN MATCHED…` | `INSERT … ON CONFLICT … DO UPDATE` | `settings/actions.ts:40-47`, `dtf/actions.ts:262-268` |
| `OUTPUT INSERTED.Id` | `RETURNING id` | `stocks:108,138,151,227`, `returns:121`, `users:26,43`, `finance:91,105` |
| `SCOPE_IDENTITY()` | `RETURNING` / `lastval()` | `sales/actions.ts:122` |
| `NEWID()` / `UNIQUEIDENTIFIER` | `gen_random_uuid()` / `uuid` | schema + `register/actions.ts:30` |
| `ISNULL(a,b)` (50+) | `COALESCE(a,b)` | `storefront.ts`, `analysis`, `dashboard`, `orders` |
| `GETDATE()` / `SYSUTCDATETIME()` (30+) | `now()` / `current_timestamp` | `dtf:44,66,225`, `dashboard`, `checkout:230` |
| `DATEADD(d,-7,GETDATE())` | `now() - interval '7 days'` | `dispatch:53`, `dashboard:168`, `analysis:72` |
| `DATENAME/DATEPART(WEEKDAY,…)` | `to_char(...,'Day')` / `extract(dow …)` | `analysis:179,180,186` |
| `FORMAT(date,'yyyy-MM')` (8+) | `to_char(date,'YYYY-MM')` | `analysis:123,132,139`, `dashboard:139,149` |
| `TRY_CONVERT/TRY_CAST` | safe cast / `NULLIF`+regex | `dtf:77,125`, `reports:105,106` |
| `CONVERT(NVARCHAR(36), x)` | `x::text` / `CAST` | `storefront.ts:151-152`, `order-logs:57` |
| `WITH (UPDLOCK)` | `SELECT … FOR UPDATE` | `dtf-orders:86,141` |
| `[Key]`, `[Value]` brackets | `"Key"`, `"Value"` double-quotes | `settings`, `dispatch:36`, `dtf:151` |
| `NVARCHAR`/`DATETIME2`/`BIT`/`MONEY` types | `text`/`timestamptz`/`boolean`/`numeric` | schema-wide |
| DDL guards `IF OBJECT_ID/COL_LENGTH/sys.indexes` + `GO` | `CREATE … IF NOT EXISTS`, `information_schema`, no `GO` | `db/10`–`db/22` |

Portable as-is: `CASE`, CTEs (`WITH`), `FULL OUTER JOIN`, `STRING_AGG`, `COALESCE`,
`bcryptjs`, transactions (concept; API differs between `mssql` and `pg`).

## Code References
- `src/lib/db.ts:1-22` — `mssql` pool singleton, the single migration choke-point.
- `src/lib/auth.ts:11-31` — canonical `.input()/@param/recordset` + `TOP` pattern.
- `src/app/(main)/settings/actions.ts:40-47` — `MERGE` upsert (needs `ON CONFLICT`).
- `src/app/(main)/orders/actions.ts:479-577` — `new sql.Transaction(pool)` pattern (8 files use transactions).
- `src/app/(main)/dtf-orders/actions.ts:86,141` — `WITH (UPDLOCK)` pessimistic locking.
- `db/18_shared_stock.sql:24-42` — scalar UDF `fn_StockVariantId`.
- `db/apply.mjs:20-49` — `GO`-batch migration runner.
- `db/00_init.sql`…`db/09_sprocs.sql`, `db/seed.sql` — **0 bytes (base schema missing from git)**.

## Architecture / Conventions Observed
- **Server Actions + raw SQL**, no ORM. Every feature folder owns an `actions.ts` that
  imports `getDb()` and writes T-SQL inline. There is no abstraction layer between the app
  and the SQL dialect — so dialect changes touch application code directly, not a single
  adapter.
- **Typed parameters** are pervasive (`sql.UniqueIdentifier`, `sql.NVarChar(n)`,
  `sql.Decimal(18,2)`, `sql.DateTime2`, `sql.Bit`), meaning a driver swap is not a
  find-replace — each `.input()` call's type must be re-expressed for Postgres.
- **No stored procedures / EXEC** anywhere — all logic is in app-side queries. (One scalar
  UDF in the DB.) This *slightly* reduces DB-side rewrite but means business logic lives in
  the 200+ TypeScript call-sites that all need dialect changes.

## Migration paths (description, not recommendation — that's the Plan phase)
1. **Big-bang rewrite to Supabase/Postgres:** export desktop schema → translate DDL to
   Postgres → swap `mssql`→`pg`/`postgres.js` in `db.ts` → rewrite all ~200+ call-sites
   (params `@x`→`$n`, `recordset`→`rows`, T-SQL functions → Postgres) → re-test every flow.
   Supabase can be used as **plain Postgres via its connection string** — no need to adopt
   the Supabase JS client, PostgREST, or Supabase Auth, so the app structure stays intact.
2. **Compatibility shim:** impractical — the named-param + typed `.input()` + T-SQL
   function surface is too large to wrap cleanly.
3. **Keep SQL Server, change only the host:** Azure SQL Database free offer (managed SQL
   Server) → **zero code changes**, only env vars + `encrypt: true`. Contradicts "use
   Supabase" but satisfies "keep the DB and code alive" with least effort. See
   [[hosting-and-db-setup]].

## Related Prior Work (from workflow/)
- Memory [[hosting-and-db-setup]] — prior hosting decisions; already records "Supabase is
  NOT viable" (PostgreSQL vs SQL Server) and the Azure SQL free / Hostinger VPS fallbacks.
- Memory [[orders-mostly-via-whatsapp]] — admin/WhatsApp order entry is the primary flow;
  the checkout + orders actions are the highest-risk rewrite surface.
- `workflow/research/2026-06-19-ecommerce-storefront-transformation.md` and the DTF/
  shared-stock plans — context on the storefront and DTF modules that dominate the query count.

## Open Questions
1. **Does the user accept a full data-layer rewrite** (~39 files, 200+ call-sites), or is
   the real goal just "free hosting" — in which case Azure SQL free (no rewrite) meets it?
2. **Base schema export** — must be produced from the desktop (`full_schema.sql`) before any
   target is viable; is the desktop still available?
3. **Data migration** — schema-only, or carry existing products/orders/customers? Moving
   data SQL Server→Postgres needs a type-mapping ETL (e.g. `pgloader`-style), separate from
   schema/code work.
4. **Transaction API** — `mssql`'s `new sql.Transaction(pool)` (8 files) maps to `pg`
   client/`BEGIN`; confirm each transactional flow (orders, checkout, returns, dtf-orders)
   re-tests cleanly.
5. **`fn_StockVariantId`** must be rewritten as a Postgres `plpgsql`/`sql` function and
   re-pointed by its callers.
```
