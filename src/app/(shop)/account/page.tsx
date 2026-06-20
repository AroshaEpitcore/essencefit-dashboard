import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customerAuth";
import { getMyOrders } from "./actions";
import { money } from "@/components/shop/format";
import LogoutButton from "@/components/shop/LogoutButton";
import { Package, User, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "My account | EssenceFit" };

const statusColor: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Paid: "bg-green-100 text-green-700",
  Completed: "bg-green-100 text-green-700",
  Partial: "bg-blue-100 text-blue-700",
  Canceled: "bg-red-100 text-red-700",
};

export default async function AccountPage() {
  const me = await getCurrentCustomer();
  if (!me) redirect("/account/login?next=/account");

  const orders = await getMyOrders();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hi, {me.Name} 👋</h1>
          <p className="text-gray-500 text-sm">{me.Email || me.Phone}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <Link href="/account/orders" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-5 hover:border-primary">
          <div className="bg-primary/10 p-3 rounded-lg"><Package className="w-6 h-6 text-primary" /></div>
          <div className="flex-1"><p className="font-semibold text-gray-900">My orders</p><p className="text-sm text-gray-500">{orders.length} order{orders.length !== 1 ? "s" : ""}</p></div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
        <Link href="/account/profile" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-5 hover:border-primary">
          <div className="bg-primary/10 p-3 rounded-lg"><User className="w-6 h-6 text-primary" /></div>
          <div className="flex-1"><p className="font-semibold text-gray-900">Profile</p><p className="text-sm text-gray-500">Name, phone, address, password</p></div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
      </div>

      <h2 className="font-semibold text-gray-900 mb-3">Recent orders</h2>
      {orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          No orders yet. <Link href="/shop" className="text-primary font-medium">Start shopping</Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {orders.slice(0, 5).map((o: any) => (
            <div key={o.Id} className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900">#{String(o.Id).slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-gray-500">{new Date(o.OrderDate).toLocaleDateString()} · {o.LineCount} item(s) · {o.PaymentMethod || "—"}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[o.PaymentStatus] || "bg-gray-100 text-gray-600"}`}>{o.PaymentStatus}</span>
              <span className="font-semibold text-gray-900">{money(o.Total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
