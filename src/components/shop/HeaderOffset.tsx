/* Spacer under the fixed header (promo bar + nav). Deterministic + server-rendered
   on purpose: it must NOT depend on usePathname(). During static prerender of the
   home page usePathname() is unreliable, so branching the DOM on it here made the
   server emit this spacer while the client dropped it → hydration mismatch (React
   #418). Now the spacer is always rendered; the home page cancels it with a
   matching negative margin so the hero stays full-bleed under the header. */
export default function HeaderOffset({ hasPromo }: { hasPromo: boolean }) {
  // promo strip = 36px (h-9); nav = 64px (h-16) / 80px (md:h-20)
  return <div className={hasPromo ? "h-[100px] md:h-[116px]" : "h-16 md:h-20"} aria-hidden />;
}
