"use client";

/* Seamless scrolling promo strip. The row is rendered twice and the track is
   translated by -50%, so it loops without a visible jump. Pauses on hover. */
export default function Marquee({ items }: { items: string[] }) {
  if (!items.length) return null;

  const Row = ({ ariaHidden = false }: { ariaHidden?: boolean }) => (
    <div className="flex shrink-0 items-center" aria-hidden={ariaHidden}>
      {items.map((text, i) => (
        <span key={i} className="flex items-center whitespace-nowrap text-[11px] sm:text-xs tracking-wide">
          <span className="mx-6">{text}</span>
          <span className="opacity-50">◆</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="marquee-pause overflow-hidden w-full">
      <div className="flex w-max animate-marquee">
        <Row />
        <Row ariaHidden />
      </div>
    </div>
  );
}
