"use client";

/* Admin error boundary — dark theme, matches the (main) dashboard shell. Shown
   when an admin page's render or data load throws (e.g. the DB is unreachable),
   with a retry instead of the raw Next.js default. Renders inside the already-
   authorized (main) layout. */
import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-100">Something went wrong</h1>
        <p className="mt-2 text-gray-400">
          This page couldn&apos;t load. It may be a temporary database or network issue — try again.
        </p>
        {error?.digest && (
          <p className="mt-2 text-xs text-gray-600">Reference: {error.digest}</p>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-white font-medium hover:bg-primary/90 transition-colors"
          >
            <RotateCw className="w-4 h-4" /> Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center rounded-lg border border-gray-600 px-5 py-2.5 text-gray-200 font-medium hover:bg-gray-800 transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
