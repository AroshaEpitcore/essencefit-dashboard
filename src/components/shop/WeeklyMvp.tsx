import { money, discountPct } from "./format";
import ProductTags from "./ProductTags";
import ReviewStars from "./ReviewStars";
import MvpBuyBox from "./MvpBuyBox";
import type { StoreProduct, StoreVariant, ProductImagesByColor } from "@/lib/storefront";

/* Home-page spotlight for a single product, working like the PDP's right
   detail section: title/rating/price header (server-rendered) plus the real
   AddToCart buy box (colour/size/qty) via MvpBuyBox. */
export default function WeeklyMvp({
  product,
  variants,
  images,
  rating,
}: {
  product: StoreProduct;
  variants: StoreVariant[];
  images: ProductImagesByColor;
  rating: { avg: number; count: number };
}) {
  const pct = discountPct(product.SellingPrice, product.CompareAtPrice);

  const productLite = {
    Id: product.Id,
    Name: product.Name,
    Slug: product.Slug,
    ImageUrl: product.ImageUrl,
    SellingPrice: product.SellingPrice,
    CompareAtPrice: product.CompareAtPrice,
  };

  // Same header block as the PDP right column (server-rendered for SEO).
  const headerSlot = (
    <div>
      <ProductTags isNew={product.IsNewArrival} onSale={pct > 0} className="mb-3" />
      {product.CategoryName && (
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{product.CategoryName}</p>
      )}
      <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{product.Name}</h3>
      {rating.count > 0 && (
        <div className="flex items-center gap-2 mb-3 -mt-1">
          <ReviewStars value={rating.avg} />
          <span className="text-sm text-gray-500">
            {rating.avg.toFixed(1)} ({rating.count} review{rating.count !== 1 ? "s" : ""})
          </span>
        </div>
      )}
      <div className="flex items-baseline gap-3 mb-5">
        <span className="text-3xl font-bold text-gray-900">{money(product.SellingPrice)}</span>
        {pct > 0 && (
          <>
            <span className="text-lg text-gray-400 line-through">{money(product.CompareAtPrice)}</span>
            <span className="text-sm font-semibold text-primary">-{pct}%</span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <section className="max-w-[1920px] mx-auto px-4 sm:px-6 py-14">
      {/* Section heading — matches the other home sections */}
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-1">Our Selection</p>
        <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide text-gray-900 inline-block border-b-2 border-primary pb-1">
          Weekly MVP
        </h2>
      </div>

      <MvpBuyBox product={productLite} variants={variants} images={images} header={headerSlot} salePct={pct} />
    </section>
  );
}
