"use server";

import { getQuickView, type QuickView } from "@/lib/storefront";

export async function getQuickViewData(productId: string): Promise<QuickView | null> {
  return getQuickView(productId);
}
