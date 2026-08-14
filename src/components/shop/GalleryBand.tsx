import { getLatestGalleryItems, getGalleryItemsForProduct } from "@/lib/storefront";
import GallerySection from "./GallerySection";

/* Drop-in "Custom orders" slider band for storefront pages: fetches published
   gallery items and renders the sliding GallerySection. Meant to sit inside a
   page's existing max-width container, after the main content.

   When `productId` is given (PDP), it shows the items an admin assigned to that
   product; if none are assigned it falls back to all published items — so the
   band always appears. Renders nothing only when the gallery is entirely empty. */
export default async function GalleryBand({
  title,
  productId,
}: {
  title?: string;
  productId?: string;
}) {
  const assigned = productId ? await getGalleryItemsForProduct(productId) : [];
  const isProductSpecific = assigned.length > 0;
  const items = isProductSpecific ? assigned : await getLatestGalleryItems(100);
  if (!items.length) return null;

  const heading = title ?? (isProductSpecific ? "Custom orders like this" : "Custom orders, made real");
  return (
    <div className="mt-14">
      <GallerySection items={items} title={heading} />
    </div>
  );
}
