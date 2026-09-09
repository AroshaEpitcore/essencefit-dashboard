"use server";

import { getGalleryItems, type GalleryItem } from "@/lib/storefront";

const PAGE_SIZE = 12;

/* Fetches one more page of gallery items for the infinite-scroll grid.
   Mirrors the page's cap so a crafted offset can't force an oversized read. */
export async function loadMoreGalleryItems(
  q: string | undefined,
  offset: number
): Promise<{ items: GalleryItem[]; total: number }> {
  const safeOffset = Math.min(5000, Math.max(0, Math.floor(offset) || 0));
  return getGalleryItems({ q: q?.trim() || undefined, limit: PAGE_SIZE, offset: safeOffset });
}
