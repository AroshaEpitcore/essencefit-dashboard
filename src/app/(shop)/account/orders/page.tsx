import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customerAuth";
import { getMyOrders } from "../actions";
import { money } from "@/components/shop/format";
import { ChevronLeft, Package } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "My orders" };

const statusColor: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Paid: "bg-green-100 text-green-700",
  Completed: "bg-green-100 text-green-700",
  Partial: "bg-blue-100 text-blue-700",
  Confirmed: "bg-blue-100 text-blue-700",
  InProduction: "bg-purple-100 text-purple-700",
  Ready: "bg-teal-100 text-teal-700",
  Canceled: "bg-red-100 text-red-700",
};

const deliveryColor: Record<string, string> = {
  Ready: "bg-amber-100 text-amber-700",
  "Handed to courier": "bg-blue-100 text-blue-700",
  Delivered: "bg-green-100 text-green-700",
  Returned: "bg-red-100 text-red-700",
};

export default async function MyOrdersPage() {
  const me = await getCurrentCustomer();
  if (!me) redirect("/account/login?next=/account/orders");
  const orders = await getMyOrders();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link href="/account" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to account
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My orders</h1>

      {orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          No orders yet. <Link href="/shop" className="text-primary font-medium">Start shopping</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} href={o.href} className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg p-4 hover:border-primary">
              <div className="flex -space-x-3 shrink-0">
                {o.thumbs.length > 0 ? (
                  o.thumbs.slice(0, 4).map((src, i) => (
                    <div key={i} className="w-12 h-12 rounded border-2 border-white bg-gray-100 overflow-hidden ring-1 ring-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center ring-1 ring-gray-200">
                    <Package className="w-5 h-5 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 flex items-center gap-2">
                  #{o.number}
                  {o.kind === "dtf" && <span className="text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">Custom</span>}
                </p>
                <p className="text-xs text-gray-500">{new Date(o.date).toLocaleString()} · {o.count} {o.kind === "dtf" ? "design(s)" : "item(s)"} · {o.label || "—"}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[o.status] || "bg-gray-100 text-gray-600"}`}>{o.status}</span>
                {o.kind === "order" && o.deliveryStatus && o.deliveryStatus !== "Processing" && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${deliveryColor[o.deliveryStatus] || "bg-gray-100 text-gray-600"}`}>{o.deliveryStatus}</span>
                )}
              </div>
              <span className="font-semibold text-gray-900">{money(o.total)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
