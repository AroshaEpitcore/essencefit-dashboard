"use server";

import { requireAdmin } from "@/lib/adminAuth";

import { getDb, sql } from "@/lib/db";

const { UniqueIdentifier, NVarChar, Int, Decimal } = sql;

export type DtfOrderStatus =
  | "Pending"
  | "Confirmed"
  | "InProduction"
  | "Ready"
  | "Completed"
  | "Canceled";

/* ---------- List ---------- */
export async function getDtfOrders(opts?: { limit?: number; offset?: number; status?: string }) {
  await requireAdmin();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const status = (opts?.status ?? "").trim();
  const pool = await getDb();

  const where = status ? "WHERE o.Status = @Status" : "";

  const listReq = pool.request().input("Limit", Int, limit).input("Offset", Int, offset);
  if (status) listReq.input("Status", NVarChar(30), status);
  const res = await listReq.query(`
    SELECT
      o.Id, o.Ref, o.CustomerName, o.CustomerPhone, o.WhatsApp, o.Qty,
      o.EstimatedTotal, o.FinalTotal, o.Status, o.StockDeducted, o.CreatedAt,
      p.Name AS ProductName,
      (SELECT COUNT(*) FROM DtfOrderDesigns d WHERE d.DtfOrderId = o.Id) AS DesignCount
    FROM DtfOrders o
    LEFT JOIN Products p ON p.Id = o.ProductId
    ${where}
    ORDER BY o.CreatedAt DESC
    LIMIT @Limit OFFSET @Offset
  `);

  const countReq = pool.request();
  if (status) countReq.input("Status", NVarChar(30), status);
  const count = await countReq.query(`SELECT COUNT(*)::int AS "Total" FROM DtfOrders o ${where}`);

  return { rows: res.recordset, total: Number(count.recordset[0]?.Total ?? 0) };
}

/* ---------- Detail ---------- */
export async function getDtfOrderDetails(id: string) {
  await requireAdmin();
  const pool = await getDb();
  const header = await pool
    .request()
    .input("Id", UniqueIdentifier, id)
    .query(`
      SELECT o.*, p.Name AS ProductName,
        s.Name AS SizeName, c.Name AS ColorName,
        v.Qty AS VariantStock
      FROM DtfOrders o
      LEFT JOIN Products p ON p.Id = o.ProductId
      LEFT JOIN ProductVariants v ON v.Id = o.VariantId
      LEFT JOIN Sizes s ON s.Id = v.SizeId
      LEFT JOIN Colors c ON c.Id = v.ColorId
      WHERE o.Id = @Id LIMIT 1
    `);
  if (!header.recordset[0]) throw new Error("DTF order not found");

  const designs = await pool
    .request()
    .input("Id", UniqueIdentifier, id)
    .query(`SELECT Id, Url, Kind, SortOrder FROM DtfOrderDesigns WHERE DtfOrderId=@Id ORDER BY SortOrder`);

  return { order: header.recordset[0], designs: designs.recordset };
}

/* ---------- Admin pricing ---------- */
export async function updateDtfOrderPricing(
  id: string,
  finalTotal: number | null,
  advanceAmount: number | null,
  adminNote: string | null
) {
  await requireAdmin();
  const pool = await getDb();
  await pool
    .request()
    .input("Id", UniqueIdentifier, id)
    .input("FinalTotal", Decimal(10, 2), finalTotal ?? null)
    .input("AdvanceAmount", Decimal(10, 2), advanceAmount ?? null)
    .input("AdminNote", NVarChar(sql.MAX), adminNote || null)
    .query(`UPDATE DtfOrders SET FinalTotal=@FinalTotal, AdvanceAmount=@AdvanceAmount, AdminNote=@AdminNote WHERE Id=@Id`);

  await syncDtfOrderSales(() => pool.request(), id);
  return true;
}

