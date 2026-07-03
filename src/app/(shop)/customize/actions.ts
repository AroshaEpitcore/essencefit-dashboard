"use server";

import bcrypt from "bcryptjs";
import { getDb, sql } from "@/lib/db";
import { getDtfGarment } from "@/lib/storefront";
import { computeDtfEstimate } from "@/lib/dtfPricing";
import { getCurrentCustomer, setSessionCookie } from "@/lib/customerAuth";
import { sendOrderNotification, sendCustomerOrderConfirmation } from "@/lib/orderNotify";

const { UniqueIdentifier, NVarChar, Int, Decimal } = sql;

export type DtfDesignInput = { url: string; kind: "image" | "pdf" };

/* Variants (size/colour) + DTF profit for a chosen printable garment — used by
   the picker so the client can show a live estimate from cost + profit. */
export async function getGarmentVariants(productId: string) {
  const garment = await getDtfGarment(productId);
  return {
    variants: garment?.variants ?? [],
    dtfProfit: garment?.dtfProfit ?? null,
    productCost: garment?.cost ?? 0,
  };
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
  password?: string; // required when not logged in — creates a trackable account
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

  // Account required: must be logged in, or supply a password to create one.
  const sessionCustomer = await getCurrentCustomer();
  if (!sessionCustomer && (!payload.password || payload.password.trim().length < 6)) {
    throw new Error("Please choose a password (at least 6 characters) to create your account, or log in.");
  }

  // Re-read the chosen garment + its variants (authoritative price).
  const garment = await getDtfGarment(payload.productId);
  if (!garment) throw new Error("That garment is not available for printing.");

  // DTF garment base = the blank's COST (per variant, resolved) + DTF profit, not retail.
  let garmentCost = Number(garment.cost) || 0;
  let variantId: string | null = payload.variantId || null;
  if (variantId) {
    const v = garment.variants.find((x) => x.VariantId === variantId);
    if (!v) throw new Error("Please choose a valid size/colour.");
    garmentCost = Number(v.CostPrice) || garmentCost;
  }

  const qty = Math.max(1, Math.floor(Number(payload.qty) || 1));
  const printNames = (payload.printNames || []).filter(Boolean);
  const estimate = await computeDtfEstimate({ garmentCost, printNames, qty, profitOverride: garment.dtfProfit });

  const pool = await getDb();

  // Next ref like DTF-O-1001
  const refRes = await pool.request().query(`
    SELECT COALESCE(MAX(NULLIF(regexp_replace(Ref, '[^0-9]', '', 'g'), '')::int), 1000) AS LastNum FROM DtfOrders
  `);
  const ref = `DTF-O-${(refRes.recordset[0]?.LastNum || 1000) + 1}`;

  const id = crypto.randomUUID();
  const tx = new sql.Transaction(pool);
  let createdAccount = false;
  let customerId: string;
  try {
    await tx.begin();

    // Link to the customer account (use the session, else create/match by phone).
    if (sessionCustomer) {
      customerId = sessionCustomer.Id;
    } else {
      const hash = await bcrypt.hash(payload.password!.trim(), 10);
      const existing = await new sql.Request(tx)
        .input("Phone", NVarChar(50), phone)
        .query(`SELECT Id, PasswordHash FROM Customers WHERE Phone=@Phone LIMIT 1`);
      if (existing.recordset.length) {
        customerId = existing.recordset[0].Id;
        const applyHash = existing.recordset[0].PasswordHash ? null : hash;
        await new sql.Request(tx)
          .input("Id", UniqueIdentifier, customerId)
          .input("Name", NVarChar(200), name)
          .input("Address", NVarChar(500), payload.address?.trim() || null)
          .input("Email", NVarChar(200), payload.email?.trim() || null)
          .input("Hash", NVarChar(200), applyHash)
          .query(`UPDATE Customers SET Name=@Name, Address=COALESCE(@Address, Address),
                  Email=COALESCE(@Email, Email), PasswordHash=COALESCE(@Hash, PasswordHash) WHERE Id=@Id`);
        createdAccount = !!applyHash;
      } else {
        customerId = crypto.randomUUID();
        await new sql.Request(tx)
          .input("Id", UniqueIdentifier, customerId)
          .input("Name", NVarChar(200), name)
          .input("Phone", NVarChar(50), phone)
          .input("Address", NVarChar(500), payload.address?.trim() || null)
          .input("Email", NVarChar(200), payload.email?.trim() || null)
          .input("Hash", NVarChar(200), hash)
          .query(`INSERT INTO Customers (Id, Name, Phone, Address, Email, PasswordHash)
                  VALUES (@Id, @Name, @Phone, @Address, @Email, @Hash)`);
        createdAccount = true;
      }
    }

    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, id)
      .input("Ref", NVarChar(20), ref)
      .input("CustomerId", UniqueIdentifier, customerId)
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
          (Id, Ref, CustomerId, CustomerName, CustomerPhone, WhatsApp, Email, Address,
           ProductId, VariantId, Qty, PrintOptions, CustomerNote,
           GarmentPrice, PrintCharges, EstimatedTotal, BreakdownJson, Status, StockDeducted)
        VALUES
          (@Id, @Ref, @CustomerId, @CustomerName, @CustomerPhone, @WhatsApp, @Email, @Address,
           @ProductId, @VariantId, @Qty, @PrintOptions, @CustomerNote,
           @GarmentPrice, @PrintCharges, @EstimatedTotal, @BreakdownJson, 'Pending', false)
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

    const chosenVariant = variantId ? garment.variants.find((x) => x.VariantId === variantId) : null;
    const variantLabel = chosenVariant ? [chosenVariant.SizeName, chosenVariant.ColorName].filter(Boolean).join(" / ") : "";
    const garmentLabel = variantLabel ? `${garment.product.Name} (${variantLabel})` : garment.product.Name;
    const itemName = printNames.length ? `${garmentLabel} — ${printNames.join(", ")}` : garmentLabel;
    const itemLines = [{ name: itemName, qty }];

    await sendOrderNotification({
      subject: `New DTF order — ${ref}`,
      heading: "New DTF Customization Order",
      lines: [
        `Ref: ${ref}`,
        `Customer: ${name}`,
        `Phone: ${phone}`,
      ],
      items: itemLines,
      adminPath: "/dtf-orders",
    });

    const customerEmail = payload.email?.trim();
    if (customerEmail) {
      await sendCustomerOrderConfirmation({
        to: customerEmail,
        customerName: name,
        subject: `Custom order received — ${ref}`,
        heading: "Your customization request is in!",
        lines: [`Reference: ${ref}`],
        items: itemLines,
      });
    }

    // Auto-sign-in when a new account was created at submit time.
    if (createdAccount) {
      try { await setSessionCookie(customerId); } catch { /* non-fatal */ }
    }

    return { id, ref };
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}
