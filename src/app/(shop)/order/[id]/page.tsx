import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Landmark, ChevronLeft, MapPin, Phone, Mail, StickyNote, Truck, FileText } from "lucide-react";
import { getCurrentCustomer } from "@/lib/customerAuth";
import { getMyOrder } from "../../account/actions";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import { money } from "@/components/shop/format";
import { sizeLabel } from "@/lib/sizeOrder";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order details" };

const STEPS = ["Pending", "Paid", "Completed"] as const;
const STEP_LABEL: Record<string, string> = {
  Pending: "Placed",
  Paid: "Paid",
  Completed: "Completed",
};
// Where each live status sits on the 3-step bar.
const STEP_INDEX: Record<string, number> = {
  Pending: 0,
  Partial: 1,
  Paid: 1,
  Completed: 2,
};

const statusColor: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Paid: "bg-green-100 text-green-700",
  Completed: "bg-green-100 text-green-700",
  Partial: "bg-blue-100 text-blue-700",
  Canceled: "bg-red-100 text-red-700",
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { id } = await params;
  const { placed } = await searchParams;

  const me = await getCurrentCustomer();
  if (!me) redirect(`/account/login?next=/order/${id}`);

  const data = await getMyOrder(id);
  if (!data) notFound();

  const { order, items, logs } = data;
  const settings = await getPublicStoreSettings();
  const ref = String(order.Id).slice(0, 8).toUpperCase();

  const canceled = order.PaymentStatus === "Canceled";
  const currentStep = STEP_INDEX[order.PaymentStatus] ?? 0;
  const discount = (Number(order.ManualDiscount) || 0) + (Number(order.Discount) || 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to my orders
      </Link>

      {placed && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Thank you for your order!</h1>
            <p className="text-gray-600 text-sm">
              Order <b>#{ref}</b> has been placed successfully. We&apos;ll contact you on {order.CustomerPhone} to confirm delivery.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order #{ref}</h1>
          <p className="text-sm text-gray-500">Placed {new Date(order.OrderDate).toLocaleString()}</p>
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusColor[order.PaymentStatus] || "bg-gray-100 text-gray-600"}`}>
          {order.PaymentStatus}
        </span>
      </div>

      {/* Status steps */}
      {!canceled && (
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${i <= currentStep ? "bg-primary text-white" : "bg-gray-200 text-gray-500"}`}>
                  {i + 1}
                </div>
                <span className={`mt-1 text-[10px] sm:text-xs ${i <= currentStep ? "text-gray-900" : "text-gray-400"}`}>{STEP_LABEL[s]}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < currentStep ? "bg-primary" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>
      )}
      {canceled && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
          This order was canceled. If you think this is a mistake, please contact us.
        </div>
      )}

      {/* Items */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-4">Items ({items.length})</h2>
        <div className="space-y-3">
          {items.map((it, idx) => {
            const row = (
              <>
                <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {it.ImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.ImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <p className="text-gray-800">{it.ProductName}</p>
                  <p className="text-gray-400 text-xs">
                    {[sizeLabel(it.SizeName), it.ColorName].filter(Boolean).join(" / ") || "—"} × {it.Qty}
                  </p>
                </div>
                <span className="font-medium">{money(it.SellingPrice * it.Qty)}</span>
              </>
            );
            return it.Slug ? (
              <Link key={idx} href={`/product/${it.Slug}`} className="flex gap-3 text-sm items-center hover:bg-gray-50 -mx-2 px-2 py-1 rounded">
                {row}
              </Link>
            ) : (
              <div key={idx} className="flex gap-3 text-sm items-center">{row}</div>
            );
          })}
        </div>

        <div className="border-t border-gray-200 mt-4 pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{money(order.Subtotal)}</span></div>
          {discount > 0 && (
            <div className="flex justify-between text-green-700"><span>Discount</span><span>-{money(discount)}</span></div>
          )}
          <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span>{Number(order.DeliveryFee) === 0 ? "Free" : money(order.DeliveryFee)}</span></div>
          <div className="flex justify-between text-base font-bold pt-1"><span>Total</span><span>{money(order.Total)}</span></div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5 mb-5">
        {/* Delivery / contact */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Truck className="w-4 h-4" /> Delivery details</h2>
          <div className="text-sm space-y-2 text-gray-700">
            <p className="flex gap-2"><MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" /> <span>{order.Address}{order.Province ? `, ${order.Province}` : ""}</span></p>
            <p className="flex gap-2"><Phone className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" /> <span>{order.CustomerPhone}{order.SecondaryPhone ? ` / ${order.SecondaryPhone}` : ""}</span></p>
            {order.CustomerEmail && <p className="flex gap-2"><Mail className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" /> <span>{order.CustomerEmail}</span></p>}
            {order.Notes && <p className="flex gap-2"><StickyNote className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" /> <span>{order.Notes}</span></p>}
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Landmark className="w-4 h-4" /> Payment</h2>
          <div className="text-sm space-y-1 text-gray-700">
            <p><span className="text-gray-500">Method:</span> {order.PaymentMethod === "BankTransfer" ? "Bank transfer" : order.PaymentMethod === "COD" ? "Cash on delivery" : order.PaymentMethod || "—"}</p>
            <p><span className="text-gray-500">Status:</span> {order.PaymentStatus}</p>
            {order.PaymentMethod === "BankTransfer" && order.PaymentSlipUrl && (
              <a href={order.PaymentSlipUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                <FileText className="w-4 h-4" /> View uploaded slip
              </a>
            )}
          </div>

          {order.PaymentMethod === "BankTransfer" && order.PaymentStatus === "Pending" && settings.bank.bank && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-0.5">
              <p>We&apos;ll verify your slip and confirm shortly.</p>
              <p>Bank: <b>{settings.bank.bank}</b></p>
              <p>Account: <b>{settings.bank.accountNo}</b> ({settings.bank.accountName})</p>
            </div>
          )}
          {order.PaymentMethod === "COD" && !canceled && (
            <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
              Pay <b>{money(order.Total)}</b> in cash when your order is delivered.
            </p>
          )}
        </div>
      </div>

      {/* Status history */}
      {logs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-3">Status history</h2>
          <ol className="space-y-2">
            {logs.map((l, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="text-gray-800">{l.NewStatus}</span>
                <span className="text-gray-400 text-xs ml-auto">{new Date(l.ChangedAt).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/shop" className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary/90">
          Continue shopping
        </Link>
        <Link href="/account/orders" className="inline-block border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-primary hover:text-primary">
          My orders
        </Link>
      </div>
    </div>
  );
}
