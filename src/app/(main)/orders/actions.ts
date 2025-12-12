"use server";

import { getDb } from "@/lib/db";
import sql, { NVarChar, UniqueIdentifier, Int, Decimal } from "mssql";

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

export async function getColorsByProductAndSize(
  productId: string,
  sizeId: string
) {
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

/* ---------- Variant Info ---------- */
export async function getVariant(
  productId: string,
  sizeId: string,
  colorId: string
) {
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
  return res.recordset[0];
}

/* ---------- Recent Orders ---------- */
export async function getRecentOrders(limit: number = 10) {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("n", Int, limit)
    .query(`
      SELECT TOP (@n) *
      FROM v_RecentOrders
      ORDER BY OrderDate DESC
  `);

  return res.recordset as {
    Id: string;
    Customer: string | null;
    Phone: string | null;
    PaymentStatus: string;
    OrderDate: Date;
    Subtotal: number;
    Discount: number;
    DeliveryFee: number;
    Total: number;
    LineCount: number;
  }[];
}

/* ---------- UPDATE order status ---------- */
/**
 * Update only the status of an order.
 * This does NOT touch Sales (your proc already handled sales on create).
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: "Pending" | "Paid" | "Partial" | "Canceled"
) {
  const pool = await getDb();
  await pool
    .request()
    .input("Id", UniqueIdentifier, orderId)
    .input("Status", NVarChar(20), newStatus)
    .query(`
      UPDATE Orders
      SET PaymentStatus = @Status
      WHERE Id = @Id
  `);

  return true;
}

/* ---------- Customer Upsert ---------- */
async function upsertCustomer(
  name: string | null,
  phone: string | null,
  address: string | null
) {
  if (!name) return null; // anonymous walk-in

  const pool = await getDb();

  // check existing by phone
  const existing = await pool
    .request()
    .input("Phone", NVarChar(50), phone ?? null)
    .query(`SELECT TOP 1 Id FROM Customers WHERE Phone=@Phone`);

  if (existing.recordset.length > 0) {
    const id = existing.recordset[0].Id;
    await pool
      .request()
      .input("Id", UniqueIdentifier, id)
      .input("Name", NVarChar(200), name)
      .input("Address", NVarChar(500), address ?? null)
      .query(
        `UPDATE Customers SET Name=@Name, Address=@Address WHERE Id=@Id`
      );
    return id;
  }

  const newId = crypto.randomUUID();
  await pool
    .request()
    .input("Id", UniqueIdentifier, newId)
    .input("Name", NVarChar(200), name)
    .input("Phone", NVarChar(50), phone ?? null)
    .input("Address", NVarChar(500), address ?? null)
    .input("CreatedAt", sql.DateTime2, new Date())
    .query(`
      INSERT INTO Customers (Id, Name, Phone, Address, CreatedAt)
      VALUES (@Id, @Name, @Phone, @Address, @CreatedAt)
  `);

  return newId;
}

/* ---------- Customers (GET + DELETE) ---------- */
export async function getCustomers() {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT 
      Id, 
      Name, 
      Phone, 
      Address, 
      CreatedAt
    FROM Customers
    ORDER BY CreatedAt DESC
  `);
  return res.recordset as {
    Id: string;
    Name: string;
    Phone: string | null;
    Address: string | null;
    CreatedAt: Date;
  }[];
}

export async function deleteCustomer(id: string) {
  const pool = await getDb();
  await pool
    .request()
    .input("Id", UniqueIdentifier, id)
    .query("DELETE FROM Customers WHERE Id=@Id");
  return true;
}

/* ---------- Order Creation ---------- */

export type OrderItemInput = {
  VariantId: string;
  Qty: number;
  SellingPrice: number;
};

export type OrderPayload = {
  Customer?: string | null;
  Phone?: string | null;
  Address?: string | null;
  PaymentStatus: "Pending" | "Paid" | "Partial" | "Canceled";
  OrderDate: string;
  Subtotal: number;
  Discount: number;
  DeliveryFee: number;
  Total: number;
  Note?: string | null;
  Items: OrderItemInput[];
};

export async function createOrder(payload: OrderPayload) {
  if (!payload.Items?.length) throw new Error("No items in order.");

  const pool = await getDb();

  const customerId = await upsertCustomer(
    payload.Customer ?? null,
    payload.Phone ?? null,
    payload.Address ?? null
  );

  // Prepare TVP rows for procedure
  const tvp = new sql.Table("dbo.udt_OrderItems");
  tvp.columns.add("VariantId", sql.UniqueIdentifier, { nullable: false });
  tvp.columns.add("Qty", sql.Int, { nullable: false });
  tvp.columns.add("SellingPrice", sql.Decimal(18, 2), { nullable: false });

  for (const it of payload.Items) {
    tvp.rows.add(it.VariantId, it.Qty, it.SellingPrice);
  }

  const req = pool.request();
  req.input("CustomerId", UniqueIdentifier, customerId);
  req.input("Customer", NVarChar(200), payload.Customer ?? null);
  req.input("Phone", NVarChar(50), payload.Phone ?? null);
  req.input("Address", NVarChar(500), payload.Address ?? null);
  req.input("PaymentStatus", NVarChar(20), payload.PaymentStatus);
  req.input("OrderDate", sql.DateTime2(7), new Date(payload.OrderDate));
  req.input("Subtotal", Decimal(18, 2), payload.Subtotal);
  req.input("Discount", Decimal(18, 2), payload.Discount);
  req.input("DeliveryFee", Decimal(18, 2), payload.DeliveryFee);
  req.input("Total", Decimal(18, 2), payload.Total);
  req.input("Note", NVarChar(1000), payload.Note ?? null);
  req.input("Items", tvp);

  // This proc is already doing:
  // - insert Orders
  // - insert OrderItems
  // - insert Sales rows (your dashboard proved this ✅)
  // - reduce stock
  const out = await req.execute("dbo.sp_create_order");

  const OrderId = out.recordset?.[0]?.OrderId as string | undefined;
  if (!OrderId) throw new Error("Order creation failed.");

  return { OrderId };
}
