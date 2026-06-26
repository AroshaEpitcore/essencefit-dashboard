/* Product status tags with a pulsing "live" dot. NEW = emerald, SALE = brand
   orange — the dot and text always share the tag's colour. Used on cards, the
   PDP, quick view, and the home spotlight so the tagging is consistent. */

function LiveDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-75 animate-ping`} />
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${color}`} />
    </span>
  );
}

const pill =
  "inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-sm ring-1 ring-black/5 shadow-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-wide";

export default function ProductTags({
  isNew,
  onSale,
  className = "",
}: {
  isNew?: boolean;
  onSale?: boolean;
  className?: string;
}) {
  if (!isNew && !onSale) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {isNew && (
        <span className={`${pill} text-emerald-600`}>
          <LiveDot color="bg-emerald-500" /> New
        </span>
      )}
      {onSale && (
        <span className={`${pill} text-primary`}>
          <LiveDot color="bg-primary" /> Sale
        </span>
      )}
    </div>
  );
}
