import { getDeals } from "@/lib/storefront";
import ProductCard from "@/components/shop/ProductCard";
import { Tag } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Deals | EssenceFit" };

export default async function DealsPage() {
  const deals = await getDeals(60);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-primary/10 p-2.5 rounded-lg"><Tag className="w-6 h-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deals & Offers</h1>
          <p className="text-sm text-gray-500">{deals.length} product{deals.length !== 1 ? "s" : ""} on sale</p>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No active deals right now. Check back soon!</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {deals.map((p) => <ProductCard key={p.Id} p={p} />)}
        </div>
      )}
    </div>
  );
}
