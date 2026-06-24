/* Test database reset/provision runner.
 *
 * Strategy (per plan): the canonical schema lives only in the live source DB
 * (InvFin) — the db/*.sql migration files cannot rebuild it. So we take an
 * exact, data-free schema copy via DBCC CLONEDATABASE, flip it READ_WRITE,
 * then apply a deterministic seed (db/seed_test.sql).
 *
 * Usage: node test/db/reset.mjs   (reads .env.test)
 */
import fs from "node:fs";
import path from "node:path";
import sql from "mssql";

function loadEnv(file) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

loadEnv(".env.test");

const SRC = process.env.SOURCE_DB || "InvFin";
const TEST = process.env.DB_NAME || "essencefit_test";
const server = (process.env.DB_SERVER || "localhost").replace(/\\\\/g, "\\");

// Safety rails — never let the reset touch the source/production DB.
if (!TEST || TEST === SRC) {
  console.error(`Refusing to run: DB_NAME (${TEST}) must be set and differ from SOURCE_DB (${SRC}).`);
  process.exit(1);
}
if (!/test/i.test(TEST)) {
  console.error(`Refusing to run: DB_NAME (${TEST}) must contain "test".`);
  process.exit(1);
}

const base = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server,
  connectionTimeout: 30000,
  requestTimeout: 180000, // DBCC CLONEDATABASE / DROP can take a while
  options: { encrypt: false, trustServerCertificate: true },
};

// SQL Express databases often have AUTO_CLOSE on, which takes the source
// offline when idle and makes DBCC CLONEDATABASE fail with "database may be
// offline". Hold an OPEN connection to the source for the whole clone so it
// can't auto-close. Use explicit pools (not the global sql.connect) so each
// connection's database context is unambiguous.
const srcPool = new sql.ConnectionPool({ ...base, database: SRC });
try {
  await srcPool.connect();
  await srcPool.request().query("SELECT 1");
} catch (e) {
  console.error(`Could not reach source DB ${SRC}:`, e.message);
  process.exit(1);
}

const master = new sql.ConnectionPool({ ...base, database: "master" });
await master.connect();
console.log(`Cloning ${SRC} -> ${TEST} on ${server} ...`);

await master.request().batch(
  `IF DB_ID('${TEST}') IS NOT NULL
   BEGIN
     ALTER DATABASE [${TEST}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
     DROP DATABASE [${TEST}];
   END`
);

// Retry the clone — guards against transient AUTO_CLOSE/offline races.
let cloned = false;
for (let attempt = 1; attempt <= 3 && !cloned; attempt++) {
  try {
    await master.request().batch(`DBCC CLONEDATABASE ('${SRC}', '${TEST}') WITH NO_STATISTICS, NO_QUERYSTORE;`);
    cloned = true;
  } catch (e) {
    console.error(`Clone attempt ${attempt} failed: ${e.message}`);
    if (attempt === 3) { await srcPool.close(); await master.close(); process.exit(1); }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
// Clones are created READ_ONLY — flip to a normal writable DB.
await master.request().batch(`ALTER DATABASE [${TEST}] SET READ_WRITE WITH ROLLBACK IMMEDIATE;`);
await master.request().batch(`ALTER DATABASE [${TEST}] SET MULTI_USER;`);
await srcPool.close();
await master.close();
console.log("Schema clone ready.");

// Apply deterministic seed if present.
const seedPath = path.resolve(process.cwd(), "db/seed_test.sql");
if (fs.existsSync(seedPath) && fs.readFileSync(seedPath, "utf8").trim()) {
  const pool = new sql.ConnectionPool({ ...base, database: TEST });
  await pool.connect();
  const batches = fs
    .readFileSync(seedPath, "utf8")
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter(Boolean);
  let n = 0;
  for (const b of batches) {
    n++;
    try {
      await pool.request().batch(b);
    } catch (e) {
      console.error(`Seed batch ${n}/${batches.length} FAILED:`, e.message);
      await pool.close();
      process.exit(1);
    }
  }
  await pool.close();
  console.log(`Seed applied (${batches.length} batches).`);
} else {
  console.log("No db/seed_test.sql yet — skipped seeding.");
}

console.log(`Test DB ready: ${TEST}`);
