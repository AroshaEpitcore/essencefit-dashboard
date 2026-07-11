/* Storefront route-loading fallback — a lightweight skeleton grid shown while
   a (shop) page's data resolves, so navigation feels instant instead of blank. */
export default function ShopLoading() {
  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded bg-gray-200 animate-pulse mb-2" />
      <div className="h-4 w-32 rounded bg-gray-100 animate-pulse mb-8" />
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[4/5] rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse mt-3" />
            <div className="h-4 w-1/3 rounded bg-gray-100 animate-pulse mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
