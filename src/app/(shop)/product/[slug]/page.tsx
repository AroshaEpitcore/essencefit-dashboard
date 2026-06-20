import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, getProductVariants, getRelatedProducts, getProductImagesByColor } from "@/lib/storefront";
import ProductView from "@/components/shop/ProductView";
import ProductCard from "@/components/shop/ProductCard";
import { money, discountPct } from "@/components/shop/format";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: `${product.Name} | EssenceFit`,
    description: product.Description?.slice(0, 160) || product.Name,
    openGraph: { images: product.ImageUrl ? [product.ImageUrl] : [] },
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

  const [variants, images, related] = await Promise.all([
    getProductVariants(product.Id),
    getProductImagesByColor(product.Id),
    product.CategoryId ? getRelatedProducts(product.CategoryId, product.Id, 4) : Promise.resolve([]),
  ]);

  // Colourless products keep using the flat image list as their "shared" set.
  const hasColorImages = Object.keys(images.byColor).length > 0;
  if (images.shared.length === 0 && !hasColorImages) images.shared = product.Images;

  const pct = discountPct(product.SellingPrice, product.CompareAtPrice);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
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

      <ProductView
        product={{
          Id: product.Id, Name: product.Name, Slug: product.Slug, ImageUrl: product.ImageUrl,
          SellingPrice: product.SellingPrice, CompareAtPrice: product.CompareAtPrice,
        }}
        variants={variants}
        images={images}
        initialColorId={color ?? null}
        header={
          <>
            {product.CategoryName && <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{product.CategoryName}</p>}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{product.Name}</h1>
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
          </>
        }
        footer={
          product.Description ? (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="font-semibold text-gray-900 mb-2">Description</h2>
              <p className="text-gray-600 whitespace-pre-line leading-relaxed">{product.Description}</p>
            </div>
          ) : null
        }
      />

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-bold text-gray-900 mb-5">You may also like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {related.map((p) => <ProductCard key={p.Id} p={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
