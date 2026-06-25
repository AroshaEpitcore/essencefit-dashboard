"use server";

import { searchProductsLite, type LiteProduct } from "@/lib/storefront";

/* Type-ahead search for the header search drawer (called from the client). */
export async function quickSearch(q: string): Promise<LiteProduct[]> {
  return searchProductsLite(q, 6);
}
