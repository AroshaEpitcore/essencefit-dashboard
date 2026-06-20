/** Turn a product/category name into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // drop non-alphanumerics
    .replace(/\s+/g, "-") // spaces → hyphens
    .replace(/-+/g, "-") // collapse repeats
    .replace(/^-|-$/g, "") // trim hyphens
    .slice(0, 80);
}

/** Slug guaranteed unique by appending a short id fragment. */
export function slugWithId(name: string, id: string): string {
  const base = slugify(name) || "item";
  return `${base}-${id.replace(/-/g, "").slice(0, 8)}`;
}
