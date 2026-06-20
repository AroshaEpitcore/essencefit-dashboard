"use client";

import { createContext, useCallback, useContext, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import ProductView from "./ProductView";
import { money, discountPct } from "./format";
import { getQuickViewData } from "@/app/(shop)/quickview-actions";
import { displayFont, headingFont } from "@/lib/fonts";
import type { QuickView } from "@/lib/storefront";

type Ctx = { open: (productId: string) => void };
const QuickViewContext = createContext<Ctx | null>(null);

export function useQuickView() {
  const c = useContext(QuickViewContext);
  if (!c) throw new Error("useQuickView must be used within QuickViewProvider");
  return c;
}

export function QuickViewProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<QuickView | null>(null);

  const open = useCallback(async (productId: string) => {
    setIsOpen(true);
    setLoading(true);
    setData(null);
    try {
      setData(await getQuickViewData(productId));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const close = () => setIsOpen(false);

  return (
    <QuickViewContext.Provider value={{ open }}>
      {children}

      <div className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`} aria-hidden={!isOpen}>
        {/* backdrop */}
        <div
          onClick={close}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
        />
        {/* drawer */}
        <aside
          className={`${displayFont.className} ${headingFont.variable} store-headings absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto transition-transform duration-300 ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <span className="font-semibold text-gray-900">Quick view</span>
            <button onClick={close} className="text-gray-400 hover:text-gray-700" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
              </div>
            )}

            {!loading && data && (
              <ProductView
                product={{
                  Id: data.product.Id, Name: data.product.Name, Slug: data.product.Slug,
                  ImageUrl: data.product.ImageUrl, SellingPrice: data.product.SellingPrice,
                  CompareAtPrice: data.product.CompareAtPrice,
                }}
                variants={data.variants}
                images={data.images}
                stacked
                header={
                  <>
                    {data.product.CategoryName && (
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{data.product.CategoryName}</p>
                    )}
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{data.product.Name}</h2>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-2xl font-bold text-gray-900">{money(data.product.SellingPrice)}</span>
                      {discountPct(data.product.SellingPrice, data.product.CompareAtPrice) > 0 && (
                        <>
                          <span className="text-base text-gray-400 line-through">{money(data.product.CompareAtPrice)}</span>
                          <span className="text-sm font-semibold text-primary">
                            -{discountPct(data.product.SellingPrice, data.product.CompareAtPrice)}%
                          </span>
                        </>
                      )}
                    </div>
                  </>
                }
                footer={
                  <Link
                    href={`/product/${data.product.Slug}`}
                    onClick={close}
                    className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    View full details →
                  </Link>
                }
              />
            )}

            {!loading && !data && (
              <p className="text-center text-gray-500 py-20">This product is unavailable.</p>
            )}
          </div>
        </aside>
      </div>
    </QuickViewContext.Provider>
  );
}
