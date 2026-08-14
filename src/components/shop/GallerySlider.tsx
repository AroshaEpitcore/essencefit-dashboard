"use client";

import { useEffect, useRef, useState } from "react";
import GalleryCard from "./GalleryCard";
import type { GalleryItem } from "@/lib/storefront";

/* Auto-scrolling strip of gallery cards. Unlike the shared AutoScroller (whose
   callers always duplicate the track), this one measures first: it only clones
   the track for a seamless loop when a SINGLE set of cards overflows the
   container. With just a few items — e.g. a product with one or two assigned
   custom orders — that means they render once, centered, instead of appearing
   twice. Pauses on hover and while touching; manual swiping works. */
export default function GallerySlider({ items, speed = 40 }: { items: GalleryItem[]; speed?: number }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const [loop, setLoop] = useState(false);

  // Decide whether a single track overflows (→ loop + duplicate) and keep it in
  // sync on resize. The +4 guards against sub-pixel rounding.
  useEffect(() => {
    const el = scrollerRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const measure = () => setLoop(track.scrollWidth > el.clientWidth + 4);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(track);
    return () => ro.disconnect();
  }, [items.length]);

  // Continuous native-scroll animation — only runs while looping.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !loop) return;
    let raf = 0;
    let last = performance.now();
    let resumeTimer: ReturnType<typeof setTimeout>;
    let pos = el.scrollLeft;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (paused.current) {
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
  }, [loop, speed]);

  const cards = items.map((item) => (
    <div key={item.Id} className="w-[240px] sm:w-[280px] shrink-0 px-1.5">
      <GalleryCard item={item} onDark />
    </div>
  ));

  return (
    <div
      ref={scrollerRef}
      tabIndex={-1}
      className={`flex overflow-x-auto outline-none [-webkit-tap-highlight-color:transparent] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${loop ? "" : "justify-center"}`}
    >
      {/* First (measured) copy. */}
      <div ref={trackRef} className="flex shrink-0">
        {cards}
      </div>
      {/* Seamless-loop duplicate — only when a single set overflows. */}
      {loop && (
        <div className="flex shrink-0" aria-hidden>
          {items.map((item) => (
            <div key={`dup-${item.Id}`} className="w-[240px] sm:w-[280px] shrink-0 px-1.5">
              <GalleryCard item={item} onDark />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
