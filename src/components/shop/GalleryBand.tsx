import { getLatestGalleryItems } from "@/lib/storefront";
import GallerySection from "./GallerySection";

/* Drop-in "Custom orders" slider band for storefront pages: fetches all
   published gallery items and renders the sliding GallerySection. Meant to
   sit inside a page's existing max-width container, after the main content.
   Renders nothing when the gallery is empty. */
export default async function GalleryBand({ title = "Custom orders, made real" }: { title?: string }) {
  const items = await getLatestGalleryItems(100);
  if (!items.length) return null;
  return (
    <div className="mt-14">
      <GallerySection items={items} title={title} />
    </div>
  );
}
