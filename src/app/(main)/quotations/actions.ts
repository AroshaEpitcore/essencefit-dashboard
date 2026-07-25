"use server";

import { requireAdmin } from "@/lib/adminAuth";
import { getDb, sql } from "@/lib/db";
import { getPublicStoreSettings } from "@/lib/storeSettings";

/* ============================================================
   GENERAL QUOTATIONS
   Line items are stored inline as a JSON array in ItemsJson:
     [{ description, qty, unitPrice, amount }]
   Ref scheme: QUO-1001 (mirrors DTF's DTF-1001).
   ============================================================ */

export async function getQuotations() {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, QuoteRef, CustomerName, CustomerPhone, CustomerEmail, CustomerAddress,
      ItemsJson, Subtotal, Discount, OtherCharge, GrandTotal,
      Notes, ValidUntil, Status, CreatedAt
    FROM Quotations
    ORDER BY CreatedAt DESC LIMIT 100
  `);
  return res.recordset;
}

export async function saveQuotation(q: {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  itemsJson: string;
  subtotal: number;
  discount: number;
  otherCharge: number;
  grandTotal: number;
  notes?: string;
  validUntil?: string | null;
}) {
  await requireAdmin();
  const pool = await getDb();

  // Generate next ref like QUO-1001
  const refRes = await pool.request().query(`
    SELECT COALESCE(MAX(NULLIF(regexp_replace(QuoteRef, '[^0-9]', '', 'g'), '')::int), 1000) AS LastNum
    FROM Quotations
  `);
  const nextNum = (refRes.recordset[0]?.LastNum || 1000) + 1;
  const quoteRef = `QUO-${nextNum}`;

  await pool
    .request()
    .input("QuoteRef", sql.NVarChar(20), quoteRef)
    .input("CustomerName", sql.NVarChar(150), q.customerName || null)
    .input("CustomerPhone", sql.NVarChar(30), q.customerPhone || null)
    .input("CustomerEmail", sql.NVarChar(150), q.customerEmail || null)
    .input("CustomerAddress", sql.NVarChar(300), q.customerAddress || null)
    .input("ItemsJson", sql.NVarChar(sql.MAX), q.itemsJson)
    .input("Subtotal", sql.Decimal(12, 2), q.subtotal)
    .input("Discount", sql.Decimal(12, 2), q.discount)
    .input("OtherCharge", sql.Decimal(12, 2), q.otherCharge)
    .input("GrandTotal", sql.Decimal(12, 2), q.grandTotal)
    .input("Notes", sql.NVarChar(1000), q.notes || null)
    .input("ValidUntil", sql.Date, q.validUntil || null)
    .query(`
      INSERT INTO Quotations
        (QuoteRef, CustomerName, CustomerPhone, CustomerEmail, CustomerAddress, ItemsJson,
         Subtotal, Discount, OtherCharge, GrandTotal, Notes, ValidUntil)
      VALUES
        (@QuoteRef, @CustomerName, @CustomerPhone, @CustomerEmail, @CustomerAddress, @ItemsJson,
         @Subtotal, @Discount, @OtherCharge, @GrandTotal, @Notes, @ValidUntil)
    `);

  return quoteRef;
}

export async function deleteQuotation(id: string) {
  await requireAdmin();
  const pool = await getDb();
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`DELETE FROM Quotations WHERE Id=@Id`);
  return true;
}

// Business identity for the PDF header/footer — read from Store Settings.
export async function getQuotationBusinessInfo() {
  await requireAdmin();
  const s = await getPublicStoreSettings();
  return {
    storeName: s.storeName,
    logo: s.logoDark || s.logo || s.logoLight || "",
    contactPhone: s.contactPhone,
    contactEmail: s.contactEmail,
    bank: s.bank,
  };
}
