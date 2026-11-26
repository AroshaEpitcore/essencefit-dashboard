"use server";

import { requireAdmin } from "@/lib/adminAuth";
import { createOrder, type OrderPayload } from "@/app/(main)/orders/actions";
import {
  listPendingOrders,
  getPendingOrder,
  markPlaced,
  markRejected,
  type PendingOrder,
} from "@/lib/waPendingOrders";
import { resolveVariant } from "@/lib/waStock";

/* Admin review of WhatsApp bot-collected orders (Phase 2c). */

export async function listWaPending(): Promise<PendingOrder[]> {
  await requireAdmin();
  return listPendingOrders("pending");
}

/** Place the real order (deducts stock via createOrder), then mark it placed. */
export async function placeWaPending(
  id: string
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  await requireAdmin();
  const p = await getPendingOrder(id);
  if (!p) return { ok: false, error: "Pending order not found." };
  if (p.status !== "pending") return { ok: false, error: `Order is already ${p.status}.` };

  const items: OrderPayload["Items"] = [];
  for (const it of p.items) {
    let variantId = it.variantId;
    let price = it.price;
    if (!variantId) {
      const v = await resolveVariant(it.product, it.size, it.colour);
      if (!v) {
        return {
          ok: false,
          error: `Can't match "${it.product} / ${it.size} / ${it.colour}" to a product variant. Fix the colour/size and place it manually.`,
        };
      }
      variantId = v.variantId;
      price = v.sellingPrice;
    }
    items.push({ VariantId: variantId, Qty: it.qty, SellingPrice: price, PrintCost: 0, IsDtf: false });
  }

  const payload: OrderPayload = {
    Customer: p.customerName,
    CustomerPhone: p.phone,
    Address: p.address,
    PaymentStatus: "Pending",
    OrderDate: new Date().toISOString(),
    Subtotal: p.subtotal,
    ManualDiscount: 0,
    DeliverySaving: p.deliveryCost,
    Discount: 0,
    DeliveryFee: p.deliveryFee,
    DeliveryCost: p.deliveryCost,
    Total: p.total,
    Notes: `WhatsApp bot order · ${p.waId}`,
    Items: items,
  };

  const res = await createOrder(payload);
  if (!res.ok) return { ok: false, error: res.error };
  await markPlaced(id, res.OrderId);
  return { ok: true, orderId: res.OrderId };
}

export async function rejectWaPending(id: string): Promise<{ ok: true }> {
  await requireAdmin();
  await markRejected(id);
  return { ok: true };
}
