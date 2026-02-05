"use server";

import { getDb } from "@/lib/db";
import sql, { NVarChar, UniqueIdentifier, Int, Decimal } from "mssql";

type OrderStatus = "Pending" | "Paid" | "Partial" | "Completed" | "Canceled";
export type OrderRange = "today" | "yesterday" | "last7" | "last30" | "all";

/* ---------- Lookups ---------- */

export async function getCategories() {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, Name FROM Categories ORDER BY Name
  `);
  return res.recordset as { Id: string; Name: string }[];
}

export async function getProductsByCategory(categoryId: string) {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("cat", UniqueIdentifier, categoryId)
    .query(`
      SELECT Id, Name FROM Products
      WHERE CategoryId=@cat
      ORDER BY Name
    `);
  return res.recordset as { Id: string; Name: string }[];
}

export async function getSizesByProduct(productId: string) {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", UniqueIdentifier, productId)
    .query(`
      SELECT DISTINCT s.Id, s.Name
      FROM ProductVariants v
      JOIN Sizes s ON s.Id = v.SizeId
      WHERE v.ProductId=@pid
      ORDER BY s.Name
    `);
  return res.recordset as { Id: string; Name: string }[];
}

export async function getColorsByProductAndSize(productId: string, sizeId: string) {
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
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", UniqueIdentifier, productId)
    .input("sid", UniqueIdentifier, sizeId)
    .input("cid", UniqueIdentifier, colorId)
    .query(`
      SELECT TOP 1
        v.Id AS VariantId,
        v.Qty AS InStock,
        ISNULL(v.SellingPrice, p.SellingPrice) AS SellingPrice
      FROM ProductVariants v
      JOIN Products p ON p.Id = v.ProductId
      WHERE v.ProductId=@pid AND v.SizeId=@sid AND v.ColorId=@cid
    `);

  return res.recordset[0] as
    | { VariantId: string; InStock: number; SellingPrice: number }
    | undefined;
}

export async function getVariantStockByProductAndSize(
  productId: string,
  sizeId: string
): Promise<Record<string, number>> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", UniqueIdentifier, productId)
    .input("sid", UniqueIdentifier, sizeId)
    .query(`
      SELECT v.ColorId, v.Qty
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
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", UniqueIdentifier, productId)
    .query(`
      SELECT TOP 1 Id, CategoryId
      FROM Products
      WHERE Id=@pid
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
  Address?: string | null;
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
  const pool = await getDb();
  const { from, to } = rangeToFromTo(range);

  const req = pool.request().input("n", Int, limit);
  req.input("from", sql.DateTime2, from);
  req.input("to", sql.DateTime2, to);

  const res = await req.query(`
    SELECT TOP (@n)
      o.Id,
      o.Customer,
      o.CustomerPhone,
      o.Address,
      o.PaymentStatus,
      o.OrderDate,
      o.Subtotal,
      o.Discount,
      o.DeliveryFee,
      o.Total,
      (SELECT COUNT(*) FROM OrderItems oi WHERE oi.OrderId = o.Id) AS LineCount,
      (SELECT ISNULL(SUM(oi.Qty * ISNULL(pv.CostPrice, ISNULL(p2.CostPrice, 0))), 0)
       FROM OrderItems oi
       JOIN ProductVariants pv ON pv.Id = oi.VariantId
       JOIN Products p2 ON p2.Id = pv.ProductId
       WHERE oi.OrderId = o.Id) AS TotalCost
    FROM Orders o
    WHERE (@from IS NULL OR o.OrderDate >= @from)
      AND (@to IS NULL OR o.OrderDate < @to)
    ORDER BY o.OrderDate DESC
  `);

  return res.recordset;
}

/* ---------- Order Details ---------- */

export async function getOrderDetails(orderId: string) {
  const pool = await getDb();

  const header = await pool
    .request()
    .input("Id", UniqueIdentifier, orderId)
    .query(`
      SELECT TOP 1
        Id, Customer, CustomerPhone, Address, PaymentStatus, OrderDate, 
        Subtotal, ManualDiscount, Discount, DeliveryFee, Total 
      FROM Orders
      WHERE Id=@Id
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
        ISNULL(v.CostPrice, ISNULL(p.CostPrice, 0)) AS CostPrice,
        v.Qty AS CurrentStock,
        p.Id          AS ProductId,
        p.CategoryId  AS CategoryId,
        v.SizeId      AS SizeId,
        v.ColorId     AS ColorId,

        p.Name AS ProductName,
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

async function validateAndReduceStock(tx: sql.Transaction, items: OrderItemInput[]) {
  for (const it of items) {
    const chk = await new sql.Request(tx)
      .input("VariantId", UniqueIdentifier, it.VariantId)
      .query(`SELECT TOP 1 Qty FROM ProductVariants WHERE Id=@VariantId`);

    const inStock = chk.recordset?.[0]?.Qty ?? 0;
    if (it.Qty > inStock) throw new Error(`Not enough stock. In stock: ${inStock}`);
  }

  for (const it of items) {
    await new sql.Request(tx)
      .input("VariantId", UniqueIdentifier, it.VariantId)
      .input("Qty", Int, it.Qty)
      .query(`UPDATE ProductVariants SET Qty = Qty - @Qty WHERE Id=@VariantId`);
  }
}

async function restoreStockFromOrder(tx: sql.Transaction, orderId: string) {
  await new sql.Request(tx)
    .input("OrderId", UniqueIdentifier, orderId)
    .query(`
      UPDATE v
      SET v.Qty = v.Qty + oi.Qty
      FROM ProductVariants v
      JOIN OrderItems oi ON oi.VariantId = v.Id
      WHERE oi.OrderId=@OrderId
    `);
}

/* ---------- Customer upsert inside TX ---------- */

async function upsertCustomerTx(
  tx: sql.Transaction,
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
      .query(`SELECT TOP 1 Id FROM Customers WHERE Phone=@Phone`);

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

async function insertSalesRows(
  tx: sql.Transaction,
  orderId: string,
  status: OrderStatus,
  orderDate: Date,
  items: OrderItemInput[]
) {
  for (const it of items) {
    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, crypto.randomUUID())
      .input("OrderId", UniqueIdentifier, orderId)
      .input("VariantId", UniqueIdentifier, it.VariantId)
      .input("Qty", Int, it.Qty)
      .input("SellingPrice", Decimal(18, 2), it.SellingPrice)
      .input("PaymentMethod", NVarChar(50), "Order")
      .input("PaymentStatus", NVarChar(20), status)
      .input("SaleDate", sql.DateTime2(7), orderDate)
      .query(`
        INSERT INTO Sales (Id, OrderId, VariantId, Qty, SellingPrice, PaymentMethod, PaymentStatus, SaleDate)
        VALUES (@Id, @OrderId, @VariantId, @Qty, @SellingPrice, @PaymentMethod, @PaymentStatus, @SaleDate)
      `);
  }
}

async function deleteSalesForOrder(tx: sql.Transaction, orderId: string) {
  await new sql.Request(tx)
    .input("OrderId", UniqueIdentifier, orderId)
    .query(`DELETE FROM Sales WHERE OrderId=@OrderId`);
}

/* ---------- CREATE Order ---------- */

export async function createOrder(payload: OrderPayload) {
  if (!payload.Items?.length) throw new Error("No items in order.");

  const pool = await getDb();
  const tx = new sql.Transaction(pool);

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

    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, orderId)
      .input("Customer", NVarChar(200), payload.Customer ?? null)
      .input("CustomerPhone", NVarChar(20), payload.CustomerPhone ?? null)
      .input("Address", NVarChar(300), payload.Address ?? null)
      .input("CustomerId", UniqueIdentifier, customerId)
      .input("PaymentStatus", NVarChar(20), payload.PaymentStatus)
      .input("OrderDate", sql.DateTime2(7), orderDate)
      .input("Subtotal", Decimal(18, 2), payload.Subtotal)
      .input("ManualDiscount", Decimal(18, 2), payload.ManualDiscount)
      .input("Discount", Decimal(18, 2), payload.Discount)
      .input("DeliveryFee", Decimal(18, 2), payload.DeliveryFee)
      .input("Total", Decimal(18, 2), payload.Total)
      .query(`
        INSERT INTO Orders (Id, Customer, CustomerPhone, Address, CustomerId, PaymentStatus, OrderDate, Subtotal, ManualDiscount, Discount, DeliveryFee, Total)
        VALUES (@Id, @Customer, @CustomerPhone, @Address, @CustomerId, @PaymentStatus, @OrderDate, @Subtotal, @ManualDiscount, @Discount, @DeliveryFee, @Total)
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

    await tx.commit();
    return { OrderId: orderId };
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}

/* ---------- UPDATE Order Status ---------- */

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
  const pool = await getDb();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // update order status
    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, orderId)
      .input("Status", NVarChar(20), newStatus)
      .query(`UPDATE Orders SET PaymentStatus=@Status WHERE Id=@Id`);

    // always remove old sales rows
    await deleteSalesForOrder(tx, orderId);

    // if new status is Paid/Completed, recreate sales rows using current order items
    if (shouldCreateSales(newStatus)) {
      const header = await new sql.Request(tx)
        .input("Id", UniqueIdentifier, orderId)
        .query(`SELECT TOP 1 OrderDate FROM Orders WHERE Id=@Id`);

      const orderDate: Date = header.recordset?.[0]?.OrderDate ?? new Date();

      const items = await new sql.Request(tx)
        .input("Id", UniqueIdentifier, orderId)
        .query(`
          SELECT VariantId, Qty, SellingPrice
          FROM OrderItems
          WHERE OrderId=@Id
        `);

      const mapped = items.recordset as Array<{ VariantId: string; Qty: number; SellingPrice: number }>;
      await insertSalesRows(tx, orderId, newStatus, orderDate, mapped);
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
  if (!payload.Items?.length) throw new Error("No items in order.");

  const pool = await getDb();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // restore stock from old items
    await restoreStockFromOrder(tx, orderId);

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
      .input("Address", NVarChar(300), payload.Address ?? null)
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
            Address=@Address,
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

    // reduce stock for new items
    await validateAndReduceStock(tx, payload.Items);

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
  const pool = await getDb();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    await restoreStockFromOrder(tx, orderId);

    await new sql.Request(tx).input("OrderId", UniqueIdentifier, orderId)
      .query(`DELETE FROM OrderItems WHERE OrderId=@OrderId`);

    await deleteSalesForOrder(tx, orderId);

    await new sql.Request(tx).input("Id", UniqueIdentifier, orderId)
      .query(`DELETE FROM Orders WHERE Id=@Id`);

    await tx.commit();
    return true;
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}
