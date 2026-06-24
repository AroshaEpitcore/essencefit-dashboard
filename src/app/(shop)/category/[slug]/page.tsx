import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, searchProducts } from "@/lib/storefront";
import ProductCard from "@/components/shop/ProductCard";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  return { title: cat ? `${cat.Name} | EssenceFit` : "Category" };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();

  const products = await searchProducts({ categorySlug: slug });

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {products.map((p) => <ProductCard key={p.Id} p={p} />)}
        </div>
      )}
    </div>
  );
}
