import "server-only";

/* Print-design inspiration feed for the storefront /designs page and the home
   teaser. Pulls openly-licensed images from the Openverse API (keyless) so the
   grid auto-populates and is searchable — no database, admin-managed library,
   or API key required. Results are CC-licensed; we surface creator + license
   for attribution. */

export type DesignIdea = {
  id: string;
  title: string;
  thumb: string; // thumbnail URL (grid)
  full: string; // full-size URL (lightbox)
  source: string; // page to view/credit the original
  creator: string;
  license: string; // e.g. "CC BY"
  licenseUrl: string;
};

export type DesignFeed = {
  results: DesignIdea[];
  page: number;
  hasMore: boolean;
};

const OPENVERSE = "https://api.openverse.org/v1/images/";
export const DEFAULT_DESIGN_QUERY = "t-shirt print design";

// Curated starter searches shown as chips (guide users toward print-worthy art).
export const DESIGN_TOPICS = [
  "typography",
  "streetwear",
  "vintage",
  "floral",
  "anime",
  "logo",
  "minimalist",
  "abstract",
  "sport",
  "retro",
];

export async function fetchDesignIdeas(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<DesignFeed> {
  const q = (opts.q || DEFAULT_DESIGN_QUERY).trim() || DEFAULT_DESIGN_QUERY;
  const page = Math.max(1, Math.min(Math.floor(opts.page || 1), 20));
  const pageSize = Math.max(1, Math.min(Math.floor(opts.pageSize || 30), 40));

  const params = new URLSearchParams({
    q,
    page: String(page),
    page_size: String(pageSize),
    mature: "false",
  });

  try {
    const res = await fetch(`${OPENVERSE}?${params.toString()}`, {
      headers: { "User-Agent": "EssenceFit/1.0 (print design ideas)" },
      // These change rarely; cache for an hour to stay well within rate limits.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { results: [], page, hasMore: false };

    const data = await res.json();
    const results: DesignIdea[] = (data.results || [])
      .map((r: Record<string, unknown>): DesignIdea => ({
        id: String(r.id ?? ""),
        title: (r.title as string) || "Design idea",
        thumb: (r.thumbnail as string) || (r.url as string) || "",
        full: (r.url as string) || (r.thumbnail as string) || "",
        source: (r.foreign_landing_url as string) || (r.url as string) || "",
        creator: (r.creator as string) || "",
        license: String(r.license ?? "").toUpperCase(),
        licenseUrl: (r.license_url as string) || "",
      }))
      .filter((r: DesignIdea) => r.thumb);

    const hasMore = page < Number(data.page_count || 1);
    return { results, page, hasMore };
  } catch {
    return { results: [], page, hasMore: false };
  }
}
