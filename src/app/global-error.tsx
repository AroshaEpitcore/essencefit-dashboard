"use client";

/* Last-resort boundary: replaces the ROOT layout when it (or something very
   high in the tree) throws, so it must render its own <html>/<body> and can't
   rely on global CSS being applied — styles are inline. Rarely hit. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", background: "#0b0f17", color: "#e5e7eb" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
            <p style={{ marginTop: 8, color: "#9ca3af" }}>
              An unexpected error occurred. Please try again.
            </p>
            {error?.digest && (
              <p style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>Reference: {error.digest}</p>
            )}
            <button
              onClick={reset}
              style={{ marginTop: 24, padding: "10px 20px", borderRadius: 8, border: "none", background: "#4f46e5", color: "#fff", fontWeight: 500, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
