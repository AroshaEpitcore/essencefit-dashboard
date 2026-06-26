import { Star } from "lucide-react";

/* Read-only star display supporting fractional averages via a clipped overlay. */
export default function ReviewStars({
  value,
  size = "md",
  className = "",
}: {
  value: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const cls = size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-5 h-5" : "w-4 h-4";
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div className={`relative inline-flex ${className}`} aria-label={`${value.toFixed(1)} out of 5`}>
      <div className="flex text-gray-300">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={cls} />
        ))}
      </div>
      <div className="absolute inset-0 flex overflow-hidden text-amber-400" style={{ width: `${pct}%` }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={`${cls} fill-amber-400 shrink-0`} />
        ))}
      </div>
    </div>
  );
}
