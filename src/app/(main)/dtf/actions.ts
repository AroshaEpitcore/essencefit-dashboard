"use server";

import { getDb, sql } from "@/lib/db";
import { DTF_KEYS, getDtfPageSettings as readDtfPageSettings, type DtfPageSettings } from "@/lib/dtfSettings";

/* ============================================================
   PRICE ITEMS  (Garment / Print / Overhead / Profit)
   ============================================================ */

export type PriceItemInput = {
  category: string;
  name: string;
  amount: string | number;
  unit?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export async function getPriceItems() {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, Category, Name, Amount, Unit, SortOrder, IsActive, UpdatedAt
    FROM DtfPriceItems
    ORDER BY
      CASE Category
        WHEN 'Garment'  THEN 1
        WHEN 'Print'    THEN 2
        WHEN 'Overhead' THEN 3
        WHEN 'Profit'   THEN 4
        ELSE 5
      END,
      SortOrder, Name
  `);
  return res.recordset;
}

export async function addPriceItem(item: PriceItemInput) {
  const pool = await getDb();
  await pool
    .request()
    .input("Category", sql.NVarChar(20), item.category)
    .input("Name", sql.NVarChar(100), item.name)
    .input("Amount", sql.Decimal(10, 2), Number(item.amount) || 0)
    .input("Unit", sql.NVarChar(30), item.unit || null)
    .input("SortOrder", sql.Int, item.sortOrder ?? 0)
    .query(`
      INSERT INTO DtfPriceItems (Category, Name, Amount, Unit, SortOrder)
      VALUES (@Category, @Name, @Amount, @Unit, @SortOrder)
    `);
  return true;
}

export async function updatePriceItem(id: string, item: PriceItemInput) {
  const pool = await getDb();
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("Category", sql.NVarChar(20), item.category)
    .input("Name", sql.NVarChar(100), item.name)
    .input("Amount", sql.Decimal(10, 2), Number(item.amount) || 0)
    .input("Unit", sql.NVarChar(30), item.unit || null)
    .input("IsActive", sql.Bit, item.isActive ?? true)
    .query(`
      UPDATE DtfPriceItems
      SET Category=@Category, Name=@Name, Amount=@Amount, Unit=@Unit,
          IsActive=@IsActive, UpdatedAt=SYSUTCDATETIME()
      WHERE Id=@Id
    `);
  return true;
}

export async function deletePriceItem(id: string) {
  const pool = await getDb();
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`DELETE FROM DtfPriceItems WHERE Id=@Id`);
  return true;
}

/* ============================================================
   QUOTES
   ============================================================ */

export type QuoteInput = {
  customerName?: string;
  customerPhone?: string;
  garmentName: string;
  printNames?: string;
  quantity: number;
  garmentCost: number;
  printCost: number;
  packaging: number;
  utilities: number;
  profit: number;
  unitPrice: number;
  total: number;
  extra: number;
  finalTotal: number;
  advancePct: number;
  advanceAmount: number;
  notes?: string;
  breakdownJson?: string;
};

export async function getQuotes() {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT TOP 100
      Id, QuoteRef, CustomerName, CustomerPhone, GarmentName, PrintNames,
      Quantity, GarmentCost, PrintCost, Packaging, Utilities, Profit,
      UnitPrice, Total, Extra, FinalTotal, AdvancePct, AdvanceAmount,
      Notes, BreakdownJson, CreatedAt
    FROM DtfQuotes
    ORDER BY CreatedAt DESC
  `);
  return res.recordset;
}

