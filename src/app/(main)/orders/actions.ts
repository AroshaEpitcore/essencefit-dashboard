"use server";

import { requireAdmin } from "@/lib/adminAuth";

import { getDb } from "@/lib/db";
import sql, { NVarChar, UniqueIdentifier, Int, Decimal, Transaction } from "@/lib/sqlShim";
import { sendOrderNotification } from "@/lib/orderNotify";
import { sortBySize } from "@/lib/sizeOrder";

type OrderStatus = "Pending" | "Paid" | "Partial" | "Completed" | "Canceled";
export type OrderRange = "today" | "yesterday" | "last7" | "last30" | "all";

/* ---------- Lookups ---------- */

export async function getCategories() {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, Name FROM Categories ORDER BY Name
  `);
  return res.recordset as { Id: string; Name: string }[];
}

export async function getProductsByCategory(categoryId: string) {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool
    .request()
    .input("cat", UniqueIdentifier, categoryId)
    .query(`
      SELECT Id, Name, SelectByImage, PrintOnDemand FROM Products
      WHERE CategoryId=@cat
      ORDER BY Name
    `);
  return res.recordset as { Id: string; Name: string; SelectByImage: boolean; PrintOnDemand: boolean }[];
}

/* Designs for a select-by-image product — each is a ProductVariants row tied to
   its image (size/colour NULL). Used by the admin order picker to add a design
   line directly (no size/colour cascade). Stock is blank-resolved. */
export async function getDesignsByProduct(productId: string) {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", UniqueIdentifier, productId)
    .query(`
      SELECT pi.VariantId, pi.Url, pi.SortOrder,
             COALESCE((SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(pi.VariantId)), 0) AS Qty,
             COALESCE(v.SellingPrice, p.SellingPrice) AS SellingPrice
      FROM ProductImages pi
      JOIN ProductVariants v ON v.Id = pi.VariantId
      JOIN Products p ON p.Id = v.ProductId
      WHERE pi.ProductId=@pid AND pi.VariantId IS NOT NULL
      ORDER BY pi.SortOrder
    `);
  return res.recordset as { VariantId: string; Url: string; SortOrder: number; Qty: number; SellingPrice: number }[];
}

export async function getSizesByProduct(productId: string) {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", UniqueIdentifier, productId)
    .query(`
      SELECT DISTINCT s.Id, s.Name
      FROM ProductVariants v
      JOIN Sizes s ON s.Id = v.SizeId
      WHERE v.ProductId=@pid
    `);
  return sortBySize(res.recordset as { Id: string; Name: string }[], (s) => s.Name);
}

export async function getColorsByProductAndSize(productId: string, sizeId: string) {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", UniqueIdentifier, productId)
    .input("sid", UniqueIdentifier, sizeId)
    .query(`
      SELECT DISTINCT c.Id, c.Name
      FROM ProductVariants v
      JOIN Colors c ON c.Id = v.ColorId
      WHERE v.ProductId=@pid AND v.SizeId=@sid
      ORDER BY c.Name
    `);
  return res.recordset as { Id: string; Name: string }[];
}

export async function getVariant(productId: string, sizeId: string, colorId: string) {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", UniqueIdentifier, productId)
    .input("sid", UniqueIdentifier, sizeId)
    .input("cid", UniqueIdentifier, colorId)
    .query(`
      SELECT v.Id AS VariantId,
        COALESCE((SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(v.Id)), 0) AS InStock,
        COALESCE(v.SellingPrice, p.SellingPrice) AS SellingPrice
      FROM ProductVariants v
      JOIN Products p ON p.Id = v.ProductId
      WHERE v.ProductId=@pid AND v.SizeId=@sid AND v.ColorId=@cid LIMIT 1
    `);

  return res.recordset[0] as
    | { VariantId: string; InStock: number; SellingPrice: number }
    | undefined;
}

export async function getVariantStockByProductAndSize(
  productId: string,
  sizeId: string
): Promise<Record<string, number>> {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", UniqueIdentifier, productId)
    .input("sid", UniqueIdentifier, sizeId)
    .query(`
      SELECT v.ColorId,
             COALESCE((SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(v.Id)), 0) AS Qty
      FROM ProductVariants v
      WHERE v.ProductId=@pid AND v.SizeId=@sid
    `);

  const stockMap: Record<string, number> = {};
  res.recordset.forEach((row: any) => {
    stockMap[row.ColorId] = row.Qty;
  });

  return stockMap;
}

export async function getProductInfo(productId: string) {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", UniqueIdentifier, productId)
    .query(`
      SELECT Id, CategoryId
      FROM Products
      WHERE Id=@pid LIMIT 1
    `);

  return res.recordset[0] as { Id: string; CategoryId: string } | undefined;
}

/* ---------- Types ---------- */

export type OrderItemInput = {
  VariantId: string;
  Qty: number;
  SellingPrice: number;
};

export type OrderPayload = {
  Customer?: string | null;
  CustomerPhone?: string | null;
  SecondaryPhone?: string | null;
  Address?: string | null;
  WaybillId?: string | null;
  PackagePrintPrice?: number | null;
  Notes?: string | null;
  PaymentStatus: OrderStatus;
  OrderDate: string;

  Subtotal: number;
  ManualDiscount: number;
  DeliverySaving: number;
  Discount: number;     // includes delivery-saving
  DeliveryFee: number;  // always 0 by your rule
  Total: number;

  Items: OrderItemInput[];
};

/* ---------- Date range helper ---------- */

function rangeToFromTo(range: OrderRange): { from: Date | null; to: Date | null } {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (range === "today") return { from: startToday, to: endToday };
  if (range === "yesterday") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const to = startToday;
    return { from, to };
  }
  if (range === "last7") return { from: new Date(now.getTime() - 7 * 86400000), to: null };
  if (range === "last30") return { from: new Date(now.getTime() - 30 * 86400000), to: null };
  return { from: null, to: null };
}

/* ---------- Recent Orders ---------- */

export async function getRecentOrders(limit: number = 20, range: OrderRange = "all") {
  await requireAdmin();
  const pool = await getDb();
  const { from, to } = rangeToFromTo(range);

  const req = pool.request().input("n", Int, limit);
  req.input("from", sql.DateTime2, from);
  req.input("to", sql.DateTime2, to);

  const res = await req.query(`
    SELECT o.Id,
      o.Customer,
      o.CustomerPhone,
      o.SecondaryPhone,
      o.Address,
      o.WaybillId,
      o.PackagePrintPrice,
      o.Notes,
      o.PaymentStatus,
      o.OrderDate,
      o.CompletedAt,
      o.Subtotal,
      o.Discount,
      o.DeliveryFee,
      o.Total,
      (SELECT COUNT(*) FROM OrderItems oi WHERE oi.OrderId = o.Id) AS LineCount,
      (SELECT COALESCE(SUM(oi.Qty * COALESCE((SELECT z.CostPrice FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(oi.VariantId)), COALESCE(p2.CostPrice, 0))), 0)
       FROM OrderItems oi
       JOIN ProductVariants pv ON pv.Id = oi.VariantId
       JOIN Products p2 ON p2.Id = pv.ProductId
       WHERE oi.OrderId = o.Id) AS TotalCost
    FROM Orders o
    WHERE (@from IS NULL OR o.OrderDate >= @from)
      AND (@to IS NULL OR o.OrderDate < @to)
    ORDER BY o.OrderDate DESC LIMIT @n
  `);

  return res.recordset;
}

/* ---------- Order Details ---------- */

export async function getOrderDetails(orderId: string) {
  await requireAdmin();
  const pool = await getDb();

  const header = await pool
    .request()
    .input("Id", UniqueIdentifier, orderId)
    .query(`
      SELECT Id, Customer, CustomerPhone, SecondaryPhone, Address, WaybillId, PackagePrintPrice, Notes,
        PaymentStatus, OrderDate,
        Subtotal, ManualDiscount, Discount, DeliveryFee, Total
      FROM Orders
      WHERE Id=@Id LIMIT 1
    `);

  if (!header.recordset[0]) throw new Error("Order not found");

  const items = await pool
    .request()
    .input("Id", UniqueIdentifier, orderId)
    .query(`
      SELECT
        oi.Id,
        oi.VariantId,
        oi.Qty,
        oi.SellingPrice,
        COALESCE((SELECT z.CostPrice FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(oi.VariantId)), COALESCE(p.CostPrice, 0)) AS CostPrice,
        (SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(oi.VariantId)) AS CurrentStock,
        p.Id          AS ProductId,
        p.CategoryId  AS CategoryId,
        v.SizeId      AS SizeId,
        v.ColorId     AS ColorId,

        p.Name AS ProductName,
        COALESCE((SELECT Url FROM ProductImages WHERE VariantId = oi.VariantId LIMIT 1), p.ImageUrl) AS LineImage,
        s.Name AS SizeName,
        c.Name AS ColorName
      FROM OrderItems oi
      JOIN ProductVariants v ON v.Id = oi.VariantId
      JOIN Products p ON p.Id = v.ProductId
      LEFT JOIN Sizes s ON s.Id = v.SizeId
      LEFT JOIN Colors c ON c.Id = v.ColorId
      WHERE oi.OrderId=@Id
      ORDER BY p.Name
    `);

  return { order: header.recordset[0], items: items.recordset };
}

/* ---------- Stock helpers ---------- */

// Reads the resolved (blank-aware) variant id, its current Qty and selling price
// for an ordered variant — used for both the stock write and the history row.
async function resolveStock(tx: Transaction, variantId: string) {
  const r = await new sql.Request(tx)
    .input("VariantId", UniqueIdentifier, variantId)
    .query(`
      SELECT dbo.fn_StockVariantId(@VariantId) AS StockVid,
             (SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(@VariantId)) AS Qty,
             COALESCE((SELECT z.SellingPrice FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(@VariantId)), 0) AS SellingPrice,
             COALESCE((SELECT p.PrintOnDemand FROM ProductVariants v JOIN Products p ON p.Id = v.ProductId WHERE v.Id = @VariantId), false) AS IsPOD
    `);
  return r.recordset[0] as { StockVid: string | null; Qty: number | null; SellingPrice: number; IsPOD: boolean } | undefined;
}

async function logStock(
  tx: Transaction,
  variantId: string,
  changeQty: number,
  reason: string,
  prevQty: number,
  price: number
) {
  await new sql.Request(tx)
    .input("VariantId", UniqueIdentifier, variantId)
    .input("ChangeQty", Int, changeQty)
    .input("Reason", NVarChar(50), reason)
    .input("PreviousQty", Int, prevQty)
    .input("NewQty", Int, prevQty + changeQty)
    .input("Price", Decimal(18, 2), price)
    .query(`INSERT INTO StockHistory (VariantId, ChangeQty, Reason, PreviousQty, NewQty, PriceAtChange, CreatedAt)
            VALUES (@VariantId, @ChangeQty, @Reason, @PreviousQty, @NewQty, @Price, now())`);
}

async function validateAndReduceStock(
  tx: Transaction,
  items: OrderItemInput[],
  reason: string = "order-sale"
) {
  // Validate first (resolve once), then reduce + log so nothing changes if any line is short.
  const resolved: Array<{ stockVid: string; prev: number; price: number; qty: number }> = [];
  for (const it of items) {
    const v = await resolveStock(tx, it.VariantId);
    if (v?.IsPOD) continue; // print-on-demand: made to order, never reserves stock
    const inStock = v?.Qty ?? 0;
    if (it.Qty > inStock) throw new Error(`Not enough stock. In stock: ${inStock}`);
    resolved.push({ stockVid: v!.StockVid!, prev: inStock, price: v!.SellingPrice ?? 0, qty: it.Qty });
  }

  for (const r of resolved) {
    // Guarded decrement — the WHERE re-checks stock under the UPDATE's row
    // lock so concurrent orders can't oversell past the SELECT-time check.
    const upd = await new sql.Request(tx)
      .input("Vid", UniqueIdentifier, r.stockVid)
      .input("Qty", Int, r.qty)
      .query(`UPDATE ProductVariants SET Qty = Qty - @Qty WHERE Id = @Vid AND Qty >= @Qty`);
    if (!upd.rowsAffected[0]) throw new Error(`Not enough stock. In stock: ${r.prev}`);
    await logStock(tx, r.stockVid, -r.qty, reason, r.prev, r.price);
  }
}

async function restoreStockFromOrder(
  tx: Transaction,
  orderId: string,
  reason: string = "order-return"
) {
  const items = await new sql.Request(tx)
    .input("OrderId", UniqueIdentifier, orderId)
    .query(`SELECT VariantId, Qty FROM OrderItems WHERE OrderId=@OrderId`);

  for (const it of items.recordset as Array<{ VariantId: string; Qty: number }>) {
    const v = await resolveStock(tx, it.VariantId);
    if (!v?.StockVid || v.IsPOD) continue; // POD never deducted, so nothing to restore
    const prev = v.Qty ?? 0;
    await new sql.Request(tx)
      .input("Vid", UniqueIdentifier, v.StockVid)
      .input("Qty", Int, it.Qty)
      .query(`UPDATE ProductVariants SET Qty = Qty + @Qty WHERE Id = @Vid`);
    await logStock(tx, v.StockVid, it.Qty, reason, prev, v.SellingPrice ?? 0);
  }
}

// Reconcile stock with the order's status: a non-Canceled order should hold stock;
// a Canceled one should not. Idempotent via Orders.StockDeducted.
async function reconcileOrderStock(
  tx: Transaction,
  orderId: string,
  newStatus: OrderStatus,
  items: OrderItemInput[]
) {
  const r = await new sql.Request(tx)
    .input("Id", UniqueIdentifier, orderId)
    .query(`SELECT StockDeducted FROM Orders WHERE Id=@Id LIMIT 1`);
  const deducted = !!r.recordset[0]?.StockDeducted;
  const shouldDeduct = newStatus !== "Canceled";

  if (shouldDeduct && !deducted) {
    await validateAndReduceStock(tx, items, "order-sale");
    await new sql.Request(tx).input("Id", UniqueIdentifier, orderId)
      .query(`UPDATE Orders SET StockDeducted = true WHERE Id=@Id`);
  } else if (!shouldDeduct && deducted) {
    await restoreStockFromOrder(tx, orderId, "order-cancel");
    await new sql.Request(tx).input("Id", UniqueIdentifier, orderId)
      .query(`UPDATE Orders SET StockDeducted = false WHERE Id=@Id`);
  }
}

/* ---------- Customer upsert inside TX ---------- */

async function upsertCustomerTx(
  tx: Transaction,
  name?: string | null,
  phone?: string | null,
  address?: string | null
): Promise<string | null> {
  const n = (name ?? "").trim();
  const p = (phone ?? "").trim();
  const a = (address ?? "").trim();

  if (!n && !p) return null;

  if (p) {
    const existing = await new sql.Request(tx)
      .input("Phone", NVarChar(50), p)
      .query(`SELECT Id FROM Customers WHERE Phone=@Phone LIMIT 1`);

    if (existing.recordset.length) {
      const id = existing.recordset[0].Id as string;

      await new sql.Request(tx)
        .input("Id", UniqueIdentifier, id)
        .input("Name", NVarChar(200), n || null)
        .input("Address", NVarChar(500), a || null)
        .query(`
          UPDATE Customers
          SET Name = COALESCE(@Name, Name),
              Address = COALESCE(@Address, Address)
          WHERE Id=@Id
        `);

      return id;
    }
  }

  const newId = crypto.randomUUID();
  await new sql.Request(tx)
    .input("Id", UniqueIdentifier, newId)
    .input("Name", NVarChar(200), n || (p ? `Customer ${p}` : "Customer"))
    .input("Phone", NVarChar(50), p || null)
    .input("Address", NVarChar(500), a || null)
    .query(`INSERT INTO Customers (Id, Name, Phone, Address) VALUES (@Id, @Name, @Phone, @Address)`);

  return newId;
}

/* ---------- Sales helpers ---------- */

function shouldCreateSales(status: OrderStatus) {
  return status === "Paid" || status === "Completed";
}

// Real per-unit cost for a variant: prefer the resolved stock (blank)
// variant's own CostPrice, else the product's, plus the product's Utilities.
// Resolving via fn_StockVariantId means a linked/signature product (whose own
// CostPrice is often 0) correctly picks up its blank's real cost.
async function resolveUnitCost(tx: Transaction, variantId: string): Promise<number> {
  const r = await new sql.Request(tx)
    .input("VariantId", UniqueIdentifier, variantId)
    .query(`
      SELECT COALESCE(
               (SELECT z.CostPrice FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(@VariantId)),
               p.CostPrice, 0
             ) + COALESCE(p.Utilities, 0) AS UnitCost
      FROM ProductVariants v
      JOIN Products p ON p.Id = v.ProductId
      WHERE v.Id = @VariantId
    `);
  return Number(r.recordset[0]?.UnitCost ?? 0);
}

async function insertSalesRows(
  tx: Transaction,
  orderId: string,
  status: OrderStatus,
  orderDate: Date,
  items: OrderItemInput[]
) {
  for (const it of items) {
    const unitCost = await resolveUnitCost(tx, it.VariantId);
    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, crypto.randomUUID())
      .input("OrderId", UniqueIdentifier, orderId)
      .input("VariantId", UniqueIdentifier, it.VariantId)
      .input("Qty", Int, it.Qty)
      .input("SellingPrice", Decimal(18, 2), it.SellingPrice)
      .input("CostPrice", Decimal(18, 2), unitCost)
      .input("PaymentMethod", NVarChar(50), "Order")
      .input("PaymentStatus", NVarChar(20), status)
      .input("SaleDate", sql.DateTime2(7), orderDate)
      .query(`
        INSERT INTO Sales (Id, OrderId, VariantId, Qty, SellingPrice, CostPrice, PaymentMethod, PaymentStatus, SaleDate)
        VALUES (@Id, @OrderId, @VariantId, @Qty, @SellingPrice, @CostPrice, @PaymentMethod, @PaymentStatus, @SaleDate)
      `);
  }
}

async function deleteSalesForOrder(tx: Transaction, orderId: string) {
  await new sql.Request(tx)
    .input("OrderId", UniqueIdentifier, orderId)
    .query(`DELETE FROM Sales WHERE OrderId=@OrderId`);
}

/* ---------- CREATE Order ---------- */

export async function createOrder(payload: OrderPayload) {
  await requireAdmin();
  if (!payload.Items?.length) throw new Error("No items in order.");

  const pool = await getDb();
  const tx = new Transaction(pool);

  try {
    await tx.begin();

    const orderId = crypto.randomUUID();
    const orderDate = new Date(payload.OrderDate);

    const customerId = await upsertCustomerTx(
      tx,
      payload.Customer ?? null,
      payload.CustomerPhone ?? null,
      payload.Address ?? null
    );

    const completedAt = shouldCreateSales(payload.PaymentStatus) ? orderDate : null;

    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, orderId)
      .input("Customer", NVarChar(200), payload.Customer ?? null)
      .input("CustomerPhone", NVarChar(20), payload.CustomerPhone ?? null)
      .input("SecondaryPhone", NVarChar(20), payload.SecondaryPhone ?? null)
      .input("Address", NVarChar(300), payload.Address ?? null)
      .input("WaybillId", NVarChar(100), payload.WaybillId ?? null)
      .input("PackagePrintPrice", Decimal(18, 2), payload.PackagePrintPrice ?? 0)
      .input("Notes", NVarChar(500), payload.Notes ?? null)
      .input("CustomerId", UniqueIdentifier, customerId)
      .input("PaymentStatus", NVarChar(20), payload.PaymentStatus)
      .input("OrderDate", sql.DateTime2(7), orderDate)
      .input("CompletedAt", sql.DateTime2(7), completedAt)
      .input("Subtotal", Decimal(18, 2), payload.Subtotal)
      .input("ManualDiscount", Decimal(18, 2), payload.ManualDiscount)
      .input("Discount", Decimal(18, 2), payload.Discount)
      .input("DeliveryFee", Decimal(18, 2), payload.DeliveryFee)
      .input("Total", Decimal(18, 2), payload.Total)
      .query(`
        INSERT INTO Orders (Id, Customer, CustomerPhone, SecondaryPhone, Address, WaybillId, PackagePrintPrice, Notes, CustomerId, PaymentStatus, OrderDate, CompletedAt, Subtotal, ManualDiscount, Discount, DeliveryFee, Total)
        VALUES (@Id, @Customer, @CustomerPhone, @SecondaryPhone, @Address, @WaybillId, @PackagePrintPrice, @Notes, @CustomerId, @PaymentStatus, @OrderDate, @CompletedAt, @Subtotal, @ManualDiscount, @Discount, @DeliveryFee, @Total)
      `);

    await validateAndReduceStock(tx, payload.Items);

    for (const it of payload.Items) {
      await new sql.Request(tx)
        .input("Id", UniqueIdentifier, crypto.randomUUID())
        .input("OrderId", UniqueIdentifier, orderId)
        .input("VariantId", UniqueIdentifier, it.VariantId)
        .input("Qty", Int, it.Qty)
        .input("SellingPrice", Decimal(18, 2), it.SellingPrice)
        .query(`
          INSERT INTO OrderItems (Id, OrderId, VariantId, Qty, SellingPrice)
          VALUES (@Id, @OrderId, @VariantId, @Qty, @SellingPrice)
        `);
    }

    // ✅ only create sales when status is Paid or Completed
    if (shouldCreateSales(payload.PaymentStatus)) {
      await insertSalesRows(tx, orderId, payload.PaymentStatus, orderDate, payload.Items);
    }

    // Log the initial status
    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, crypto.randomUUID())
      .input("OrderId", UniqueIdentifier, orderId)
      .input("OldStatus", NVarChar(50), null)
      .input("NewStatus", NVarChar(50), payload.PaymentStatus)
      .input("ChangedAt", sql.DateTime2(7), new Date())
      .query(`
        INSERT INTO OrderStatusLogs (Id, OrderId, OldStatus, NewStatus, ChangedAt)
        VALUES (@Id, @OrderId, @OldStatus, @NewStatus, @ChangedAt)
      `);

    await tx.commit();

    const namedItems = await pool
      .request()
      .input("Ids", payload.Items.map((it) => it.VariantId))
      .query(`
        SELECT v.Id AS VariantId, p.Name AS ProductName, s.Name AS SizeName, c.Name AS ColorName
        FROM ProductVariants v
        JOIN Products p ON p.Id = v.ProductId
        LEFT JOIN Sizes s ON s.Id = v.SizeId
        LEFT JOIN Colors c ON c.Id = v.ColorId
        WHERE v.Id = ANY(@Ids::uuid[])
      `);
    const nameByVariant = new Map(
      namedItems.recordset.map((r: any) => [
        r.VariantId,
        [r.SizeName, r.ColorName].filter(Boolean).join(" / ") ? `${r.ProductName} (${[r.SizeName, r.ColorName].filter(Boolean).join(" / ")})` : r.ProductName,
      ])
    );

    await sendOrderNotification({
      subject: `New order entered — ${payload.Customer ?? "Customer"}`,
      heading: "New Admin-Entered Order",
      lines: [
        `Customer: ${payload.Customer ?? "—"}`,
        `Phone: ${payload.CustomerPhone ?? "—"}`,
        `Total: Rs ${Number(payload.Total).toFixed(2)}`,
      ],
      items: payload.Items.map((it) => ({
        name: nameByVariant.get(it.VariantId) ?? "Item",
        qty: it.Qty,
        price: it.SellingPrice,
      })),
      adminPath: "/orders",
    });

    // Auto-create dispatch message if WaybillId is provided
    if (payload.WaybillId?.trim()) {
      try {
        const dispatchPool = await getDb();
        await dispatchPool
          .request()
          .input("Id", UniqueIdentifier, crypto.randomUUID())
          .input("OrderId", UniqueIdentifier, orderId)
          .input("WaybillId", NVarChar(100), payload.WaybillId.trim())
          .input("CustomerName", NVarChar(200), payload.Customer ?? null)
          .input("CustomerPhone", NVarChar(20), payload.CustomerPhone ?? null)
          .query(`
            INSERT INTO DispatchMessages (Id, OrderId, WaybillId, CustomerName, CustomerPhone)
            VALUES (@Id, @OrderId, @WaybillId, @CustomerName, @CustomerPhone)
          `);
      } catch (dispatchErr) {
        console.error("[Dispatch] Failed to insert dispatch message:", dispatchErr);
      }
    }

    return { OrderId: orderId };
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}

/* ---------- UPDATE Order Status ---------- */

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
  await requireAdmin();
  const pool = await getDb();
  const tx = new Transaction(pool);

  try {
    await tx.begin();

    // Get old status first for logging
    const oldStatusResult = await new sql.Request(tx)
      .input("Id", UniqueIdentifier, orderId)
      .query(`SELECT PaymentStatus FROM Orders WHERE Id=@Id LIMIT 1`);
    const oldStatus = oldStatusResult.recordset[0]?.PaymentStatus || null;

    // update order status + set CompletedAt if Paid/Completed
    const shouldSetCompleted = newStatus === "Paid" || newStatus === "Completed";
    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, orderId)
      .input("Status", NVarChar(20), newStatus)
      .input("CompletedAt", sql.DateTime2(7), shouldSetCompleted ? new Date() : null)
      .query(`
        UPDATE Orders
        SET PaymentStatus=@Status,
            CompletedAt = CASE
              WHEN @CompletedAt IS NOT NULL AND CompletedAt IS NULL THEN @CompletedAt
              WHEN @CompletedAt IS NULL THEN NULL
              ELSE CompletedAt
            END
        WHERE Id=@Id
      `);

    // Log the status change
    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, crypto.randomUUID())
      .input("OrderId", UniqueIdentifier, orderId)
      .input("OldStatus", NVarChar(50), oldStatus)
      .input("NewStatus", NVarChar(50), newStatus)
      .input("ChangedAt", sql.DateTime2(7), new Date())
      .query(`
        INSERT INTO OrderStatusLogs (Id, OrderId, OldStatus, NewStatus, ChangedAt)
        VALUES (@Id, @OrderId, @OldStatus, @NewStatus, @ChangedAt)
      `);

    // Current order items — reused for stock reconciliation and sales
    const itemsRes = await new sql.Request(tx)
      .input("Id", UniqueIdentifier, orderId)
      .query(`SELECT VariantId, Qty, SellingPrice FROM OrderItems WHERE OrderId=@Id`);
    const mapped = itemsRes.recordset as Array<{ VariantId: string; Qty: number; SellingPrice: number }>;

    // Cancel → return stock to the pool; reactivate → re-deduct (idempotent via StockDeducted)
    await reconcileOrderStock(tx, orderId, newStatus, mapped);

    // always remove old sales rows
    await deleteSalesForOrder(tx, orderId);

    // if new status is Paid/Completed, recreate sales rows using current order items
    // Use CURRENT date for SaleDate so it shows in today's dashboard
    if (shouldCreateSales(newStatus)) {
      const saleDate = new Date(); // Use NOW, not the original OrderDate
      await insertSalesRows(tx, orderId, newStatus, saleDate, mapped);
    }

    await tx.commit();
    return true;
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}

/* ---------- EDIT Order ---------- */

export async function updateOrder(orderId: string, payload: OrderPayload) {
  await requireAdmin();
  if (!payload.Items?.length) throw new Error("No items in order.");

  const pool = await getDb();
  const tx = new Transaction(pool);

  try {
    await tx.begin();

    // restore old stock only if this order currently holds stock (a Canceled
    // order has already been restored — don't double-restore)
    const dedRes = await new sql.Request(tx)
      .input("Id", UniqueIdentifier, orderId)
      .query(`SELECT StockDeducted FROM Orders WHERE Id=@Id LIMIT 1`);
    if (dedRes.recordset[0]?.StockDeducted) await restoreStockFromOrder(tx, orderId, "order-return");

    // remove old items and sales
    await new sql.Request(tx).input("OrderId", UniqueIdentifier, orderId)
      .query(`DELETE FROM OrderItems WHERE OrderId=@OrderId`);

    await deleteSalesForOrder(tx, orderId);

    const orderDate = new Date(payload.OrderDate);

    const customerId = await upsertCustomerTx(
      tx,
      payload.Customer ?? null,
      payload.CustomerPhone ?? null,
      payload.Address ?? null
    );

    // update order header
    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, orderId)
      .input("Customer", NVarChar(200), payload.Customer ?? null)
      .input("CustomerPhone", NVarChar(20), payload.CustomerPhone ?? null)
      .input("SecondaryPhone", NVarChar(20), payload.SecondaryPhone ?? null)
      .input("Address", NVarChar(300), payload.Address ?? null)
      .input("WaybillId", NVarChar(100), payload.WaybillId ?? null)
      .input("PackagePrintPrice", Decimal(18, 2), payload.PackagePrintPrice ?? 0)
      .input("Notes", NVarChar(500), payload.Notes ?? null)
      .input("CustomerId", UniqueIdentifier, customerId)
      .input("PaymentStatus", NVarChar(20), payload.PaymentStatus)
      .input("OrderDate", sql.DateTime2(7), orderDate)
      .input("Subtotal", Decimal(18, 2), payload.Subtotal)
      .input("ManualDiscount", Decimal(18, 2), payload.ManualDiscount)
      .input("Discount", Decimal(18, 2), payload.Discount)
      .input("DeliveryFee", Decimal(18, 2), payload.DeliveryFee)
      .input("Total", Decimal(18, 2), payload.Total)
      .query(`
        UPDATE Orders
        SET Customer=@Customer,
            CustomerPhone=@CustomerPhone,
            SecondaryPhone=@SecondaryPhone,
            Address=@Address,
            WaybillId=@WaybillId,
            PackagePrintPrice=@PackagePrintPrice,
            Notes=@Notes,
            CustomerId=@CustomerId,
            PaymentStatus=@PaymentStatus,
            OrderDate=@OrderDate,
            Subtotal=@Subtotal,
            ManualDiscount=@ManualDiscount,
            Discount=@Discount,
            DeliveryFee=@DeliveryFee,
            Total=@Total
        WHERE Id=@Id
      `);

    // reduce stock for new items unless the order is Canceled; keep the flag in sync
    const shouldDeduct = payload.PaymentStatus !== "Canceled";
    if (shouldDeduct) await validateAndReduceStock(tx, payload.Items, "order-sale");
    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, orderId)
      .input("Ded", sql.Bit, shouldDeduct ? 1 : 0)
      .query(`UPDATE Orders SET StockDeducted=@Ded WHERE Id=@Id`);

    // insert new items
    for (const it of payload.Items) {
      await new sql.Request(tx)
        .input("Id", UniqueIdentifier, crypto.randomUUID())
        .input("OrderId", UniqueIdentifier, orderId)
        .input("VariantId", UniqueIdentifier, it.VariantId)
        .input("Qty", Int, it.Qty)
        .input("SellingPrice", Decimal(18, 2), it.SellingPrice)
        .query(`
          INSERT INTO OrderItems (Id, OrderId, VariantId, Qty, SellingPrice)
          VALUES (@Id, @OrderId, @VariantId, @Qty, @SellingPrice)
        `);
    }

    // ✅ only create sales when Paid/Completed
    if (shouldCreateSales(payload.PaymentStatus)) {
      await insertSalesRows(tx, orderId, payload.PaymentStatus, orderDate, payload.Items);
    }

    await tx.commit();
    return true;
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}

/* ---------- DELETE Order ---------- */

export async function deleteOrder(orderId: string) {
  await requireAdmin();
  const pool = await getDb();
  const tx = new Transaction(pool);

  try {
    await tx.begin();

    // only return stock if this order currently holds it (Canceled already restored)
    const delDed = await new sql.Request(tx)
      .input("Id", UniqueIdentifier, orderId)
      .query(`SELECT StockDeducted FROM Orders WHERE Id=@Id LIMIT 1`);
    if (delDed.recordset[0]?.StockDeducted) await restoreStockFromOrder(tx, orderId, "order-return");

    await new sql.Request(tx).input("OrderId", UniqueIdentifier, orderId)
      .query(`DELETE FROM OrderItems WHERE OrderId=@OrderId`);

    await deleteSalesForOrder(tx, orderId);

    await new sql.Request(tx).input("OrderId", UniqueIdentifier, orderId)
      .query(`DELETE FROM OrderStatusLogs WHERE OrderId=@OrderId`);

    await new sql.Request(tx).input("OrderId", UniqueIdentifier, orderId)
      .query(`DELETE FROM DispatchMessages WHERE OrderId=@OrderId`);

    await new sql.Request(tx).input("Id", UniqueIdentifier, orderId)
      .query(`DELETE FROM Orders WHERE Id=@Id`);

    await tx.commit();
    return true;
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}
