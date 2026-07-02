import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, searchProducts, getReviewsByCategory } from "@/lib/storefront";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import ProductCard from "@/components/shop/ProductCard";
import ReviewsSection from "@/components/shop/ReviewsSection";
import { ChevronRight } from "lucide-react";
import { buildCategoryDescription, breadcrumbJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return { title: "Category" };
  const description = buildCategoryDescription(cat.Name, cat.Description, cat.ProductCount);
  return {
    title: cat.Name,
    description,
    alternates: { canonical: `/category/${cat.Slug}` },
    openGraph: { title: cat.Name, description, url: `/category/${cat.Slug}`, images: cat.ImageUrl ? [{ url: cat.ImageUrl }] : undefined },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();

  const [products, reviews, settings] = await Promise.all([
    searchProducts({ categorySlug: slug }),
    getReviewsByCategory(slug),
    getPublicStoreSettings(),
  ]);

  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: cat.Name, path: `/category/${cat.Slug}` },
  ]);

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700">{cat.Name}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{cat.Name}</h1>
        {cat.Description && <p className="text-gray-500 mt-1">{cat.Description}</p>}
        <p className="text-sm text-gray-400 mt-1">{products.length} product{products.length !== 1 ? "s" : ""}</p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No products in this category yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
          {products.map((p) => <ProductCard key={p.Id} p={p} />)}
        </div>
      )}

      {reviews.length > 0 && (
        <div className="mt-14">
          <ReviewsSection reviews={reviews} title={`Reviews in ${cat.Name}`} showProduct bare logo={settings.logoLight || settings.logo} />
        </div>
      )}
    </div>
  );
}
