// TEMPORARY diagnostic: capture the real (unmasked) server error to the DB so we
// can read what production actually throws. Remove after debugging.
export async function onRequestError(
  error: unknown,
  request: { path?: string },
  _context: unknown
): Promise<void> {
  try {
    const { Client } = await import("pg");
    const c = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await c.connect();
    const err = error as { message?: string; stack?: string; digest?: string };
    await c.query(
      "INSERT INTO error_log (path, digest, message, stack) VALUES ($1,$2,$3,$4)",
      [request?.path ?? null, err?.digest ?? null, err?.message ?? String(error), err?.stack ?? null]
    );
    await c.end();
  } catch {
    // swallow — diagnostics must never affect the request
  }
}
