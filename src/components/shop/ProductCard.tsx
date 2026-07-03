"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, ShoppingCart } from "lucide-react";
import type { StoreProduct } from "@/lib/storefront";
import { money, discountPct } from "./format";
import { resolveSwatch, cutLineColor } from "@/lib/colorHex";
import { useWishlist } from "./WishlistContext";
import { useQuickView } from "./QuickView";
import QuickViewButton from "./QuickViewButton";
import ProductTags from "./ProductTags";

// Warm the browser cache for colour images so switching swatches is instant
// instead of waiting on a network fetch. De-duped via a module-level set.
const preloaded = new Set<string>();
function preloadImg(url?: string | null) {
  if (!url || preloaded.has(url) || typeof window === "undefined") return;
  preloaded.add(url);
  const img = new window.Image();
  img.decoding = "async";
  img.src = url;
}

export default function ProductCard({ p }: { p: StoreProduct }) {
  const pct = discountPct(p.SellingPrice, p.CompareAtPrice);
  const outOfStock = p.Stock <= 0;
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const { has, toggle } = useWishlist();
  const { open: openQuickView } = useQuickView();
  const wished = has(p.Id);

  // Show a chip for EVERY colour of the product. Colours with a photo change the
  // card image when clicked; colours without one just select + carry to the PDP.
  const swatchColors = p.Colors;
  const colorsWithImages = p.Colors.filter((c) => c.ImageUrl);
  // Active colour = the clicked one, else the first colour that has a photo.
  const activeColorObj = (activeColor ? p.Colors.find((c) => c.Id === activeColor) : null) || colorsWithImages[0] || null;
  const baseImage = activeColorObj?.ImageUrl || p.ImageUrl;
  // Hover shows the SAME colour's 2nd image; only fall back to the product's 2nd image
  // when the product has no per-colour photos at all.
  const hoverCandidate = activeColorObj?.ImageUrl2 ?? (activeColorObj ? null : p.HoverImageUrl);
  const hoverImage = hoverCandidate && hoverCandidate !== baseImage ? hoverCandidate : null;
  const href = activeColor ? `/product/${p.Slug}?color=${activeColor}` : `/product/${p.Slug}`;

  // Preload every colour's photos when the user shows interest in the card.
  const preloadColors = () => {
    for (const c of p.Colors) {
      preloadImg(c.ImageUrl);
      preloadImg(c.ImageUrl2);
    }
    preloadImg(p.HoverImageUrl);
  };

  return (
    <div className="text-left flex flex-col h-full" onMouseEnter={preloadColors}>
      {/* Image — 4:5, matching the reference card's real image ratio (1050x1313);
          hovering ONLY this area reveals the secondary image */}
      <div className="group relative aspect-[4/5] rounded-lg bg-gray-100 overflow-hidden">
        <Link href={href} className="block w-full h-full">
          {baseImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={baseImage}
                alt={p.Name}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${hoverImage ? "group-hover:opacity-0" : ""}`}
              />
              {hoverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hoverImage}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                />
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No image</div>
          )}
        </Link>

        <ProductTags
          isNew={p.IsNewArrival}
          onSale={pct > 0}
          className="absolute top-2 right-2 z-10 flex-col items-end"
        />
        <button
          type="button"
          onClick={() => toggle({ productId: p.Id, name: p.Name, slug: p.Slug, image: baseImage, price: p.SellingPrice, compareAt: p.CompareAtPrice })}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center text-gray-700 hover:text-red-500 shadow-sm"
        >
          <Heart className={`w-4 h-4 ${wished ? "fill-red-500 text-red-500" : ""}`} />
        </button>
        {outOfStock && (
          <span className="absolute inset-0 z-10 bg-white/55 flex items-center justify-center text-gray-700 font-semibold pointer-events-none">
            Sold out
          </span>
        )}
        <QuickViewButton productId={p.Id} />
      </div>

      {/* Info */}
      <div className="pt-2 flex flex-col flex-1">
        <Link href={href} className="block">
          <h3 className="text-sm font-medium text-gray-900 line-clamp-1">{p.Name}</h3>
        </Link>

        <div className="mt-0.5 flex items-baseline gap-2">
          {pct > 0 && <span className="text-sm text-gray-400 line-through">{money(p.CompareAtPrice)}</span>}
          <span className="text-sm font-bold text-gray-900">{money(p.SellingPrice)}</span>
        </div>

        {/* Colour chips — click/hover changes the card image to that colour's photo */}
        {swatchColors.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {swatchColors.slice(0, 6).map((c) => {
              const sw = resolveSwatch(c.Name, c.Hex);
              const selected = activeColor === c.Id;
              return (
                <button
                  key={c.Id}
                  type="button"
                  title={c.Name + (c.InStock ? "" : " — sold out")}
                  aria-label={c.Name}
                  onMouseEnter={() => { preloadImg(c.ImageUrl); preloadImg(c.ImageUrl2); }}
                  onTouchStart={() => { preloadImg(c.ImageUrl); preloadImg(c.ImageUrl2); }}
                  onClick={() => setActiveColor((cur) => (cur === c.Id ? null : c.Id))}
                  className={`relative w-7 h-7 rounded-sm overflow-hidden border ${selected ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-300"} hover:border-gray-500`}
                >
                  <span
                    className="absolute inset-0"
                    style={
                      sw.hex
                        ? { backgroundColor: sw.hex }
                        : { backgroundImage: "linear-gradient(135deg,#e5e7eb 0 50%,#9ca3af 50% 100%)" }
                    }
                  />
                  {!c.InStock && (
                    <span
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundImage: `linear-gradient(45deg, transparent calc(50% - 0.6px), ${cutLineColor(sw.hex)} calc(50% - 0.6px), ${cutLineColor(sw.hex)} calc(50% + 0.6px), transparent calc(50% + 0.6px))`,
                      }}
                    />
                  )}
                </button>
              );
            })}
            {swatchColors.length > 6 && <span className="text-[11px] text-gray-400">+{swatchColors.length - 6}</span>}
          </div>
        )}

        <div className="mt-auto pt-2">
          <button
            type="button"
            onClick={() => openQuickView(p.Id)}
            disabled={outOfStock}
            className="w-full rounded-lg border border-gray-900 bg-white text-gray-900 text-xs sm:text-sm font-semibold py-1.5 flex items-center justify-center gap-1.5 hover:bg-gray-900 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
