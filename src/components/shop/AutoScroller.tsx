"use client";

import { useEffect, useRef } from "react";

/* Continuously auto-scrolling strip built on NATIVE horizontal scroll
   (scrollLeft driven by requestAnimationFrame) instead of a CSS transform
   marquee — transforms on big image tracks cause seams/jank and break
   position:fixed children. Children must be rendered twice by the caller
   (duplicated track) so the loop can wrap seamlessly at the halfway point.
   Pauses on hover and while touching/dragging; manual swiping works. */
export default function AutoScroller({ children, speed = 40 }: { children: React.ReactNode; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    let resumeTimer: ReturnType<typeof setTimeout>;
    // Float position accumulator: scrollLeft rounds to whole pixels, so
    // read-add-write of sub-pixel steps (~0.7px/frame) would stall forever.
    let pos = el.scrollLeft;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (paused.current) {
        // Follow manual scrolling so we resume from wherever the user left it.
        pos = el.scrollLeft;
      } else if (el.scrollWidth > el.clientWidth) {
        pos += speed * dt;
        const half = el.scrollWidth / 2;
        if (pos >= half) pos -= half;
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const pause = () => {
      paused.current = true;
      clearTimeout(resumeTimer);
    };
    const resumeSoon = () => {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        pos = el.scrollLeft;
        paused.current = false;
      }, 1200);
    };
    const resumeNow = () => {
      clearTimeout(resumeTimer);
      pos = el.scrollLeft;
      paused.current = false;
    };
    // Only a REAL mouse pauses on hover — after a tap, browsers fire a
    // synthetic mouseenter with no mouseleave, which would pause forever.
    const onPointerEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") pause();
    };
    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") resumeNow();
    };
    el.addEventListener("pointerenter", onPointerEnter);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resumeSoon);
    el.addEventListener("touchcancel", resumeSoon);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resumeTimer);
      el.removeEventListener("pointerenter", onPointerEnter);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resumeSoon);
      el.removeEventListener("touchcancel", resumeSoon);
    };
  }, [speed]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="flex overflow-x-auto outline-none [-webkit-tap-highlight-color:transparent] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}
