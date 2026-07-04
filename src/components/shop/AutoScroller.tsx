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

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!paused.current && el.scrollWidth > el.clientWidth) {
        el.scrollLeft += speed * dt;
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
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
      resumeTimer = setTimeout(() => (paused.current = false), 1200);
    };
    const resumeNow = () => {
      clearTimeout(resumeTimer);
      paused.current = false;
    };
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resumeNow);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resumeSoon);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resumeTimer);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resumeNow);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resumeSoon);
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
