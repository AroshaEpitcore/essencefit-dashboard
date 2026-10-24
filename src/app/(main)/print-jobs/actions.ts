"use server";

import { requireAdmin } from "@/lib/adminAuth";

import { getDb, sql } from "@/lib/db";
import { UserFacingError, userErrorMessage } from "@/lib/userError";

const { UniqueIdentifier, NVarChar, Int, Decimal } = sql;

type PjResult = { ok: true; ref?: string } | { ok: false; error: string };

export type PrintJobStatus = "Pending" | "HandedOver";

export type PrintJobInput = {
  giver: string;
  garment: string;
  qty: number;
  dtfCostPerUnit: number;
  profitPerUnit: number;
  note?: string | null;
};

/* ---------- List ---------- */
export async function getPrintJobs(opts?: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}) {
  await requireAdmin();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const status = (opts?.status ?? "").trim();
  const search = (opts?.search ?? "").trim();
  const pool = await getDb();

  // Escape ILIKE wildcards so user input is matched literally.
  const searchTerm = search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : "";

  const conds: string[] = [];
  if (status) conds.push("Status = @Status");
  if (searchTerm) conds.push("(Giver ILIKE @Search OR Garment ILIKE @Search OR Ref ILIKE @Search)");
  const where = conds.length ? "WHERE " + conds.join(" AND ") : "";

  const listReq = pool.request().input("Limit", Int, limit).input("Offset", Int, offset);
  if (status) listReq.input("Status", NVarChar(30), status);
  if (searchTerm) listReq.input("Search", NVarChar(200), searchTerm);
  const res = await listReq.query(`
    SELECT Id, Ref, Giver, Garment, Qty, DtfCostPerUnit, ProfitPerUnit, ChargePerUnit,
           TotalCost, TotalCharge, TotalProfit, Status, HandedOverAt, Note, CreatedAt
    FROM PrintJobs
    ${where}
    ORDER BY CreatedAt DESC
    LIMIT @Limit OFFSET @Offset
  `);

  const countReq = pool.request();
  if (status) countReq.input("Status", NVarChar(30), status);
  if (searchTerm) countReq.input("Search", NVarChar(200), searchTerm);
  const count = await countReq.query(`SELECT COUNT(*)::int AS "Total" FROM PrintJobs ${where}`);

  // Totals across the current filter (not just the page) for a summary strip.
  const sumReq = pool.request();
  if (status) sumReq.input("Status", NVarChar(30), status);
  if (searchTerm) sumReq.input("Search", NVarChar(200), searchTerm);
  const totals = await sumReq.query(`
    SELECT
      COALESCE(SUM(Qty),0)::int AS TotalQty,
      CAST(COALESCE(SUM(TotalCharge),0) AS DECIMAL(18,2)) AS TotalCharge,
      CAST(COALESCE(SUM(TotalCost),0) AS DECIMAL(18,2)) AS TotalCost,
      CAST(COALESCE(SUM(TotalProfit),0) AS DECIMAL(18,2)) AS TotalProfit
    FROM PrintJobs ${where}
  `);

  return {
    rows: res.recordset,
    total: Number(count.recordset[0]?.Total ?? 0),
    totals: totals.recordset[0],
  };
}

/* ---------- Resolve the hidden "Print Jobs" variant (lazy, tx-safe) ---------- */
async function ensurePrintJobVariantId(makeReq: () => any): Promise<string> {
  const found = await makeReq().query(`
    SELECT v.Id
    FROM ProductVariants v
    JOIN Products p ON p.Id = v.ProductId
    WHERE p.Name = 'Print Jobs' AND v.SizeId IS NULL AND v.ColorId IS NULL
    LIMIT 1
  `);
  if (found.recordset[0]?.Id) return found.recordset[0].Id as string;

  // Fallback: migration not applied — create category/product/variant.
  const cat = await makeReq().query(`
    WITH ins AS (
      INSERT INTO Categories (Name, IsActive)
      SELECT 'Print Jobs', false
      WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Name='Print Jobs')
      RETURNING Id
    )
    SELECT Id FROM ins UNION ALL SELECT Id FROM Categories WHERE Name='Print Jobs' LIMIT 1
  `);
  const catId = cat.recordset[0].Id as string;

  const prod = await makeReq()
    .input("CatId", UniqueIdentifier, catId)
    .query(`
      WITH ins AS (
        INSERT INTO Products (Name, SKU, CategoryId, CostPrice, SellingPrice, IsActive)
        SELECT 'Print Jobs', 'PRINT-JOBS', @CatId, 0, 0, false
        WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Name='Print Jobs')
        RETURNING Id
      )
      SELECT Id FROM ins UNION ALL SELECT Id FROM Products WHERE Name='Print Jobs' LIMIT 1
    `);
  const prodId = prod.recordset[0].Id as string;

  const vr = await makeReq()
    .input("Pid", UniqueIdentifier, prodId)
    .query(`
      INSERT INTO ProductVariants (ProductId, SizeId, ColorId, Qty)
      VALUES (@Pid, NULL, NULL, 0)
      RETURNING Id
    `);
  return vr.recordset[0].Id as string;
}

