/* Canonical apparel size ordering (S → M → L → XL → …). The Sizes table has
   no sort column and alphabetical ordering puts 2XL before S, so every list
   of sizes sorts through this ranking instead. Unknown names fall to the
   end (alphabetical among themselves); numeric sizes (28, 30…) sort by
   value after the letter sizes. */
const RANK: Record<string, number> = {
  XXS: 0,
  XS: 1,
  S: 2,
  SM: 2,
  SMALL: 2,
  M: 3,
  MD: 3,
  MEDIUM: 3,
  L: 4,
  LG: 4,
  LARGE: 4,
  XL: 5,
  XXL: 6,
  "2XL": 6,
  XXXL: 7,
  "3XL": 7,
  "4XL": 8,
  "5XL": 9,
  "6XL": 10,
};

/* Short display labels for the storefront: size chips and cart lines show
   "M", not "Medium". Names the map doesn't know (Free Size, 32, …) are
   shown as typed. Admin pages keep the full stored names. */
const LABEL: Record<string, string> = {
  "EXTRA SMALL": "XS",
  SMALL: "S",
  SM: "S",
  MEDIUM: "M",
  MD: "M",
  LARGE: "L",
  LG: "L",
  "EXTRA LARGE": "XL",
  "2XL": "XXL",
  "3XL": "XXXL",
};

export function sizeLabel(name: string | null | undefined): string {
  if (!name) return "";
  const n = name.trim().toUpperCase();
  if (LABEL[n]) return LABEL[n];
  if (n in RANK) return n; // already a short letter size (S, XL, XXL, …)
  return name.trim(); // unknown (Free Size, 32, …) — show as typed
}

export function sizeRank(name: string | null | undefined): number {
  if (!name) return 9999;
  const n = name.trim().toUpperCase();
  if (n in RANK) return RANK[n];
  const num = parseFloat(n);
  if (!Number.isNaN(num)) return 100 + num;
  return 5000;
}

/** Sort a copy of `arr` from small to large by the size name `get` returns. */
export function sortBySize<T>(arr: T[], get: (t: T) => string | null | undefined): T[] {
  return [...arr].sort(
    (a, b) =>
      sizeRank(get(a)) - sizeRank(get(b)) ||
      String(get(a) ?? "").localeCompare(String(get(b) ?? ""))
  );
}
