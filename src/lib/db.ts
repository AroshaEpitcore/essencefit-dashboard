import sql, { getPool, makeRequest } from "@/lib/sqlShim";

/*
 * mssql-compatible pool facade. Callers do:
 *   const db = await getDb();
 *   const res = await db.request().input("X", sql.Int, 1).query("... @X");
 *   res.recordset
 * Backed by `pg` via the shim (see src/lib/sqlShim.ts).
 */
export async function getDb() {
  const pool = getPool();
  return {
    request: () => makeRequest((t, v) => pool.query(t, v)),
    _pool: pool,
  };
}

// Re-export the `sql` namespace so `import { getDb, sql } from "@/lib/db"`
// keeps working across the data layer.
export { sql };
