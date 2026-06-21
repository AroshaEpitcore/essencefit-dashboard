"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { Minus, Plus, ShoppingCart, X } from "lucide-react";
import { useCart } from "./CartContext";
import type { StoreDesign } from "@/lib/storefront";

type ProductLite = {
  Id: string;
  Name: string;
  Slug: string;
  ImageUrl: string | null;
  SellingPrice: number;
  CompareAtPrice: number | null;
};

/* Storefront selector for "select by image" products: each design is a variant
   tied to its image. Picking a thumbnail selects that design; Add to cart uses
   its VariantId so different designs are separate cart lines. */
export default function DesignPicker({
  product,
  designs,
  header,
  footer,
}: {
  product: ProductLite;
  designs: StoreDesign[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { addItem } = useCart();
  const router = useRouter();

  // Default to the first in-stock design, else the first.
  const firstAvailable = designs.findIndex((d) => d.Qty > 0);
  const [sel, setSel] = useState(firstAvailable >= 0 ? firstAvailable : 0);
  const [qty, setQty] = useState(1);
  const [zoom, setZoom] = useState(false);

  const design = designs[sel] as StoreDesign | undefined;
  const stock = design?.Qty ?? 0;
  const canAdd = !!design && stock > 0;

  useEffect(() => { setQty(1); }, [sel]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoom(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [zoom]);

  const designNo = useMemo(() => sel + 1, [sel]);

  function add(buyNow = false) {
    if (!design || stock <= 0) return toast.error("That design is sold out.");
    addItem({
      variantId: design.VariantId,
      productId: product.Id,
      name: `${product.Name} — Design ${sel + 1}`,
      slug: product.Slug,
      image: design.Image,
      size: null,
      color: null,
      price: design.Price,
      qty: Math.min(qty, stock),
      maxStock: stock,
    });
    if (buyNow) router.push("/cart");
    else toast.success("Added to cart");
  }

  if (designs.length === 0) {
    return (
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
        <div className="aspect-square bg-gray-100 flex items-center justify-center text-gray-300">No designs</div>
        <div>{header}{footer}</div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
      <Toaster position="top-center" />

      {/* Selected design — large, click to zoom */}
      <div className="flex flex-col gap-8">
        <div className="aspect-square overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={design?.Image ?? product.ImageUrl ?? ""}
            alt={`${product.Name} design ${designNo}`}
            onClick={() => setZoom(true)}
            className="w-full h-full object-cover cursor-zoom-in"
          />
        </div>
        {footer && <div className="hidden md:block">{footer}</div>}
      </div>

      {/* Info + design picker — sticky */}
      <div className="md:sticky self-start" style={{ top: "calc(var(--header-h, 132px) + 1.5rem)" }}>
        {header}

        <div className="mb-5">
          <p className="text-xs font-semibold tracking-wide text-gray-700 mb-2">
            DESIGN: {designNo} {stock <= 0 && <span className="text-red-600">(sold out)</span>}
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {designs.map((d, i) => {
              const out = d.Qty <= 0;
              const selected = i === sel;
              return (
                <button
                  key={d.VariantId}
                  type="button"
                  onClick={() => setSel(i)}
                  title={out ? "Sold out" : `Design ${i + 1}`}
                  className={`relative aspect-square overflow-hidden rounded border-2 transition-[border-color] ${
                    selected ? "border-gray-900" : "border-gray-200 hover:border-gray-400"
                  } ${out ? "opacity-60" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.Image} alt={`Design ${i + 1}`} className="w-full h-full object-cover" />
                  {out && (
                    <span className="absolute inset-0 bg-white/40 flex items-center justify-center text-[10px] font-semibold text-gray-700">
                      Sold
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Availability */}
        {stock <= 0 ? (
          <p className="mb-4 text-sm font-semibold text-red-600">Out of stock</p>
        ) : stock <= 5 ? (
          <p className="mb-4 text-sm font-semibold text-red-600">Only {stock} left</p>
        ) : (
          <p className="mb-4 text-sm font-medium text-green-600">In stock</p>
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
          <button onClick={() => add(false)} disabled={!canAdd} className="flex-1 bg-gray-900 text-white py-3.5 font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">
            <ShoppingCart className="w-5 h-5" /> Add to cart
          </button>
          <button onClick={() => add(true)} disabled={!canAdd} className="flex-1 bg-primary text-white py-3.5 font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed">
            Buy now
          </button>
        </div>
      </div>

      {/* Mobile description */}
      {footer && <div className="md:hidden">{footer}</div>}

      {/* Zoom lightbox */}
      {zoom && design && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoom(false)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setZoom(false)} aria-label="Close" className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"><X className="w-7 h-7" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={design.Image} alt={`${product.Name} design ${designNo}`} onClick={(e) => e.stopPropagation()} className="max-w-[92vw] max-h-[90vh] object-contain" />
        </div>
      )}
    </div>
  );
}