/* ---------- Confirm (reserve stock) ---------- */
export async function confirmDtfOrder(id: string) {
  await requireAdmin();
  const pool = await getDb();
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();

    const r = await new sql.Request(tx)
      .input("Id", UniqueIdentifier, id)
      .query(`SELECT Status, StockDeducted, VariantId, Qty FROM DtfOrders WHERE Id=@Id LIMIT 1 FOR UPDATE`);
    const o = r.recordset[0];
    if (!o) throw new Error("DTF order not found");
    if (o.Status === "Canceled") throw new Error("This order is canceled.");

    // Deduct stock once, only if a variant was chosen and not already deducted.
    if (o.VariantId && !o.StockDeducted) {
      const vr = await new sql.Request(tx)
        .input("Vid", UniqueIdentifier, o.VariantId)
        .query(`SELECT dbo.fn_StockVariantId(@Vid) AS StockVid,
                       (SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(@Vid)) AS Qty,
                       COALESCE((SELECT z.SellingPrice FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(@Vid)),0) AS SellingPrice LIMIT 1`);
      const v = vr.recordset[0];
      const stock = v?.Qty ?? 0;
      const stockVid = v?.StockVid;
      if (o.Qty > stock) throw new Error(`Not enough stock — only ${stock} of the chosen variant in stock.`);

      // Guarded decrement — re-checks stock under the UPDATE's row lock
      const upd = await new sql.Request(tx)
        .input("Vid", UniqueIdentifier, stockVid)
        .input("Qty", Int, o.Qty)
        .query(`UPDATE ProductVariants SET Qty = Qty - @Qty WHERE Id=@Vid AND Qty >= @Qty`);
      if (!upd.rowsAffected[0]) {
        throw new Error(`Not enough stock — only ${stock} of the chosen variant in stock.`);
      }

      await new sql.Request(tx)
        .input("VariantId", UniqueIdentifier, stockVid)
        .input("ChangeQty", Int, -o.Qty)
        .input("PreviousQty", Int, stock)
        .input("NewQty", Int, stock - o.Qty)
        .input("SellingPrice", Decimal(18, 2), v?.SellingPrice ?? 0)
        .query(`INSERT INTO StockHistory (VariantId, ChangeQty, Reason, PreviousQty, NewQty, PriceAtChange, CreatedAt)
                VALUES (@VariantId, @ChangeQty, 'dtf-order', @PreviousQty, @NewQty, @SellingPrice, now())`);
    }

    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, id)
      .input("Deducted", sql.Bit, o.VariantId ? 1 : o.StockDeducted)
      .query(`UPDATE DtfOrders SET Status='Confirmed', StockDeducted=@Deducted,
              ConfirmedAt=COALESCE(ConfirmedAt, now()) WHERE Id=@Id`);

    await tx.commit();
    return true;
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}

/* ---------- Sales sync (Completed DTF orders count as sales) ----------
 * Mirrors shouldCreateSales/insertSalesRows/deleteSalesForOrder in
 * orders/actions.ts: delete-then-reinsert keeps Sales in sync with the
 * order's current status, so toggling status or editing FinalTotal never
 * leaves stale/duplicate rows. Sales.OrderId is FK'd to Orders (a
 * DtfOrders.Id can't go there) so this uses Sales.DtfOrderId instead and
 * leaves OrderId NULL — Dashboard/Reports read Sales directly and never
 * require OrderId to resolve, so this is enough for a DTF sale to appear
 * in revenue/units/charts everywhere. Requires a chosen VariantId
 * (Sales.VariantId is NOT NULL); orders with no garment variant chosen
 * are skipped.
 *
 * CostPrice = GarmentPrice + chosen print costs + overhead, parsed from
 * BreakdownJson — deliberately EXCLUDES the profit line and the flat
 * "Order Extra" charge, so real profit = FinalTotal - CostPrice. If
 * BreakdownJson is missing/unparseable, falls back to GarmentPrice +
 * PrintCharges (i.e. assumes zero profit was baked in) rather than just
 * GarmentPrice, so a parsing gap under-states profit instead of
 * overstating it.
 */