/* ---------- Create a print-job batch (+ synced Sales row) ---------- */
export async function createPrintJob(input: PrintJobInput): Promise<PjResult> {
  await requireAdmin();

  const giver = (input.giver ?? "").trim();
  const garment = (input.garment ?? "").trim();
  const qty = Math.trunc(Number(input.qty));
  const dtfCost = Number(input.dtfCostPerUnit);
  const profit = Number(input.profitPerUnit);
  const note = (input.note ?? "").trim() || null;

  if (!garment) return { ok: false, error: "Enter what the garment is (e.g. T-shirts)." };
  if (!Number.isFinite(qty) || qty < 1) return { ok: false, error: "Quantity must be at least 1." };
  if (!Number.isFinite(dtfCost) || dtfCost < 0) return { ok: false, error: "DTF cost must be 0 or more." };
  if (!Number.isFinite(profit) || profit < 0) return { ok: false, error: "Profit must be 0 or more." };

  const chargePerUnit = dtfCost + profit;
  const totalCost = dtfCost * qty;
  const totalCharge = chargePerUnit * qty;
  const totalProfit = profit * qty;

  const pool = await getDb();
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();
    const req = () => new sql.Request(tx);

    // Next ref: PJ-<max+1>, starting at PJ-1001.
    const refRow = await req().query(
      `SELECT COALESCE(MAX(CAST(substring(Ref from 4) AS int)), 1000) + 1 AS Next
       FROM PrintJobs WHERE Ref ~ '^PJ-[0-9]+$'`
    );
    const ref = `PJ-${refRow.recordset[0].Next}`;

    const jobId = crypto.randomUUID();
    await req()
      .input("Id", UniqueIdentifier, jobId)
      .input("Ref", NVarChar(30), ref)
      .input("Giver", NVarChar(200), giver || null)
      .input("Garment", NVarChar(200), garment)
      .input("Qty", Int, qty)
      .input("Dtf", Decimal(12, 2), dtfCost)
      .input("Profit", Decimal(12, 2), profit)
      .input("Charge", Decimal(12, 2), chargePerUnit)
      .input("TotalCost", Decimal(12, 2), totalCost)
      .input("TotalCharge", Decimal(12, 2), totalCharge)
      .input("TotalProfit", Decimal(12, 2), totalProfit)
      .input("Note", NVarChar(sql.MAX), note)
      .query(`
        INSERT INTO PrintJobs
          (Id, Ref, Giver, Garment, Qty, DtfCostPerUnit, ProfitPerUnit, ChargePerUnit,
           TotalCost, TotalCharge, TotalProfit, Status, Note, CreatedAt)
        VALUES
          (@Id, @Ref, @Giver, @Garment, @Qty, @Dtf, @Profit, @Charge,
           @TotalCost, @TotalCharge, @TotalProfit, 'Pending', @Note, now())
      `);

    // Synced Sales row carries ONLY the profit so print jobs contribute just
    // their profit to all other pages (Dashboard/Finance/Reports/Item Profit) —
    // never the charge or the DTF cost. The garments aren't ours and the DTF
    // cost is a pass-through, so SellingPrice = profit/unit and CostPrice = 0.
    // The full charge/cost live only on the Print Jobs page (printjobs table).
    const variantId = await ensurePrintJobVariantId(req);
    await req()
      .input("SaleId", UniqueIdentifier, crypto.randomUUID())
      .input("PrintJobId", UniqueIdentifier, jobId)
      .input("VariantId", UniqueIdentifier, variantId)
      .input("Qty", Int, qty)
      .input("SellingPrice", Decimal(18, 2), profit)
      .input("CostPrice", Decimal(18, 2), 0)
      .query(`
        INSERT INTO Sales (Id, PrintJobId, VariantId, Qty, SellingPrice, CostPrice, PaymentMethod, PaymentStatus, SaleDate)
        VALUES (@SaleId, @PrintJobId, @VariantId, @Qty, @SellingPrice, @CostPrice, 'PrintJob', 'Completed', now())
      `);

    await tx.commit();
    return { ok: true, ref };
  } catch (err) {
    try { await tx.rollback(); } catch {}
    const msg = userErrorMessage(err);
    if (msg) return { ok: false, error: msg };
    throw err;
  }
}

/* ---------- Mark handed over ---------- */
export async function setPrintJobStatus(id: string, status: PrintJobStatus): Promise<PjResult> {
  await requireAdmin();
  const pool = await getDb();
  await pool
    .request()
    .input("Id", UniqueIdentifier, id)
    .input("Status", NVarChar(20), status)
    .query(`
      UPDATE PrintJobs
      SET Status = @Status,
          HandedOverAt = CASE WHEN @Status = 'HandedOver' THEN COALESCE(HandedOverAt, now()) ELSE NULL END
      WHERE Id = @Id
    `);
  return { ok: true };
}

/* ---------- Delete (cascades the synced Sales row) ---------- */
export async function deletePrintJob(id: string): Promise<PjResult> {
  await requireAdmin();
  const pool = await getDb();
  await pool.request().input("Id", UniqueIdentifier, id).query(`DELETE FROM PrintJobs WHERE Id=@Id`);
  return { ok: true };
}
