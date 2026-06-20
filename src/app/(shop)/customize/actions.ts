"use server";

import { getDb, sql } from "@/lib/db";
import { getDtfGarment } from "@/lib/storefront";
import { computeDtfEstimate } from "@/lib/dtfPricing";

const { UniqueIdentifier, NVarChar, Int, Decimal } = sql;

export type DtfDesignInput = { url: string; kind: "image" | "pdf" };

/* Variants (size/colour) for a chosen printable garment — used by the picker. */
export async function getGarmentVariants(productId: string) {
  const garment = await getDtfGarment(productId);
  return garment?.variants ?? [];
}

export type DtfOrderPayload = {
  customerName: string;
  customerPhone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  productId: string;
  variantId?: string | null;
  qty: number;
  printNames: string[];
  customerNote?: string;
  designs: DtfDesignInput[];
};

/* Create a DTF customization request. Price/stock are NOT trusted from the
   client: the garment price is re-read and the estimate recomputed server-side.
   No stock change here — stock is reserved only when the admin confirms. */
export async function createDtfOrder(payload: DtfOrderPayload): Promise<{ id: string; ref: string }> {
  const name = payload.customerName?.trim();
  const phone = payload.customerPhone?.trim();
  if (!name) throw new Error("Your name is required.");
  if (!phone) throw new Error("A phone number is required.");
  if (!payload.productId) throw new Error("Please choose a garment.");
  if (!payload.designs?.length) throw new Error("Please upload at least one design.");

  // Re-read the chosen garment + its variants (authoritative price).
  const garment = await getDtfGarment(payload.productId);
  if (!garment) throw new Error("That garment is not available for printing.");

  let garmentPrice = Number(garment.product.SellingPrice) || 0;
  let variantId: string | null = payload.variantId || null;
  if (variantId) {
    const v = garment.variants.find((x) => x.VariantId === variantId);
    if (!v) throw new Error("Please choose a valid size/colour.");
    garmentPrice = Number(v.SellingPrice) || garmentPrice;
  }

  const qty = Math.max(1, Math.floor(Number(payload.qty) || 1));
  const printNames = (payload.printNames || []).filter(Boolean);
  const estimate = await computeDtfEstimate({ garmentPrice, printNames, qty });

  const pool = await getDb();

  // Next ref like DTF-O-1001
  const refRes = await pool.request().query(`
    SELECT ISNULL(MAX(TRY_CONVERT(INT, REPLACE(Ref, 'DTF-O-', ''))), 1000) AS LastNum FROM DtfOrders
  `);
  const ref = `DTF-O-${(refRes.recordset[0]?.LastNum || 1000) + 1}`;

  const id = crypto.randomUUID();
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();

    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, id)
      .input("Ref", NVarChar(20), ref)
      .input("CustomerName", NVarChar(200), name)
      .input("CustomerPhone", NVarChar(50), phone)
      .input("WhatsApp", NVarChar(50), payload.whatsapp?.trim() || null)
      .input("Email", NVarChar(200), payload.email?.trim() || null)
      .input("Address", NVarChar(500), payload.address?.trim() || null)
      .input("ProductId", UniqueIdentifier, payload.productId)
      .input("VariantId", UniqueIdentifier, variantId)
      .input("Qty", Int, qty)
      .input("PrintOptions", NVarChar(300), printNames.join(", ") || null)
      .input("CustomerNote", NVarChar(sql.MAX), payload.customerNote?.trim() || null)
      .input("GarmentPrice", Decimal(10, 2), estimate.garmentPrice)
      .input("PrintCharges", Decimal(10, 2), estimate.printCharges)
      .input("EstimatedTotal", Decimal(10, 2), estimate.total)
      .input("BreakdownJson", NVarChar(sql.MAX), JSON.stringify(estimate.breakdown))
      .query(`
        INSERT INTO DtfOrders
          (Id, Ref, CustomerName, CustomerPhone, WhatsApp, Email, Address,
           ProductId, VariantId, Qty, PrintOptions, CustomerNote,
           GarmentPrice, PrintCharges, EstimatedTotal, BreakdownJson, Status, StockDeducted)
        VALUES
          (@Id, @Ref, @CustomerName, @CustomerPhone, @WhatsApp, @Email, @Address,
           @ProductId, @VariantId, @Qty, @PrintOptions, @CustomerNote,
           @GarmentPrice, @PrintCharges, @EstimatedTotal, @BreakdownJson, 'Pending', 0)
      `);

    let i = 0;
    for (const d of payload.designs) {
      if (!d?.url) continue;
      await new sql.Request(tx)
        .input("Id", UniqueIdentifier, crypto.randomUUID())
        .input("DtfOrderId", UniqueIdentifier, id)
        .input("Url", NVarChar(500), d.url)
        .input("Kind", NVarChar(20), d.kind === "pdf" ? "pdf" : "image")
        .input("SortOrder", Int, i++)
        .query(`INSERT INTO DtfOrderDesigns (Id, DtfOrderId, Url, Kind, SortOrder)
                VALUES (@Id, @DtfOrderId, @Url, @Kind, @SortOrder)`);
    }

    await tx.commit();
    return { id, ref };
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}
