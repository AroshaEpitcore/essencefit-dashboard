/* Loads db/pg/_data/*.json (exported from SQL Server) into Supabase Postgres.
   Tables are listed in dependency order (parents first). JSON keys are the
   SQL Server PascalCase column names; we lowercase them to match the pg schema.
   Values are passed as exported (uuid/decimal/timestamp as strings, bit as bool,
   null preserved) and pg coerces them to the column types. */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ORDER = [
  "Categories","Sizes","Colors","Users","Suppliers","Customers","Products",
  "ProductVariants","ProductImages","Orders","OrderItems","Sales","Handovers",
  "CashUsage","Expenses","Purchases","PurchaseReturns","PurchaseReturnItems",
  "SalesReturns","SalesReturnItems","StockHistory","OrderStatusLogs",
  "DispatchMessages","ColorRequests","Settings","DtfTemplates","DtfQuotes",
  "DtfPriceItems","DtfOrders","DtfOrderDesigns",
];

const env = fs.readFileSync(path.resolve(".env.local"), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + '="?([^"\\n]+)"?', "m")) || [])[1];
const client = new pg.Client({ connectionString: get("DIRECT_URL"), ssl: { rejectUnauthorized: false } });

const BATCH = 200;
await client.connect();
try {
  for (const t of ORDER) {
    const file = path.resolve("db/pg/_data", `${t}.json`);
    if (!fs.existsSync(file)) { console.log(`${t}: no file, skip`); continue; }
    const rows = JSON.parse(fs.readFileSync(file, "utf8"));
    const table = t.toLowerCase();
    if (!rows.length) { console.log(`${t}: 0 rows`); continue; }
    const cols = Object.keys(rows[0]);
    const colSql = cols.map((c) => `"${c.toLowerCase()}"`).join(",");
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const params = [];
      const tuples = slice.map((r) => {
        const ph = cols.map((c) => { params.push(r[c] ?? null); return `$${params.length}`; });
        return `(${ph.join(",")})`;
      });
      await client.query(`INSERT INTO ${table} (${colSql}) VALUES ${tuples.join(",")}`, params);
      inserted += slice.length;
    }
    const chk = await client.query(`SELECT count(*)::int n FROM ${table}`);
    console.log(`${t}: inserted ${inserted}, table now has ${chk.rows[0].n}`);
  }
  console.log("Data import complete.");
} catch (e) {
  console.error(`FAILED: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
