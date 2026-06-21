"use client";

import { useMemo, useState } from "react";
import ProductGallery from "./ProductGallery";
import AddToCart from "./AddToCart";
import type { StoreVariant, ProductImagesByColor } from "@/lib/storefront";

type ProductLite = {
  Id: string;
  Name: string;
  Slug: string;
  ImageUrl: string | null;
  SellingPrice: number;
  CompareAtPrice: number | null;
};

/* Owns the selected colour so the gallery (left) and the picker (right) stay in
   sync. `header` and `footer` are server-rendered slots (name/price/description)
   kept out of the client bundle for SEO/instant paint. */
export default function ProductView({
  product,
  variants,
  images,
  initialColorId,
  header,
  footer,
  stacked = false,
}: {
  product: ProductLite;
  variants: StoreVariant[];
  images: ProductImagesByColor;
  initialColorId?: string | null;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  stacked?: boolean;
}) {
  const hasColors = variants.some((v) => v.ColorId);
  const validInitial =
    initialColorId && variants.some((v) => v.ColorId === initialColorId) ? initialColorId : null;
  // Default to the first in-stock colour so the gallery and picker start in sync.
  const firstColor =
    variants.find((v) => v.ColorId && v.Qty > 0)?.ColorId ?? variants.find((v) => v.ColorId)?.ColorId ?? null;
  const [colorId, setColorId] = useState<string | null>(hasColors ? validInitial ?? firstColor : "none");

  const activeImages = useMemo(() => {
    if (colorId && colorId !== "none" && images.byColor[colorId]?.length) return images.byColor[colorId];
    if (hasColors) {
      const firstWithImages = Object.values(images.byColor).find((a) => a.length);
      if (firstWithImages) return firstWithImages;
    }
    if (images.shared.length) return images.shared;
    return product.ImageUrl ? [product.ImageUrl] : [];
  }, [colorId, images, product.ImageUrl, hasColors]);

  if (stacked) {
    return (
      <div className="flex flex-col gap-6">
        <ProductGallery images={activeImages} name={product.Name} />
        <div>
          {header}
          <AddToCart product={product} variants={variants} colorId={colorId} setColorId={setColorId} currentImage={activeImages[0] ?? product.ImageUrl} />
          {footer}
        </div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
      {/* Gallery — left column, row 1 */}
      <div className="md:col-start-1 md:row-start-1">
        <ProductGallery images={activeImages} name={product.Name} />
      </div>

      {/* Product info — right column, row 1, sticky while the page scrolls
          (top clears the fixed header). On mobile it flows right after the gallery. */}
      <div
        className="md:col-start-2 md:row-start-1 md:sticky self-start"
        style={{ top: "calc(var(--header-h, 132px) + 1.5rem)" }}
      >
        {header}
        <AddToCart product={product} variants={variants} colorId={colorId} setColorId={setColorId} currentImage={activeImages[0] ?? product.ImageUrl} />
      </div>

      {/* Description — left column under the gallery on desktop; last on mobile */}
      {footer && <div className="md:col-start-1 md:row-start-2">{footer}</div>}
    </div>
  );
}
