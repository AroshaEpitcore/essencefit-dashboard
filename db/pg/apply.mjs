/* PostgreSQL migration runner for Supabase.
   Usage: node db/pg/apply.mjs db/pg/schema.sql [DIRECT_URL|DATABASE_URL]
   Reads the connection string from .env.local. Sends the whole file in one
   simple-query call (so dollar-quoted function bodies stay intact). */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const file = process.argv[2];
const urlKey = process.argv[3] || "DIRECT_URL";
if (!file) {
  console.error("Usage: node db/pg/apply.mjs <path-to-sql> [DIRECT_URL|DATABASE_URL]");
  process.exit(1);
}

const env = fs.readFileSync(path.resolve(".env.local"), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + '="?([^"\\n]+)"?', "m")) || [])[1];
const url = get(urlKey);
if (!url) { console.error(`${urlKey} not set in .env.local`); process.exit(1); }

const sql = fs.readFileSync(path.resolve(file), "utf8");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied ${file}`);
} catch (e) {
  console.error(`FAILED: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
