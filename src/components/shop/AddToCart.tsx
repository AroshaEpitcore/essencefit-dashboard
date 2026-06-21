"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { useCart } from "./CartContext";
import { sizeRank } from "./format";
import { resolveSwatch, cutLineColor } from "@/lib/colorHex";
import type { StoreVariant } from "@/lib/storefront";

type ProductLite = {
  Id: string;
  Name: string;
  Slug: string;
  ImageUrl: string | null;
  SellingPrice: number;
  CompareAtPrice: number | null;
};

function uniqBy<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Diagonal "cut" line for unavailable options — colour auto-contrasts with the swatch.
function CutLine({ hex }: { hex: string | null }) {
  const c = cutLineColor(hex);
  return (
    <span
      className="absolute inset-0 pointer-events-none "
      style={{
        backgroundImage: `linear-gradient(to top right, transparent calc(50% - 0.75px), ${c} calc(50% - 0.75px), ${c} calc(50% + 0.75px), transparent calc(50% + 0.75px))`,
      }}
    />
  );
}

export default function AddToCart({
  product,
  variants,
  colorId,
  setColorId,
  currentImage,
}: {
  product: ProductLite;
  variants: StoreVariant[];
  colorId: string | null;
  setColorId: (id: string | null) => void;
  currentImage?: string | null;
}) {
  const { addItem } = useCart();
  const router = useRouter();

  const hasSizes = variants.some((v) => v.SizeId);
  const hasColors = variants.some((v) => v.ColorId);

  // ALL colours / sizes that this product has (regardless of stock)
  const allColors = useMemo(
    () =>
      uniqBy(variants.filter((v) => v.ColorId), (v) => v.ColorId!).map((v) => ({
        id: v.ColorId!,
        name: v.ColorName || "",
        hex: v.ColorHex,
      })),
    [variants]
  );
  const allSizes = useMemo(
    () =>
      uniqBy(variants.filter((v) => v.SizeId), (v) => v.SizeId!)
        .map((v) => ({ id: v.SizeId!, name: v.SizeName || "" }))
        .sort((a, b) => sizeRank(a.name) - sizeRank(b.name)),
    [variants]
  );

  const [sizeId, setSizeId] = useState<string | null>(hasSizes ? null : "none");
  const [qty, setQty] = useState(1);

  // availability that respects the OTHER current selection
  const colorAvailable = (cid: string) =>
    variants.some(
      (v) => v.ColorId === cid && (!hasSizes || !sizeId || sizeId === "none" || v.SizeId === sizeId) && v.Qty > 0
    );
  const sizeAvailable = (sid: string) =>
    variants.some(
      (v) => v.SizeId === sid && (!hasColors || !colorId || colorId === "none" || v.ColorId === colorId) && v.Qty > 0
    );

  const variant = useMemo(
    () =>
      variants.find(
        (v) => (!hasColors || v.ColorId === colorId) && (!hasSizes || v.SizeId === sizeId)
      ),
    [variants, colorId, sizeId, hasColors, hasSizes]
  );

  const stock = variant?.Qty ?? 0;
  const price = variant?.SellingPrice ?? product.SellingPrice;
  const variantPriceDiffers = !!variant && variant.SellingPrice !== product.SellingPrice;
  const canAdd = !!variant && stock > 0;

  // Available qty for the current selection: a specific variant once size is picked,
  // else the total across that colour's sizes. Shown once a colour is chosen.
  const colourChosen = !hasColors || (!!colorId && colorId !== "none");
  const availableQty = useMemo(
    () =>
      variants
        .filter((v) => (!hasColors || v.ColorId === colorId) && (!hasSizes || !sizeId || v.SizeId === sizeId))
        .reduce((sum, v) => sum + Math.max(0, v.Qty), 0),
    [variants, colorId, sizeId, hasColors, hasSizes]
  );

  function add(buyNow = false) {
    if (hasColors && (!colorId || colorId === "none")) return toast.error("Please choose a colour.");
    if (hasSizes && !sizeId) return toast.error("Please choose a size.");
    if (!variant || stock <= 0) return toast.error("That option is sold out.");

    addItem({
      variantId: variant.VariantId,
      productId: product.Id,
      name: product.Name,
      slug: product.Slug,
      image: currentImage ?? product.ImageUrl,
      size: variant.SizeName,
      color: variant.ColorName,
      price,
      qty: Math.min(qty, stock),
      maxStock: stock,
    });
    if (buyNow) router.push("/cart");
    else toast.success("Added to cart");
  }

  return (
    <div>
      <Toaster position="top-center" />

      {variantPriceDiffers && (
        <div className="mb-5 text-sm text-gray-600">
          Selected option: <span className="font-bold text-gray-900">Rs. {price.toLocaleString("en-LK")}</span>
        </div>
      )}

      {/* COLOUR */}
      {hasColors && (
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-wide text-gray-700 mb-2">
            COLOUR{colorId && colorId !== "none" ? `: ${allColors.find((c) => c.id === colorId)?.name ?? ""}` : ""}
          </p>
          <div className="flex flex-wrap gap-2.5">
            {allColors.map((c) => {
              const avail = colorAvailable(c.id);
              const sw = resolveSwatch(c.name, c.hex);
              const selected = colorId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!avail}
                  title={c.name + (avail ? "" : " — sold out")}
                  onClick={() => setColorId(c.id)}
                  className={`relative w-11 h-11 rounded-sm border-2 overflow-hidden transition-[border-color] ${
                    selected ? "border-gray-900" : "border-gray-200"
                  } ${!avail ? "cursor-not-allowed opacity-70" : "hover:border-gray-400"}`}
                >
                  <span
                    className="absolute inset-0"
                    style={
                      sw.hex
                        ? { backgroundColor: sw.hex }
                        : { backgroundImage: "linear-gradient(135deg,#e5e7eb 0 50%,#9ca3af 50% 100%)" }
                    }
                  />
                  {!avail && <CutLine hex={sw.hex} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SIZE */}
      {hasSizes && (
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-wide text-gray-700 mb-2">SIZE</p>
          <div className="flex flex-wrap gap-2.5">
            {allSizes.map((s) => {
              const avail = sizeAvailable(s.id);
              const selected = sizeId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!avail}
                  title={s.name + (avail ? "" : " — sold out")}
                  onClick={() => setSizeId(s.id)}
                  className={`relative min-w-[3rem] h-11 px-3 rounded-sm border-2 text-sm font-medium flex items-center justify-center transition-[border-color] ${
                    selected ? "border-gray-900 text-gray-900" : "border-gray-200 text-gray-700"
                  } ${!avail ? "cursor-not-allowed text-gray-400" : "hover:border-gray-400"}`}
                >
                  {s.name}
                  {!avail && <CutLine hex={null} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Availability — shown once a colour is chosen; red when low or sold out */}
      {colourChosen && (
        availableQty <= 0 ? (
          <p className="mb-4 text-sm font-semibold text-red-600">Out of stock</p>
        ) : availableQty <= 5 ? (
          <p className="mb-4 text-sm font-semibold text-red-600">Only {availableQty} left in stock</p>
        ) : (
          <p className="mb-4 text-sm font-medium text-green-600">In stock — {availableQty} available</p>
        )
      )}

      {/* Qty + actions */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center border border-gray-300 rounded-sm">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2.5 text-gray-600 hover:text-primary"><Minus className="w-4 h-4" /></button>
          <span className="w-10 text-center font-medium">{qty}</span>
          <button onClick={() => setQty((q) => (canAdd ? Math.min(stock, q + 1) : q + 1))} className="p-2.5 text-gray-600 hover:text-primary"><Plus className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => add(false)}
          disabled={!canAdd}
          className="flex-1 bg-gray-900 text-white py-3.5 font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="w-5 h-5" /> Add to cart
        </button>
        <button
          onClick={() => add(true)}
          disabled={!canAdd}
          className="flex-1 bg-primary text-white py-3.5 font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Buy now
        </button>
      </div>
    </div>
  );
}
