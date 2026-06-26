"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "cookie-consent";

function setConsent(value: "accepted" | "rejected") {
  try {
    localStorage.setItem(STORAGE_KEY, value);
    // Also store a cookie (1 year) so the choice is available server-side if needed.
    document.cookie = `${STORAGE_KEY}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  } catch {
    // Ignore storage errors (e.g. private mode).
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function handle(value: "accepted" | "rejected") {
    setConsent(value);
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700 leading-relaxed">
            We use cookies to keep your cart, remember your preferences, and improve your
            shopping experience. See our{" "}
            <Link href="/cookie-policy" className="text-primary underline hover:no-underline">
              Cookie Policy
            </Link>{" "}
            for details.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => handle("rejected")}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
          >
            Reject
          </button>
          <button
            onClick={() => handle("accepted")}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white hover:opacity-90 transition"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
