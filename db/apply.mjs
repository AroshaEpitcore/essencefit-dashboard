/* Simple migration runner for the InvFin database.
   Usage:  node db/apply.mjs db/12_ecommerce.sql
   Reads connection settings from .env.local. Splits the file on GO batches. */
import sql from "mssql";
import fs from "fs";
import path from "path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node db/apply.mjs <path-to-sql-file>");
  process.exit(1);
}

const envText = fs.readFileSync(path.resolve(".env.local"), "utf8");
const env = (k) => {
  const m = envText.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : undefined;
};

const config = {
  user: env("DB_USER"),
  password: env("DB_PASSWORD"),
  server: env("DB_SERVER").replace(/\\\\/g, "\\"),
  database: env("DB_NAME"),
  options: { encrypt: false, trustServerCertificate: true },
};

const text = fs.readFileSync(path.resolve(file), "utf8");
// Split on lines containing only GO (case-insensitive).
const batches = text
  .split(/^\s*GO\s*$/gim)
  .map((b) => b.trim())
  .filter((b) => b.length > 0);

const pool = await sql.connect(config);
console.log(`Applying ${file} (${batches.length} batches) to ${config.database}...`);
let n = 0;
for (const batch of batches) {
  n++;
  try {
    await pool.request().batch(batch);
    console.log(`  batch ${n}/${batches.length} ok`);
  } catch (err) {
    console.error(`  batch ${n} FAILED:`, err.message);
    await pool.close();
    process.exit(1);
  }
}
await pool.close();
console.log("Done.");
