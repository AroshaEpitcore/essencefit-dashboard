export function money(n: number | null | undefined): string {
  return "Rs. " + Number(n || 0).toLocaleString("en-LK");
}

export function discountPct(selling: number, compareAt: number | null | undefined): number {
  if (!compareAt || compareAt <= selling) return 0;
  return Math.round(((compareAt - selling) / compareAt) * 100);
}
