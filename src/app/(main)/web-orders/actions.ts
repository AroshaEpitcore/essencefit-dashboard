"use server";

import { getDb, sql } from "@/lib/db";
import { updateOrderStatus, getOrderDetails } from "../orders/actions";

export async function getWebOrders() {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT
      o.Id, o.Customer, o.CustomerPhone, o.SecondaryPhone, o.Address, o.Province, o.CustomerEmail,
      o.PaymentMethod, o.PaymentSlipUrl, o.PaymentVerified, o.PaymentStatus,
      o.OrderDate, o.Notes, o.Subtotal, o.DeliveryFee, o.Total,
      (SELECT COUNT(*) FROM OrderItems oi WHERE oi.OrderId = o.Id) AS LineCount,
      CAST(CASE WHEN EXISTS (
        SELECT 1 FROM OrderItems oi
        JOIN ProductVariants v ON v.Id = oi.VariantId
        JOIN Products p ON p.Id = v.ProductId
        WHERE oi.OrderId = o.Id AND p.PrintOnDemand = 1
      ) THEN 1 ELSE 0 END AS BIT) AS HasPrintOnDemand
    FROM Orders o
    WHERE o.Source = 'web'
    ORDER BY o.OrderDate DESC
  `);
  return res.recordset;
}

// Mark a (bank-transfer) payment as verified and move the order to Paid,
// which also creates the Sales rows via the shared order-status logic.
export async function verifyWebPayment(orderId: string) {
  const pool = await getDb();
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, orderId)
    .query(`UPDATE Orders SET PaymentVerified = 1 WHERE Id=@Id`);
  await updateOrderStatus(orderId, "Paid");
  return true;
}

export async function setWebOrderStatus(
  orderId: string,
  status: "Pending" | "Paid" | "Partial" | "Completed" | "Canceled"
) {
  await updateOrderStatus(orderId, status);
  return true;
}

export async function getWebOrderDetails(orderId: string) {
  return getOrderDetails(orderId);
}