async function syncDtfOrderSales(requestFactory: () => any, dtfOrderId: string) {
  const r = await requestFactory()
    .input("Id", UniqueIdentifier, dtfOrderId)
    .query(`SELECT Status, VariantId, Qty, FinalTotal, EstimatedTotal, GarmentPrice, PrintCharges, BreakdownJson, CreatedAt FROM DtfOrders WHERE Id=@Id LIMIT 1`);
  const o = r.recordset[0];
  if (!o) return;

  await requestFactory()
    .input("Id", UniqueIdentifier, dtfOrderId)
    .query(`DELETE FROM Sales WHERE DtfOrderId=@Id`);

  if (o.Status === "Completed" && o.VariantId) {
    const qty = o.Qty || 1;
    const total = Number(o.FinalTotal ?? o.EstimatedTotal ?? 0);
    const unitPrice = total / qty;

    const garmentPrice = Number(o.GarmentPrice ?? 0);
    let unitCost = garmentPrice + Number(o.PrintCharges ?? 0); // conservative fallback
    try {
      const bd = o.BreakdownJson ? JSON.parse(o.BreakdownJson) : null;
      if (bd && Array.isArray(bd.prints)) {
        const printSum = bd.prints.reduce((s: number, p: { amount: number }) => s + Number(p.amount || 0), 0);
        unitCost = garmentPrice + printSum + Number(bd.overheadTotal || 0);
      }
    } catch {
      // keep the conservative fallback above
    }

    await requestFactory()
      .input("SaleId", UniqueIdentifier, crypto.randomUUID())
      .input("DtfOrderId", UniqueIdentifier, dtfOrderId)
      .input("VariantId", UniqueIdentifier, o.VariantId)
      .input("Qty", Int, qty)
      .input("SellingPrice", Decimal(18, 2), unitPrice)
      .input("CostPrice", Decimal(18, 2), unitCost)
      .input("SaleDate", sql.DateTime2(7), o.CreatedAt)
      .query(`
        INSERT INTO Sales (Id, DtfOrderId, VariantId, Qty, SellingPrice, CostPrice, PaymentMethod, PaymentStatus, SaleDate)
        VALUES (@SaleId, @DtfOrderId, @VariantId, @Qty, @SellingPrice, @CostPrice, 'DTF', 'Completed', @SaleDate)
      `);
  }
}

/* ---------- Status change (incl. Cancel → restore stock) ---------- */
export async function setDtfOrderStatus(id: string, status: DtfOrderStatus) {
  await requireAdmin();
  const pool = await getDb();
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();

    const r = await new sql.Request(tx)
      .input("Id", UniqueIdentifier, id)
      .query(`SELECT Status, StockDeducted, VariantId, Qty FROM DtfOrders WHERE Id=@Id LIMIT 1 FOR UPDATE`);
    const o = r.recordset[0];
    if (!o) throw new Error("DTF order not found");

    // Canceling a stock-reserved order restores it exactly once.
    if (status === "Canceled" && o.StockDeducted && o.VariantId) {
      const vr = await new sql.Request(tx)
        .input("Vid", UniqueIdentifier, o.VariantId)
        .query(`SELECT dbo.fn_StockVariantId(@Vid) AS StockVid,
                       (SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(@Vid)) AS Qty,
                       COALESCE((SELECT z.SellingPrice FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(@Vid)),0) AS SellingPrice LIMIT 1`);
      const stock = vr.recordset[0]?.Qty ?? 0;
      const stockVid = vr.recordset[0]?.StockVid;

      await new sql.Request(tx)
        .input("Vid", UniqueIdentifier, stockVid)
        .input("Qty", Int, o.Qty)
        .query(`UPDATE ProductVariants SET Qty = Qty + @Qty WHERE Id=@Vid`);

      await new sql.Request(tx)
        .input("VariantId", UniqueIdentifier, stockVid)
        .input("ChangeQty", Int, o.Qty)
        .input("PreviousQty", Int, stock)
        .input("NewQty", Int, stock + o.Qty)
        .input("SellingPrice", Decimal(18, 2), vr.recordset[0]?.SellingPrice ?? 0)
        .query(`INSERT INTO StockHistory (VariantId, ChangeQty, Reason, PreviousQty, NewQty, PriceAtChange, CreatedAt)
                VALUES (@VariantId, @ChangeQty, 'dtf-cancel', @PreviousQty, @NewQty, @SellingPrice, now())`);

      await new sql.Request(tx)
        .input("Id", UniqueIdentifier, id)
        .query(`UPDATE DtfOrders SET Status='Canceled', StockDeducted = false WHERE Id=@Id`);
    } else {
      await new sql.Request(tx)
        .input("Id", UniqueIdentifier, id)
        .input("Status", NVarChar(20), status)
        .query(`UPDATE DtfOrders SET Status=@Status WHERE Id=@Id`);
    }

    await syncDtfOrderSales(() => new sql.Request(tx), id);

    await tx.commit();
    return true;
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}