export async function saveQuote(q: QuoteInput) {
  const pool = await getDb();

  // Generate next ref like DTF-1001
  const refRes = await pool.request().query(`
    SELECT ISNULL(MAX(TRY_CONVERT(INT, REPLACE(QuoteRef, 'DTF-', ''))), 1000) AS LastNum
    FROM DtfQuotes
  `);
  const nextNum = (refRes.recordset[0]?.LastNum || 1000) + 1;
  const quoteRef = `DTF-${nextNum}`;

  await pool
    .request()
    .input("QuoteRef", sql.NVarChar(20), quoteRef)
    .input("CustomerName", sql.NVarChar(150), q.customerName || null)
    .input("CustomerPhone", sql.NVarChar(30), q.customerPhone || null)
    .input("GarmentName", sql.NVarChar(100), q.garmentName)
    .input("PrintNames", sql.NVarChar(300), q.printNames || null)
    .input("Quantity", sql.Int, q.quantity)
    .input("GarmentCost", sql.Decimal(10, 2), q.garmentCost)
    .input("PrintCost", sql.Decimal(10, 2), q.printCost)
    .input("Packaging", sql.Decimal(10, 2), q.packaging)
    .input("Utilities", sql.Decimal(10, 2), q.utilities)
    .input("Profit", sql.Decimal(10, 2), q.profit)
    .input("UnitPrice", sql.Decimal(10, 2), q.unitPrice)
    .input("Total", sql.Decimal(10, 2), q.total)
    .input("Extra", sql.Decimal(10, 2), q.extra)
    .input("FinalTotal", sql.Decimal(10, 2), q.finalTotal)
    .input("AdvancePct", sql.Decimal(5, 2), q.advancePct)
    .input("AdvanceAmount", sql.Decimal(10, 2), q.advanceAmount)
    .input("Notes", sql.NVarChar(500), q.notes || null)
    .input("BreakdownJson", sql.NVarChar(sql.MAX), q.breakdownJson || null)
    .query(`
      INSERT INTO DtfQuotes
        (QuoteRef, CustomerName, CustomerPhone, GarmentName, PrintNames, Quantity,
         GarmentCost, PrintCost, Packaging, Utilities, Profit, UnitPrice, Total,
         Extra, FinalTotal, AdvancePct, AdvanceAmount, Notes, BreakdownJson)
      VALUES
        (@QuoteRef, @CustomerName, @CustomerPhone, @GarmentName, @PrintNames, @Quantity,
         @GarmentCost, @PrintCost, @Packaging, @Utilities, @Profit, @UnitPrice, @Total,
         @Extra, @FinalTotal, @AdvancePct, @AdvanceAmount, @Notes, @BreakdownJson)
    `);
  return quoteRef;
}

export async function deleteQuote(id: string) {
  const pool = await getDb();
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`DELETE FROM DtfQuotes WHERE Id=@Id`);
  return true;
}

/* ============================================================
   MESSAGE TEMPLATES (Sinhala / English)
   ============================================================ */

export type TemplateInput = {
  title: string;
  content: string;
  category?: string;
  language?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export async function getTemplates() {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, Title, Content, Category, Language, SortOrder, IsActive, CreatedAt, UpdatedAt
    FROM DtfTemplates
    ORDER BY SortOrder, Title
  `);
  return res.recordset;
}

export async function addTemplate(t: TemplateInput) {
  const pool = await getDb();
  await pool
    .request()
    .input("Title", sql.NVarChar(150), t.title)
    .input("Content", sql.NVarChar(sql.MAX), t.content)
    .input("Category", sql.NVarChar(50), t.category || "General")
    .input("Language", sql.NVarChar(20), t.language || "Sinhala")
    .input("SortOrder", sql.Int, t.sortOrder ?? 0)
    .query(`
      INSERT INTO DtfTemplates (Title, Content, Category, Language, SortOrder)
      VALUES (@Title, @Content, @Category, @Language, @SortOrder)
    `);
  return true;
}

export async function updateTemplate(id: string, t: TemplateInput) {
  const pool = await getDb();
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("Title", sql.NVarChar(150), t.title)
    .input("Content", sql.NVarChar(sql.MAX), t.content)
    .input("Category", sql.NVarChar(50), t.category || "General")
    .input("Language", sql.NVarChar(20), t.language || "Sinhala")
    .query(`
      UPDATE DtfTemplates
      SET Title=@Title, Content=@Content, Category=@Category,
          Language=@Language, UpdatedAt=SYSUTCDATETIME()
      WHERE Id=@Id
    `);
  return true;
}

export async function deleteTemplate(id: string) {
  const pool = await getDb();
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`DELETE FROM DtfTemplates WHERE Id=@Id`);
  return true;
}

/* ============================================================
   CUSTOMIZE PAGE SETTINGS (intro note + suggestions)
   Stored in the generic Settings Key/Value table.
   ============================================================ */

export async function getDtfPageSettings(): Promise<DtfPageSettings> {
  return readDtfPageSettings();
}

export async function saveDtfPageSettings(introNote: string, suggestions: string[]) {
  const pool = await getDb();
  const clean = (suggestions || []).map((s) => s.trim()).filter(Boolean);
  const pairs: Array<[string, string]> = [
    [DTF_KEYS.introNote, introNote ?? ""],
    [DTF_KEYS.suggestions, JSON.stringify(clean)],
  ];
  for (const [key, value] of pairs) {
    await pool
      .request()
      .input("Key", sql.NVarChar(100), key)
      .input("Value", sql.NVarChar(sql.MAX), value)
      .query(`
        MERGE Settings AS target
        USING (SELECT @Key AS [Key]) AS src
        ON target.[Key] = src.[Key]
        WHEN MATCHED THEN UPDATE SET [Value]=@Value, UpdatedAt=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (Id, [Key], [Value], UpdatedAt)
          VALUES (NEWID(), @Key, @Value, SYSUTCDATETIME());
      `);
  }
  return true;
}
