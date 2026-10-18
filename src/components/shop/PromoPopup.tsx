"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X, Copy, Check } from "lucide-react";
import type { PublicPopup } from "@/lib/promos";

/* Storefront promo popup renderer. Mounted once in (shop)/layout.tsx with the
   active popups. Evaluates targeting + frequency cap + trigger entirely on the
   client (no cookies -> keeps the layout ISR-friendly), shows one eligible
   popup, and beacons impression/click/dismiss to /api/promo-event.

   Frequency cap storage: localStorage `promo:<id>` = last-shown epoch ms;
   sessionStorage `promo_s:<id>` = shown this tab session. Audience uses a
   localStorage `ef_returning` marker set after the first evaluation. */

const RETURNING_KEY = "ef_returning";
const DEFAULT_ACCENT = "#111827";

function beacon(popupId: string, event: "impression" | "click" | "dismiss") {
  try {
    const payload = JSON.stringify({ popupId, event });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/promo-event", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/promo-event", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch {
    /* ignore */
  }
}

function matchesPage(showOn: PublicPopup["showOn"], path: string): boolean {
  switch (showOn) {
    case "home": return path === "/";
    case "shop": return path === "/shop" || path.startsWith("/shop/") || path.startsWith("/category");
    case "product": return path.startsWith("/product");
    case "all": default: return true;
  }
}

function capPassed(p: PublicPopup): boolean {
  try {
    if (p.frequency === "always") return true;
    if (p.frequency === "session") return !sessionStorage.getItem(`promo_s:${p.id}`);
    const raw = localStorage.getItem(`promo:${p.id}`);
    if (!raw) return true;
    if (p.frequency === "once") return false;
    if (p.frequency === "daily") return Date.now() - Number(raw) > 24 * 60 * 60 * 1000;
    return true;
  } catch {
    return true;
  }
}

function markShown(p: PublicPopup) {
  try {
    localStorage.setItem(`promo:${p.id}`, String(Date.now()));
    sessionStorage.setItem(`promo_s:${p.id}`, "1");
  } catch {
    /* ignore */
  }
}

export default function PromoPopup({ popups }: { popups: PublicPopup[] }) {
  const pathname = usePathname();
  const [active, setActive] = useState<PublicPopup | null>(null);
  const [copied, setCopied] = useState(false);
  const shownRef = useRef(false); // one popup per page load
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const show = useCallback((p: PublicPopup) => {
    shownRef.current = true;
    markShown(p);
    beacon(p.id, "impression");
    setActive(p);
  }, []);

  const close = useCallback(() => {
    setActive((cur) => {
      if (cur) beacon(cur.id, "dismiss");
      return null;
    });
  }, []);

  // Pick + arm an eligible popup for the current page.
  useEffect(() => {
    if (!popups?.length || shownRef.current) return;

    let isReturning = false;
    try {
      isReturning = !!localStorage.getItem(RETURNING_KEY);
      localStorage.setItem(RETURNING_KEY, "1"); // after reading, mark for next time
    } catch { /* ignore */ }

    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

    const eligible = popups.find((p) => {
      if (!matchesPage(p.showOn, pathname || "/")) return false;
      if (p.device === "mobile" && !isMobile) return false;
      if (p.device === "desktop" && isMobile) return false;
      if (p.audience === "new" && isReturning) return false;
      if (p.audience === "returning" && !isReturning) return false;
      return capPassed(p);
    });
    if (!eligible) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let onScroll: (() => void) | undefined;
    let onExit: ((e: MouseEvent) => void) | undefined;
    const fire = () => { if (!shownRef.current) show(eligible); };

    if (eligible.trigger === "immediate") {
      timer = setTimeout(fire, 400);
    } else if (eligible.trigger === "delay") {
      timer = setTimeout(fire, Math.max(0, eligible.triggerValue) * 1000);
    } else if (eligible.trigger === "scroll") {
      onScroll = () => {
        const h = document.documentElement;
        const pct = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100;
        if (pct >= eligible.triggerValue) fire();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
    } else if (eligible.trigger === "exit") {
      onExit = (e: MouseEvent) => { if (e.clientY <= 0) fire(); };
      document.addEventListener("mouseout", onExit);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (onScroll) window.removeEventListener("scroll", onScroll);
      if (onExit) document.removeEventListener("mouseout", onExit);
    };
  }, [popups, pathname, show]);

  // Esc to close + focus the close button on open.
  useEffect(() => {
    if (!active) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close]);

  if (!active) return null;

  const accent = active.accentColor || DEFAULT_ACCENT;

  const copyCoupon = () => {
    if (!active.couponCode) return;
    try {
      navigator.clipboard.writeText(active.couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  const onCta = () => {
    beacon(active.id, "click");
    // let the <a> navigate; clear so it doesn't re-open on back
    setActive(null);
  };

  const content = (
    <>
      {active.imageUrl && (
        <img src={active.imageUrl} alt="" className="w-full h-40 sm:h-44 object-cover" />
      )}
      <div className="p-6 text-center">
        <h2 className="store-headings text-2xl font-extrabold leading-tight" style={{ color: accent }}>
          {active.heading}
        </h2>
        {active.body && <p className="mt-2 text-[15px] text-gray-600 leading-relaxed">{active.body}</p>}

        {active.couponCode && (
          <button
            type="button"
            onClick={copyCoupon}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-dashed px-4 py-2.5 font-mono font-bold tracking-wider transition hover:bg-gray-50"
            style={{ borderColor: accent, color: accent }}
            aria-label="Copy coupon code"
          >
            {active.couponCode}
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        )}

        {active.ctaText && (
          active.ctaLink ? (
            <a
              href={active.ctaLink}
              onClick={onCta}
              className="mt-5 block w-full rounded-xl py-3 font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              {active.ctaText}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => { beacon(active.id, "click"); close(); }}
              className="mt-5 block w-full rounded-xl py-3 font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              {active.ctaText}
            </button>
          )
        )}
      </div>
    </>
  );

  const closeBtn = (
    <button
      ref={closeBtnRef}
      type="button"
      onClick={close}
      aria-label="Close"
      className="absolute top-3 right-3 z-10 grid place-items-center w-8 h-8 rounded-full bg-white/80 text-gray-700 shadow hover:bg-white"
    >
      <X className="w-4 h-4" />
    </button>
  );

  // CORNER (toast) layout
  if (active.layout === "corner") {
    return (
      <div className="fixed bottom-4 right-4 z-[70] w-[22rem] max-w-[calc(100vw-2rem)] promo-pop" role="dialog" aria-modal="false">
        <div className="relative rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
          {closeBtn}
          {content}
        </div>
        <PromoAnim />
      </div>
    );
  }

  // BAR layout (slim bottom strip)
  if (active.layout === "bar") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[70] promo-pop" role="dialog" aria-modal="false">
        <div className="relative flex items-center justify-center gap-4 px-5 py-3 text-white" style={{ backgroundColor: accent }}>
          <p className="text-sm sm:text-base font-semibold text-center">
            {active.heading}
            {active.body ? <span className="font-normal opacity-90"> — {active.body}</span> : null}
            {active.couponCode ? <span className="ml-2 font-mono font-bold">{active.couponCode}</span> : null}
          </p>
          {active.ctaText && active.ctaLink && (
            <a href={active.ctaLink} onClick={onCta} className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25">
              {active.ctaText}
            </a>
          )}
          <button type="button" onClick={close} aria-label="Close" className="shrink-0 grid place-items-center w-7 h-7 rounded-full hover:bg-white/20">
            <X className="w-4 h-4" />
          </button>
        </div>
        <PromoAnim />
      </div>
    );
  }

  // SPLIT layout — content left, full-height image right (landscape modal)
  if (active.layout === "split") {
    return (
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm promo-fade" onClick={close} aria-hidden />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.heading || "Promotion"}
          className="relative w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden grid sm:grid-cols-2 promo-pop"
        >
          {closeBtn}
          {/* image — top on mobile, right on desktop */}
          {active.imageUrl && (
            <img src={active.imageUrl} alt="" className="order-1 sm:order-2 w-full h-44 sm:h-full object-cover" />
          )}
          {/* content — bottom on mobile, left on desktop */}
          <div className={`order-2 sm:order-1 p-8 flex flex-col justify-center text-left ${active.imageUrl ? "" : "sm:col-span-2 text-center"}`}>
            <h2 className="store-headings text-3xl font-extrabold leading-tight" style={{ color: accent }}>
              {active.heading}
            </h2>
            {active.body && <p className="mt-3 text-[15px] text-gray-600 leading-relaxed">{active.body}</p>}
            {active.couponCode && (
              <button type="button" onClick={copyCoupon}
                className="mt-5 inline-flex items-center gap-2 self-start rounded-xl border-2 border-dashed px-4 py-2.5 font-mono font-bold tracking-wider transition hover:bg-gray-50"
                style={{ borderColor: accent, color: accent }} aria-label="Copy coupon code">
                {active.couponCode}{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
            {active.ctaText && (
              active.ctaLink ? (
                <a href={active.ctaLink} onClick={onCta} className="mt-6 block w-full rounded-xl py-3.5 text-center font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: accent }}>
                  {active.ctaText}
                </a>
              ) : (
                <button type="button" onClick={() => { beacon(active.id, "click"); close(); }} className="mt-6 block w-full rounded-xl py-3.5 text-center font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: accent }}>
                  {active.ctaText}
                </button>
              )
            )}
          </div>
        </div>
        <PromoAnim />
      </div>
    );
  }

  // CENTER (modal) layout — default
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm promo-fade" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={active.heading || "Promotion"}
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden promo-pop"
      >
        {closeBtn}
        {content}
      </div>
      <PromoAnim />
    </div>
  );
}

// Scoped keyframes (respects reduced motion).
function PromoAnim() {
  return (
    <style>{`
      @keyframes promoFade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes promoPop { from { opacity: 0; transform: translateY(16px) scale(.96) } to { opacity: 1; transform: none } }
      .promo-fade { animation: promoFade .25s ease-out both }
      .promo-pop { animation: promoPop .3s cubic-bezier(.16,1,.3,1) both }
      @media (prefers-reduced-motion: reduce) { .promo-fade, .promo-pop { animation: none } }
    `}</style>
  );
}
