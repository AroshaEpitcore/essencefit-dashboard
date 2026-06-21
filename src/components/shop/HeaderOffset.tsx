"use client";

import { usePathname } from "next/navigation";

/* The header is fixed (promo bar + nav). On the home page the hero sits underneath
   it (full-bleed); every other page needs a spacer equal to the header height. */
export default function HeaderOffset({ hasPromo }: { hasPromo: boolean }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  // promo strip = 36px (h-9); nav = 64px (h-16) / 96px (md:h-24)
  return <div className={hasPromo ? "h-[100px] md:h-[132px]" : "h-16 md:h-24"} aria-hidden />;
}
