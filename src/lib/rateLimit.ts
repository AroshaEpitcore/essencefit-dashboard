import { headers } from "next/headers";
import { getDb, sql } from "@/lib/db";

/* Serverless-safe rate limiter.
 *
 * Vercel instances share no memory, so an in-process counter silently does
 * nothing in production. The window lives in Postgres instead (the standard
 * shared-store approach — the DB stands in for Redis at this traffic level).
 *
 * consumeRateLimit records ONE attempt and reports whether it's still under
 * the cap. It's a single atomic upsert: on conflict, if the window has
 * expired the counter resets to 1 and the window restarts; otherwise it
 * increments. `allowed` is (resulting count <= max), so the (max+1)-th
 * attempt inside the window is the first to be refused.
 */
export async function consumeRateLimit(
  key: string,
  max: number,
  windowSec: number
): Promise<{ allowed: boolean; count: number }> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("Key", sql.NVarChar(200), key)
    .input("Win", sql.Int, windowSec)
    .query(`
      INSERT INTO auth_attempts (key, count, window_start)
      VALUES (@Key, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN auth_attempts.window_start < now() - make_interval(secs => @Win)
            THEN 1
          ELSE auth_attempts.count + 1
        END,
        window_start = CASE
          WHEN auth_attempts.window_start < now() - make_interval(secs => @Win)
            THEN now()
          ELSE auth_attempts.window_start
        END
      RETURNING count
    `);
  const count = Number(res.recordset[0]?.count ?? 1);
  return { allowed: count <= max, count };
}

/* First client IP from the proxy's x-forwarded-for. Returns null when there's
 * no forwarded header (local dev / the E2E suite hitting localhost directly) —
 * callers skip the IP-keyed limit in that case so a shared local origin can't
 * throttle itself. Behind Vercel the header is always present. */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (!fwd) return null;
  const first = fwd.split(",")[0].trim();
  return first || null;
}
