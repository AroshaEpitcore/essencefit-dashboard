"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/* Fires a lightweight page-view beacon on every storefront navigation.
   sendBeacon survives the page unload/navigation, so counts stay accurate.
   Client-only + fire-and-forget: it can never block or break a render, and it
   doesn't read cookies, so it doesn't affect the (shop) layout's ISR. */
export default function PageView() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    const payload = JSON.stringify({ path: pathname, referrer: document.referrer || "" });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      } else {
        fetch("/api/track", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
      }
    } catch {
      /* ignore */
    }
  }, [pathname]);

  return null;
}
