import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { money, discountPct } from "./format";
import ProductTags from "./ProductTags";
import type { StoreProduct } from "@/lib/storefront";

/* Home-page spotlight for a single product, laid out like the PDP first section
   (large image left, name / price / sale / CTA right). */
export default function WeeklyMvp({ product }: { product: StoreProduct }) {
  const pct = discountPct(product.SellingPrice, product.CompareAtPrice);

  return (
    <section className="max-w-[1920px] mx-auto px-4 sm:px-6 py-14">
      {/* Section heading — matches the other home sections */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-1">Our Selection</p>
        <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide text-gray-900 inline-block border-b-2 border-primary pb-1">
          Weekly MVP
        </h2>
      </div>

      {/* PDP-style first section: image left (capped width), details right */}
      <div className="grid md:grid-cols-[minmax(0,540px)_1fr] gap-8 lg:gap-12 items-center">
        <Link href={`/product/${product.Slug}`} className="block group">
          <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
            {product.ImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.ImageUrl}
                alt={product.Name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
            {pct > 0 && (
              <span className="absolute top-4 left-4 bg-primary text-white text-sm font-bold px-3 py-1 rounded-full">
                -{pct}%
              </span>
            )}
          </div>
        </Link>

        <div className="md:py-6">
          <ProductTags isNew={product.IsNewArrival} onSale={pct > 0} className="mb-3" />
          {product.CategoryName && (
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{product.CategoryName}</p>
          )}
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{product.Name}</h3>

          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-gray-900">{money(product.SellingPrice)}</span>
            {pct > 0 && (
              <>
                <span className="text-lg text-gray-400 line-through">{money(product.CompareAtPrice)}</span>
                <span className="text-sm font-semibold text-primary">-{pct}%</span>
              </>
            )}
          </div>

          <p className="text-gray-500 leading-relaxed mb-8 max-w-md">
            This week&apos;s pick from our collection — fresh, in demand, and ready to ship.
          </p>

          <Link
            href={`/product/${product.Slug}`}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white px-8 py-3.5 font-semibold hover:bg-gray-800 transition-colors"
          >
            Shop now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
