"use server";

import { getDb } from "@/lib/db";
import { UniqueIdentifier } from "mssql";

export async function generateInvoicePDF(orderId: string) {
  const pool = await getDb();

  // Get order details
  const orderRes = await pool
    .request()
    .input("Id", UniqueIdentifier, orderId)
    .query(`
      SELECT TOP 1
        Id, Customer, CustomerPhone, Address, PaymentStatus, OrderDate,
        Subtotal, Discount, DeliveryFee, Total
      FROM Orders
      WHERE Id=@Id
    `);

  if (!orderRes.recordset[0]) throw new Error("Order not found");
  const order = orderRes.recordset[0];

  // Get order items
  const itemsRes = await pool
    .request()
    .input("OrderId", UniqueIdentifier, orderId)
    .query(`
      SELECT
        oi.Qty,
        oi.SellingPrice,
        p.Name AS ProductName,
        s.Name AS SizeName,
        c.Name AS ColorName
      FROM OrderItems oi
      JOIN ProductVariants v ON v.Id = oi.VariantId
      JOIN Products p ON p.Id = v.ProductId
      LEFT JOIN Sizes s ON s.Id = v.SizeId
      LEFT JOIN Colors c ON c.Id = v.ColorId
      WHERE oi.OrderId=@OrderId
      ORDER BY p.Name
    `);

  const items = itemsRes.recordset;

  // Calculate delivery status
  const totalQty = items.reduce((sum, item) => sum + Number(item.Qty), 0);
  const eligibleForFreeDelivery = totalQty >= 3;
  const deliveryFee = Number(order.DeliveryFee || 0);
  const discount = Number(order.Discount || 0);
  const freeDeliveryApplied = eligibleForFreeDelivery && deliveryFee === 0 && discount > 0;

  // Return invoice data for PDF generation
  return {
    orderId: orderId.slice(0, 8).toUpperCase(),
    customer: order.Customer || "Walk-in Customer",
    phone: order.CustomerPhone || "",
    address: order.Address || "",
    status: order.PaymentStatus,
    date: new Date(order.OrderDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    items: items.map((item) => ({
      name: item.ProductName,
      variant: `${item.SizeName || ""} ${item.SizeName && item.ColorName ? "/" : ""} ${item.ColorName || ""}`.trim(),
      qty: item.Qty,
      price: Number(item.SellingPrice).toFixed(2),
      amount: (item.Qty * Number(item.SellingPrice)).toFixed(2),
    })),
    subtotal: Number(order.Subtotal).toFixed(2),
    discount: discount.toFixed(2),
    deliveryFee: deliveryFee.toFixed(2),
    freeDeliveryApplied,
    total: Number(order.Total).toFixed(2),
  };
}

export async function getWhatsAppMessage(orderId: string) {
  const pool = await getDb();

  // Get order details
  const orderRes = await pool
    .request()
    .input("Id", UniqueIdentifier, orderId)
    .query(`
      SELECT TOP 1
        Customer, CustomerPhone, OrderDate, Total, PaymentStatus, Subtotal, Discount, DeliveryFee
      FROM Orders
      WHERE Id=@Id
    `);

  if (!orderRes.recordset[0]) throw new Error("Order not found");
  const order = orderRes.recordset[0];

  // Get order items for message
  const itemsRes = await pool
    .request()
    .input("OrderId", UniqueIdentifier, orderId)
    .query(`
      SELECT
        oi.Qty,
        oi.SellingPrice,
        p.Name AS ProductName,
        s.Name AS SizeName,
        c.Name AS ColorName
      FROM OrderItems oi
      JOIN ProductVariants v ON v.Id = oi.VariantId
      JOIN Products p ON p.Id = v.ProductId
      LEFT JOIN Sizes s ON s.Id = v.SizeId
      LEFT JOIN Colors c ON c.Id = v.ColorId
      WHERE oi.OrderId=@OrderId
      ORDER BY p.Name
    `);

  const items = itemsRes.recordset;

  // Calculate delivery status
  const totalQty = items.reduce((sum, item) => sum + Number(item.Qty), 0);
  const eligibleForFreeDelivery = totalQty >= 3;
  const deliveryFee = Number(order.DeliveryFee || 0);
  const discount = Number(order.Discount || 0);
  const freeDeliveryApplied = eligibleForFreeDelivery && deliveryFee === 0 && discount > 0;

  // Create message
  const message = `
🧾 *INVOICE* #${orderId.slice(0, 8).toUpperCase()}

👤 *Customer:* ${order.Customer || "Walk-in"}
📅 *Date:* ${new Date(order.OrderDate).toLocaleDateString()}
💳 *Status:* ${order.PaymentStatus}

📦 *Items:*
${items
  .map(
    (item, idx) =>
      `${idx + 1}. ${item.ProductName}${
        item.SizeName || item.ColorName
          ? ` (${item.SizeName || ""}${item.SizeName && item.ColorName ? "/" : ""}${item.ColorName || ""})`
          : ""
      }
   Qty: ${item.Qty} × Rs ${Number(item.SellingPrice).toFixed(2)} = Rs ${(
        item.Qty * Number(item.SellingPrice)
      ).toFixed(2)}`
  )
  .join("\n\n")}

💵 *Subtotal:* Rs ${Number(order.Subtotal).toFixed(2)}
${discount > 0 ? `🎁 *Discount:* - Rs ${discount.toFixed(2)}` : ""}
${
  freeDeliveryApplied
    ? `🚚 *Delivery:* FREE ✓ (Qty ≥ 3)`
    : deliveryFee > 0
    ? `🚚 *Delivery Fee:* Rs ${deliveryFee.toFixed(2)}`
    : ""
}

💰 *Total: Rs ${Number(order.Total).toFixed(2)}*

Thank you for your business! 🙏

📄 Invoice PDF is attached.
`.trim();

  return {
    message,
    phone: order.CustomerPhone,
  };
}