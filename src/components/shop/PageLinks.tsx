import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/* SEO-friendly numbered pagination for storefront listings — plain links that
   preserve the current filters/search, rendered on the server. */
export default function PageLinks({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "page") q.set(k, v);
    }
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  // Window of up to 5 page numbers centred on the current page
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const numbers = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);

  const btn = "min-w-[2.5rem] h-10 px-3 rounded-lg border text-sm font-medium flex items-center justify-center transition-colors";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 mt-10">
      {page > 1 ? (
        <Link href={href(page - 1)} aria-label="Previous page" className={`${btn} border-gray-200 text-gray-700 hover:border-gray-400`}>
          <ChevronLeft className="w-4 h-4" />
        </Link>
      ) : (
        <span className={`${btn} border-gray-100 text-gray-300`}><ChevronLeft className="w-4 h-4" /></span>
      )}
      {numbers.map((n) =>
        n === page ? (
          <span key={n} aria-current="page" className={`${btn} border-primary bg-primary text-white`}>{n}</span>
        ) : (
          <Link key={n} href={href(n)} className={`${btn} border-gray-200 text-gray-700 hover:border-gray-400`}>{n}</Link>
        )
      )}
      {page < totalPages ? (
        <Link href={href(page + 1)} aria-label="Next page" className={`${btn} border-gray-200 text-gray-700 hover:border-gray-400`}>
          <ChevronRight className="w-4 h-4" />
        </Link>
      ) : (
        <span className={`${btn} border-gray-100 text-gray-300`}><ChevronRight className="w-4 h-4" /></span>
      )}
    </nav>
  );
}
