import { getDb } from "@/lib/db";
import { resolveVariant } from "@/lib/waStock";

/*
 * Pending orders collected by the WhatsApp bot (Phase 2c). The bot writes a row
 * here when a customer confirms an order; it does NOT deduct stock. The owner
 * reviews in the admin and places the real order (createOrder) with one click.
 *
 * Money follows the shop's real model (seen in past orders):
 *   subtotal   = Σ qty × price (real DB price per variant)
 *   3+ items   → FREE delivery: deliveryFee 0, deliveryCost = DELIVERY_RATE
 *   < 3 items  → customer pays: deliveryFee = DELIVERY_RATE, deliveryCost 0
 *   total      = subtotal + deliveryFee
 */

const DELIVERY_RATE = Number(process.env.WA_DELIVERY_RATE || 450);
const FREE_DELIVERY_QTY = 3;

export type BotOrderItem = { product: string; size: string; colour: string; qty: number };

export type PendingLineItem = BotOrderItem & {
  price: number;
  variantId: string | null;
  inStock: number | null;
};

export type PendingOrder = {
  id: string;
  waId: string;
  customerName: string | null;
  address: string | null;
  phone: string | null;
  items: PendingLineItem[];
  subtotal: number;
  deliveryFee: number;
  deliveryCost: number;
  total: number;
  status: "pending" | "placed" | "rejected";
  orderId: string | null;
  note: string | null;
  createdAt: string;
};

export function computeMoney(items: { qty: number; price: number }[]) {
  const totalQty = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const free = totalQty >= FREE_DELIVERY_QTY;
  const deliveryFee = free ? 0 : DELIVERY_RATE;
  const deliveryCost = free ? DELIVERY_RATE : 0;
  return { subtotal, deliveryFee, deliveryCost, total: subtotal + deliveryFee, totalQty, free };
}

/** Resolve prices/variants for the bot's items and save a pending order. */
export async function savePendingOrder(input: {
  waId: string;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  items: BotOrderItem[];
}): Promise<PendingOrder> {
  const lines: PendingLineItem[] = [];
  for (const it of input.items) {
    let v = null;
    try {
      v = await resolveVariant(it.product, it.size, it.colour);
    } catch (err) {
      console.error("[wa/pending] resolveVariant failed:", err);
    }
    lines.push({
      ...it,
      qty: Math.max(1, Math.floor(Number(it.qty) || 1)),
      price: v?.sellingPrice ?? 0,
      variantId: v?.variantId ?? null,
      inStock: v?.inStock ?? null,
    });
  }
  const m = computeMoney(lines);

  const pool = await getDb();
  const res = await pool
    .request()
    .input("waId", input.waId)
    .input("name", input.name ?? null)
    .input("address", input.address ?? null)
    .input("phone", input.phone ?? input.waId)
    .input("items", JSON.stringify(lines))
    .input("subtotal", m.subtotal)
    .input("deliveryFee", m.deliveryFee)
    .input("deliveryCost", m.deliveryCost)
    .input("total", m.total)
    .query(`
      INSERT INTO wa_pending_orders
        (wa_id, customer_name, address, phone, items, subtotal, delivery_fee, delivery_cost, total)
      VALUES
        (@waId, @name, @address, @phone, @items::jsonb, @subtotal, @deliveryFee, @deliveryCost, @total)
      RETURNING id, created_at
    `);
  const row = res.recordset[0];
  return {
    id: row.id,
    waId: input.waId,
    customerName: input.name ?? null,
    address: input.address ?? null,
    phone: input.phone ?? input.waId,
    items: lines,
    subtotal: m.subtotal,
    deliveryFee: m.deliveryFee,
    deliveryCost: m.deliveryCost,
    total: m.total,
    status: "pending",
    orderId: null,
    note: null,
    createdAt: row.created_at,
  };
}

function mapRow(r: Record<string, unknown>): PendingOrder {
  return {
    id: r.id as string,
    waId: r.wa_id as string,
    customerName: (r.customer_name as string) ?? null,
    address: (r.address as string) ?? null,
    phone: (r.phone as string) ?? null,
    items: Array.isArray(r.items) ? (r.items as PendingLineItem[]) : [],
    subtotal: Number(r.subtotal ?? 0),
    deliveryFee: Number(r.delivery_fee ?? 0),
    deliveryCost: Number(r.delivery_cost ?? 0),
    total: Number(r.total ?? 0),
    status: r.status as PendingOrder["status"],
    orderId: (r.order_id as string) ?? null,
    note: (r.note as string) ?? null,
    createdAt: String(r.created_at),
  };
}

export async function listPendingOrders(
  status: PendingOrder["status"] | "all" = "pending"
): Promise<PendingOrder[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("status", status)
    .query(`
      SELECT * FROM wa_pending_orders
      WHERE (@status = 'all' OR status = @status)
      ORDER BY created_at DESC
      LIMIT 100
    `);
  return (res.recordset ?? []).map(mapRow);
}

export async function getPendingOrder(id: string): Promise<PendingOrder | null> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("id", id)
    .query(`SELECT * FROM wa_pending_orders WHERE id = @id::uuid`);
  const r = (res.recordset ?? [])[0];
  return r ? mapRow(r) : null;
}

export async function markPlaced(id: string, orderId: string): Promise<void> {
  const pool = await getDb();
  await pool
    .request()
    .input("id", id)
    .input("orderId", orderId)
    .query(`
      UPDATE wa_pending_orders
      SET status = 'placed', order_id = @orderId::uuid, updated_at = now()
      WHERE id = @id::uuid
    `);
}

export async function markRejected(id: string): Promise<void> {
  const pool = await getDb();
  await pool
    .request()
    .input("id", id)
    .query(`UPDATE wa_pending_orders SET status = 'rejected', updated_at = now() WHERE id = @id::uuid`);
}
