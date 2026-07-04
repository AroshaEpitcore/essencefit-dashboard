"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

/* Weekly MVP buy box — the PDP right-column experience on the home page:
   image left (swaps with the chosen colour), server-rendered header slot +
   the real AddToCart (colour/size/qty/add) right. Same colour-state wiring
   as ProductView, minus the full gallery/sticky bar. */
export default function MvpBuyBox({
  product,
  variants,
  images,
  header,
  salePct,
}: {
  product: ProductLite;
  variants: StoreVariant[];
  images: ProductImagesByColor;
  header: React.ReactNode;
  salePct: number;
}) {
  const hasColors = variants.some((v) => v.ColorId);
  const firstColor =
    variants.find((v) => v.ColorId && v.Qty > 0)?.ColorId ?? variants.find((v) => v.ColorId)?.ColorId ?? null;
  const [colorId, setColorId] = useState<string | null>(hasColors ? firstColor : "none");

  const currentImage = useMemo(() => {
    if (colorId && colorId !== "none" && images.byColor[colorId]?.length) return images.byColor[colorId][0];
    if (hasColors) {
      const firstWithImages = Object.values(images.byColor).find((a) => a.length);
      if (firstWithImages) return firstWithImages[0];
    }
    return images.shared[0] ?? product.ImageUrl;
  }, [colorId, images, product.ImageUrl, hasColors]);

  return (
    <div className="grid md:grid-cols-[minmax(0,540px)_1fr] gap-8 lg:gap-12 items-center">
      <Link href={`/product/${product.Slug}`} className="block group">
        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
          {currentImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentImage}
              alt={product.Name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
          {salePct > 0 && (
            <span className="absolute top-4 left-4 bg-primary text-white text-sm font-bold px-3 py-1 rounded-full">
              -{salePct}%
            </span>
          )}
        </div>
      </Link>

      <div>
        {header}
        <AddToCart
          product={product}
          variants={variants}
          colorId={colorId}
          setColorId={setColorId}
          currentImage={currentImage}
        />
        <Link
          href={`/product/${product.Slug}`}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-primary hover:gap-2.5 transition-all"
        >
          View full details <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
