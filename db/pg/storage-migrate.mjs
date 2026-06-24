/*
 * One-time migration of local public/uploads/* into Supabase Storage, then
 * repoint existing DB image URLs (/uploads/...) to the bucket's public URL.
 *
 * Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL from .env.local.
 * Run: node db/pg/storage-migrate.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import pg from "pg";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
  if (m) { let v = m[2].trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; }
}
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "uploads";
if (!SUPABASE_URL || !KEY) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");

const MIME = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", pdf: "application/pdf",
};

async function ensureBucket() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (res.ok) { console.log(`Created public bucket "${BUCKET}"`); return; }
  const txt = await res.text();
  if (txt.includes("already exists") || res.status === 409) { console.log(`Bucket "${BUCKET}" already exists`); return; }
  throw new Error(`Bucket create failed: ${res.status} ${txt}`);
}

function* walk(dir, base = dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full, base);
    else if (entry !== ".gitkeep") yield { full, rel: path.relative(base, full).split(path.sep).join("/") };
  }
}

async function uploadFiles() {
  const root = path.join(process.cwd(), "public", "uploads");
  let ok = 0, fail = 0;
  for (const { full, rel } of walk(root)) {
    const ext = rel.split(".").pop().toLowerCase();
    const body = readFileSync(full);
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${rel}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": MIME[ext] || "application/octet-stream",
        "x-upsert": "true",
        "cache-control": "public, max-age=31536000, immutable",
      },
      body,
    });
    if (res.ok) { ok++; } else { fail++; console.error(`  FAIL ${rel}: ${res.status} ${await res.text().catch(() => "")}`); }
  }
  console.log(`Uploaded ${ok} files to bucket (${fail} failed)`);
}

async function repointDb() {
  const base = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  // Find every text/varchar column in the public schema, update any value that
  // starts with /uploads/ to the bucket's public base.
  const cols = await client.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema='public' AND data_type IN ('text','character varying')`);
  let total = 0;
  for (const { table_name, column_name } of cols.rows) {
    const r = await client.query(
      `UPDATE "${table_name}" SET "${column_name}" = replace("${column_name}", '/uploads/', $1)
       WHERE "${column_name}" LIKE '/uploads/%'`,
      [base]
    );
    if (r.rowCount) { console.log(`  ${table_name}.${column_name}: ${r.rowCount} row(s)`); total += r.rowCount; }
  }
  console.log(`Repointed ${total} DB URL(s) to ${base}`);
  await client.end();
}

await ensureBucket();
await uploadFiles();
await repointDb();
console.log("\n🟢 Storage migration complete");
