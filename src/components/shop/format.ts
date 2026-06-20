export function money(n: number | null | undefined): string {
  return "Rs. " + Number(n || 0).toLocaleString("en-LK");
}

export function discountPct(selling: number, compareAt: number | null | undefined): number {
  if (!compareAt || compareAt <= selling) return 0;
  return Math.round(((compareAt - selling) / compareAt) * 100);
}

// Sort order for clothing sizes (unknown sizes fall back to alphabetical, after known ones).
const SIZE_ORDER = ["xxs", "xs", "s", "m", "l", "xl", "xxl", "2xl", "3xl", "4xl", "xxxl"];
export function sizeRank(name: string): number {
  const i = SIZE_ORDER.indexOf(name.toLowerCase().replace(/\s+/g, ""));
  return i === -1 ? 999 : i;
}
