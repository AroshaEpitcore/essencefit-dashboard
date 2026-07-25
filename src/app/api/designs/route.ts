import { NextRequest, NextResponse } from "next/server";
import { fetchDesignIdeas } from "@/lib/designIdeas";

/* Public JSON API backing the /designs browse page: GET /api/designs?q=&page=
   Proxies the keyless Openverse feed server-side (normalized shape, cached).
   Used by the client grid for search + "load more". */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const page = Number(searchParams.get("page")) || 1;

  const feed = await fetchDesignIdeas({ q, page });
  return NextResponse.json(feed, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
