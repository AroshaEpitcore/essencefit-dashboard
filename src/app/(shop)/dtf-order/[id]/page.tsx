import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText, MessageCircle, ChevronLeft } from "lucide-react";
import { getCurrentCustomer } from "@/lib/customerAuth";
import { getMyDtfOrder } from "../../account/actions";
import { getDtfPageSettings } from "@/lib/dtfSettings";
import { money } from "@/components/shop/format";
import { sizeLabel } from "@/lib/sizeOrder";

export const dynamic = "force-dynamic";
export const metadata = { title: "Custom order" };

const STEPS = ["Pending", "Confirmed", "InProduction", "Ready", "Completed"] as const;
const STEP_LABEL: Record<string, string> = {
  Pending: "Received",
  Confirmed: "Confirmed",
  InProduction: "In production",
  Ready: "Ready",
  Completed: "Completed",
};

export default async function DtfOrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentCustomer();
  if (!me) redirect(`/account/login?next=/dtf-order/${id}`);

  const data = await getMyDtfOrder(id);
  if (!data) notFound();

  const { order, designs } = data;
  const settings = await getDtfPageSettings();
  const wa = (settings.whatsapp || "").replace(/[^\d]/g, "");

  const canceled = order.Status === "Canceled";
  const currentStep = STEPS.indexOf(order.Status);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to my orders
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom order {order.Ref}</h1>
          <p className="text-sm text-gray-500">Placed {new Date(order.CreatedAt).toLocaleDateString()}</p>
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${canceled ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary"}`}>
          {canceled ? "Canceled" : STEP_LABEL[order.Status] || order.Status}
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

      {/* Garment + pricing */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-3">Order details</h2>
        <div className="text-sm space-y-1 text-gray-700">
          <p><span className="text-gray-500">Garment:</span> {order.ProductName || "—"}</p>
          <p><span className="text-gray-500">Size / colour:</span> {[sizeLabel(order.SizeName), order.ColorName].filter(Boolean).join(" / ") || "—"}</p>
          <p><span className="text-gray-500">Quantity:</span> {order.Qty}</p>
          {order.PrintOptions && <p><span className="text-gray-500">Prints:</span> {order.PrintOptions}</p>}
          {order.CustomerNote && <p><span className="text-gray-500">Your note:</span> {order.CustomerNote}</p>}
        </div>

        <div className="border-t border-gray-200 mt-4 pt-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Estimated total</span><span>{money(order.EstimatedTotal)}</span></div>
          {order.FinalTotal != null && (
            <div className="flex justify-between font-semibold text-primary"><span>Final price</span><span>{money(order.FinalTotal)}</span></div>
          )}
          {order.AdvanceAmount != null && order.AdvanceAmount > 0 && (
            <div className="flex justify-between"><span className="text-gray-500">Advance</span><span>{money(order.AdvanceAmount)}</span></div>
          )}
          {order.FinalTotal == null && (
            <p className="text-xs text-gray-500 pt-1">This is an estimate — we&apos;ll confirm the final price after reviewing your artwork.</p>
          )}
        </div>
      </div>

      {/* Designs */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-3">Your designs ({designs.length})</h2>
        <div className="flex flex-wrap gap-3">
          {designs.map((d: any) => (
            <a key={d.Id} href={d.Url} target="_blank" rel="noopener noreferrer"
               className="w-24 h-24 rounded-lg border border-gray-300 overflow-hidden bg-gray-50 flex items-center justify-center">
              {d.Kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.Url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-gray-500"><FileText className="w-7 h-7" /><span className="text-[10px] mt-1">PDF</span></div>
              )}
            </a>
          ))}
        </div>
      </div>

      {wa && (
        <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi, about my custom order ${order.Ref}`)}`}
           target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold">
          <MessageCircle className="w-5 h-5" /> Message us about this order
        </a>
      )}
    </div>
  );
}
