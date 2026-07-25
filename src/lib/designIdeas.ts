import "server-only";

/* Print-design inspiration feed for the storefront /designs page and the home
   teaser. Pulls openly-licensed images from the Wikimedia Commons API so the
   grid auto-populates and is searchable — no database, admin library, or API
   key required. Commons is bot-friendly with no low daily cap (unlike keyless
   Openverse, whose 200/day anon limit made it unreliable from Vercel), so it
   works consistently from serverless. Images are CC/PD-licensed; we surface
   creator + license for attribution. */

export type DesignIdea = {
  id: string;
  title: string;
  thumb: string; // thumbnail URL (grid)
  full: string; // full-size URL (lightbox)
  source: string; // Commons page to view/credit the original
  creator: string;
  license: string; // e.g. "CC BY-SA 4.0"
  licenseUrl: string;
};

export type DesignFeed = {
  results: DesignIdea[];
  page: number;
  hasMore: boolean;
};

const COMMONS = "https://commons.wikimedia.org/w/api.php";
export const DEFAULT_DESIGN_QUERY = "t-shirt print design";

// Curated starter searches shown as chips (guide users toward print-worthy art).
export const DESIGN_TOPICS = [
  "typography",
  "streetwear",
  "vintage",
  "floral pattern",
  "anime",
  "logo",
  "minimalist",
  "abstract art",
  "sport",
  "retro poster",
];

function stripHtml(s: string): string {
  return String(s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(fileTitle: string): string {
  return String(fileTitle || "")
    .replace(/^File:/i, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

export async function fetchDesignIdeas(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<DesignFeed> {
  const q = (opts.q || DEFAULT_DESIGN_QUERY).trim() || DEFAULT_DESIGN_QUERY;
  const page = Math.max(1, Math.min(Math.floor(opts.page || 1), 30));
  const pageSize = Math.max(1, Math.min(Math.floor(opts.pageSize || 30), 50));
  const offset = (page - 1) * pageSize;

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    // Namespace 6 = File; bias the search toward image files.
    gsrsearch: `${q} filetype:bitmap|drawing`,
    gsrnamespace: "6",
    gsrlimit: String(pageSize),
    gsroffset: String(offset),
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "500",
    origin: "*",
  });

  try {
    const res = await fetch(`${COMMONS}?${params.toString()}`, {
      headers: { "User-Agent": "EssenceFit/1.0 (print design ideas; epitcore@gmail.com)" },
      // Cache per query for 30 min to stay fast without serving stale-forever.
      next: { revalidate: 1800 },
    });
    if (!res.ok) return { results: [], page, hasMore: false };

    const data = await res.json();
    const pages: Record<string, Record<string, unknown>> = data?.query?.pages || {};

    const results: DesignIdea[] = Object.values(pages)
      .map((p): DesignIdea | null => {
        const info = (p.imageinfo as Array<Record<string, unknown>> | undefined)?.[0];
        if (!info) return null;
        const mime = String(info.mime || "");
        const thumb = String(info.thumburl || "");
        if (!thumb || !mime.startsWith("image/")) return null;
        const meta = (info.extmetadata as Record<string, { value?: string }>) || {};
        return {
          id: String(p.pageid ?? p.title ?? thumb),
          title: cleanTitle(meta.ObjectName?.value || String(p.title || "")) || "Design idea",
          thumb,
          full: String(info.url || thumb),
          source: String(info.descriptionurl || info.url || ""),
          creator: stripHtml(meta.Artist?.value || ""),
          license: stripHtml(meta.LicenseShortName?.value || ""),
          licenseUrl: String(meta.LicenseUrl?.value || ""),
        };
      })
      .filter((d): d is DesignIdea => !!d);

    // `continue` present ⇒ more results available for this query.
    const hasMore = !!data?.continue && results.length > 0;
    return { results, page, hasMore };
  } catch {
    return { results: [], page, hasMore: false };
  }
}
