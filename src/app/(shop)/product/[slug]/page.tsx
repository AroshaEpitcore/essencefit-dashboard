import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, getProductVariants, getRelatedProducts, getProductImagesByColor, getProductDesigns, getReviewsForProduct, getProductRatingSummary } from "@/lib/storefront";
import ProductView from "@/components/shop/ProductView";
import DesignPicker from "@/components/shop/DesignPicker";
import ProductCard from "@/components/shop/ProductCard";
import ProductTags from "@/components/shop/ProductTags";
import ReviewsSection from "@/components/shop/ReviewsSection";
import GalleryBand from "@/components/shop/GalleryBand";
import ReviewStars from "@/components/shop/ReviewStars";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import SizeChartButton from "@/components/shop/SizeChartButton";
import { money, discountPct } from "@/components/shop/format";
import { ChevronRight, Truck, ShieldCheck, RotateCcw, BadgeCheck } from "lucide-react";
import { buildProductDescription, breadcrumbJsonLd, productJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const description = buildProductDescription(product.Name, product.CategoryName, product.Description);
  const images = product.Images.length ? product.Images : product.ImageUrl ? [product.ImageUrl] : [];
  return {
    title: product.Name,
    description,
    alternates: { canonical: `/product/${product.Slug}` },
    openGraph: { title: product.Name, description, url: `/product/${product.Slug}`, images, type: "website" },
    twitter: { card: "summary_large_image", title: product.Name, description, images },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const { color } = await searchParams;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [variants, images, related, designs, reviews, rating, settings] = await Promise.all([
    getProductVariants(product.Id),
    getProductImagesByColor(product.Id),
    product.CategoryId ? getRelatedProducts(product.CategoryId, product.Id, 4) : Promise.resolve([]),
    product.SelectByImage ? getProductDesigns(product.Id) : Promise.resolve([]),
    getReviewsForProduct(product.Id),
    getProductRatingSummary(product.Id),
    getPublicStoreSettings(),
  ]);

  // Colourless products keep using the flat image list as their "shared" set.
  const hasColorImages = Object.keys(images.byColor).length > 0;
  if (images.shared.length === 0 && !hasColorImages) images.shared = product.Images;

  const pct = discountPct(product.SellingPrice, product.CompareAtPrice);

  const productLite = {
    Id: product.Id, Name: product.Name, Slug: product.Slug, ImageUrl: product.ImageUrl,
    SellingPrice: product.SellingPrice, CompareAtPrice: product.CompareAtPrice,
  };
  const headerSlot = (
    <div>
      <ProductTags isNew={product.IsNewArrival} onSale={pct > 0} className="mb-3" />
      {product.CategoryName && <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{product.CategoryName}</p>}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{product.Name}</h1>
      {rating.count > 0 && (
        <a href="#reviews" className="group flex items-center gap-2 mb-3 -mt-1">
          <ReviewStars value={rating.avg} />
          <span className="text-sm text-gray-500 group-hover:text-primary">
            {rating.avg.toFixed(1)} ({rating.count} review{rating.count !== 1 ? "s" : ""})
          </span>
        </a>
      )}
      {/* Server-rendered price (in HTML for SEO / instant paint) */}
      <div className="flex items-baseline gap-3 mb-5">
        <span className="text-3xl font-bold text-gray-900">{money(product.SellingPrice)}</span>
        {pct > 0 && (
          <>
            <span className="text-lg text-gray-400 line-through">{money(product.CompareAtPrice)}</span>
            <span className="text-sm font-semibold text-primary">-{pct}%</span>
          </>
        )}
      </div>
      {product.SizeChartUrl && (
        <div className="mb-5">
          <SizeChartButton url={product.SizeChartUrl} />
        </div>
      )}
    </div>
  );
  // First non-empty line reads as the lead paragraph; any further lines become bullets —
  // there's no separate "features" field, so this is derived straight from Description.
  const descLines = (product.Description ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const [descLead, ...descBullets] = descLines;

  const trustBadges = [
    { Icon: Truck, text: "Island-wide delivery" },
    { Icon: ShieldCheck, text: "Safe & secure payment" },
    { Icon: RotateCcw, text: "Easy returns & exchanges" },
    { Icon: BadgeCheck, text: "Quality guaranteed" },
  ];

  const footerSlot = descLead ? (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <h2 className="text-lg font-light uppercase tracking-[0.2em] text-gray-900 mb-4">Description</h2>
      <p className="font-bold uppercase text-sm leading-relaxed text-gray-900">{descLead}</p>

      {descBullets.length > 0 && (
        <ul className="mt-4 space-y-2 list-disc pl-5">
          {descBullets.map((line, i) => (
            <li key={i} className="font-bold uppercase text-sm text-gray-900">{line}</li>
          ))}
        </ul>
      )}

      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6">
        {trustBadges.map(({ Icon, text }) => (
          <div key={text} className="flex flex-col gap-2">
            <Icon className="w-6 h-6 text-gray-900" strokeWidth={1.75} />
            <span className="text-sm font-bold text-gray-900">{text}</span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const productLd = productJsonLd({
    name: product.Name,
    slug: product.Slug,
    description: buildProductDescription(product.Name, product.CategoryName, product.Description),
    images: product.Images.length ? product.Images : product.ImageUrl ? [product.ImageUrl] : [],
    sellingPrice: product.SellingPrice,
    inStock: variants.some((v) => v.Qty > 0) || product.Stock > 0,
    rating: rating.count > 0 ? rating : null,
  });
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    ...(product.CategoryName && product.CategorySlug ? [{ name: product.CategoryName, path: `/category/${product.CategorySlug}` }] : []),
    { name: product.Name, path: `/product/${product.Slug}` },
  ]);

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6 flex-wrap">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="w-4 h-4" />
        {product.CategoryName && product.CategorySlug && (
          <>
            <Link href={`/category/${product.CategorySlug}`} className="hover:text-primary">{product.CategoryName}</Link>
            <ChevronRight className="w-4 h-4" />
          </>
        )}
        <span className="text-gray-700">{product.Name}</span>
      </nav>

      {product.SelectByImage ? (
        <DesignPicker product={productLite} designs={designs} header={headerSlot} footer={footerSlot} />
      ) : (
        <ProductView
          product={productLite}
          variants={variants}
          images={images}
          initialColorId={color ?? null}
          header={headerSlot}
          footer={footerSlot}
          tryOnEnabled={Boolean(process.env.GEMINI_API_KEY)}
        />
      )}

      {reviews.length > 0 && (
        <div id="reviews" className="mt-14 scroll-mt-[140px]">
          <ReviewsSection reviews={reviews} title="Customer Reviews" variant="carousel" bare logo={settings.logoLight || settings.logo} />
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-bold text-gray-900 mb-5">You may also like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {related.map((p) => <ProductCard key={p.Id} p={p} />)}
          </div>
        </section>
      )}

      <GalleryBand />
    </div>
  );
}
