import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Landmark } from "lucide-react";
import { getOrderForConfirmation } from "../../checkout/actions";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import { money } from "@/components/shop/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order confirmed | EssenceFit" };

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOrderForConfirmation(id);
  if (!data) notFound();

  const { order, items } = data;
  const settings = await getPublicStoreSettings();
  const ref = String(order.Id).slice(0, 8).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-gray-900">Thank you for your order!</h1>
        <p className="text-gray-500 mt-1">Order <b>#{ref}</b> has been placed successfully.</p>
        <p className="text-gray-500 text-sm">We&apos;ll contact you on {order.CustomerPhone} to confirm delivery.</p>
      </div>

      <div className="bg-white border border-gray-200  p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Order summary</h2>
        <div className="space-y-3">
          {items.map((it: any, idx: number) => (
            <div key={idx} className="flex gap-3 text-sm">
              <div className="w-12 h-12  bg-gray-100 overflow-hidden shrink-0">
                {it.ImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.ImageUrl} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="flex-1">
                <p className="text-gray-800">{it.ProductName}</p>
                <p className="text-gray-400 text-xs">{[it.SizeName, it.ColorName].filter(Boolean).join(" / ")} × {it.Qty}</p>
              </div>
              <span className="font-medium">{money(it.SellingPrice * it.Qty)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-200 mt-4 pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{money(order.Subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span>{order.DeliveryFee === 0 ? "Free" : money(order.DeliveryFee)}</span></div>
          <div className="flex justify-between text-base font-bold pt-1"><span>Total</span><span>{money(order.Total)}</span></div>
        </div>
      </div>

      {order.PaymentMethod === "BankTransfer" && (
        <div className="bg-amber-50 border border-amber-200  p-5 mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2"><Landmark className="w-4 h-4" /> Bank transfer</h3>
          <p className="text-sm text-gray-600 mb-2">We&apos;ll verify your uploaded slip and confirm your order shortly.</p>
          {settings.bank.bank && (
            <ul className="text-sm text-gray-600 space-y-0.5">
              <li>Bank: <b>{settings.bank.bank}</b></li>
              <li>Account: <b>{settings.bank.accountNo}</b> ({settings.bank.accountName})</li>
            </ul>
          )}
        </div>
      )}

      {order.PaymentMethod === "COD" && (
        <div className="bg-green-50 border border-green-200  p-5 mb-6 text-sm text-gray-700">
          Pay <b>{money(order.Total)}</b> in cash when your order is delivered.
        </div>
      )}

      <div className="text-center flex flex-wrap gap-3 justify-center">
        <Link href="/shop" className="inline-block bg-primary text-white px-8 py-3 rounded-full font-semibold hover:bg-primary/90">
          Continue shopping
        </Link>
        <Link href="/account/orders" className="inline-block border border-gray-300 text-gray-700 px-8 py-3 rounded-full font-semibold hover:border-primary hover:text-primary">
          Track in My Account
        </Link>
      </div>
    </div>
  );
}
