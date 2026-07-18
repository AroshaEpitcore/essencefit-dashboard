import type { Instrumentation } from "next";

/* TEMPORARY diagnostic — captures the real (un-redacted) server error to the
   debug_errors table so it can be read directly from the DB. Next redacts error
   messages sent to the browser in production; onRequestError runs server-side
   and receives the original error + stack. Remove once the /web-orders 500 is
   diagnosed (mirrors the earlier 618c981 approach). */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // Node-only: pg can't be bundled for the edge runtime. The /web-orders server
  // action runs in Node, so its errors surface here with NEXT_RUNTIME === "nodejs".
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { getPool } = await import("@/lib/sqlShim");
    const e = err as { message?: string; stack?: string; digest?: string };
    await getPool().query(
      `INSERT INTO debug_errors(message, stack, digest, url, ctx) VALUES ($1,$2,$3,$4,$5)`,
      [
        String(e?.message ?? err),
        String(e?.stack ?? ""),
        String(e?.digest ?? ""),
        String((request as { path?: string; url?: string })?.path ?? (request as { url?: string })?.url ?? ""),
        JSON.stringify(context ?? {}),
      ]
    );
  } catch {
    // never let diagnostics break the request
  }
};
