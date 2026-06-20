import Link from "next/link";
import { PackageSearch } from "lucide-react";

export default function ShopNotFound() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <PackageSearch className="w-16 h-16 mx-auto text-gray-300 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
      <p className="text-gray-500 mb-6">The product or page you&apos;re looking for doesn&apos;t exist or was removed.</p>
      <Link href="/shop" className="inline-block bg-primary text-white px-8 py-3 rounded-full font-semibold hover:bg-primary/90">
        Browse products
      </Link>
    </div>
  );
}
