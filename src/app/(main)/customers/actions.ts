"use server";

import { getDb } from "@/lib/db";
import sql from "mssql";

/**
 * 🔹 Create or update a customer automatically when an order is saved
 */
export async function upsertCustomer(
  name: string,
  phone: string | null,
  address: string | null
) {
  if (!name && !phone) return null;

  const db = await getDb();

  // Check if customer already exists by phone
  const existing = await db
    .request()
    .input("Phone", sql.NVarChar(50), phone ?? null)
    .query("SELECT TOP 1 * FROM Customers WHERE Phone=@Phone");

  if (existing.recordset.length > 0) {
    const existingCustomer = existing.recordset[0];
    await db
      .request()
      .input("Id", sql.UniqueIdentifier, existingCustomer.Id)
      .input("Name", sql.NVarChar(200), name)
      .input("Address", sql.NVarChar(500), address ?? null)
      .query("UPDATE Customers SET Name=@Name, Address=@Address WHERE Id=@Id");

    return existingCustomer.Id;
  }

  // Create new customer if not found
  const res = await db
    .request()
    .input("Id", sql.UniqueIdentifier, crypto.randomUUID())
    .input("Name", sql.NVarChar(200), name)
    .input("Phone", sql.NVarChar(50), phone ?? null)
    .input("Address", sql.NVarChar(500), address ?? null)
    .query(`
      INSERT INTO Customers (Id, Name, Phone, Address)
      OUTPUT INSERTED.Id
      VALUES (@Id, @Name, @Phone, @Address)
    `);

  return res.recordset[0].Id;
}

/**
 * 🔹 Get all customers (with order stats)
 */
export async function getCustomers() {
  const db = await getDb();
  const res = await db.request().query(`
    SELECT 
      c.Id,
      c.Name,
      c.Phone,
      c.Address,
      c.CreatedAt,
      COUNT(o.Id) AS OrderCount,
      ISNULL(SUM(o.Total), 0) AS TotalSpent
    FROM Customers c
    LEFT JOIN Orders o ON o.CustomerId = c.Id
    GROUP BY c.Id, c.Name, c.Phone, c.Address, c.CreatedAt
    ORDER BY c.CreatedAt DESC
  `);
  return res.recordset;
}

/**
 * 🔹 Get specific customer (for drawer details)
 */
export async function getCustomerById(customerId: string) {
  const db = await getDb();
  const res = await db
    .request()
    .input("Id", sql.UniqueIdentifier, customerId)
    .query(`
      SELECT TOP 1
        c.Id,
        c.Name,
        c.Phone,
        c.Address,
        c.CreatedAt,
        COUNT(o.Id) AS OrderCount,
        ISNULL(SUM(o.Total), 0) AS TotalSpent
      FROM Customers c
      LEFT JOIN Orders o ON o.CustomerId = c.Id
      WHERE c.Id=@Id
      GROUP BY c.Id, c.Name, c.Phone, c.Address, c.CreatedAt
    `);

  return res.recordset[0] || null;
}

/**
 * 🔹 Get specific customer's order history
 */
export async function getCustomerOrders(customerId: string) {
  const db = await getDb();
  const res = await db
    .request()
    .input("CustomerId", sql.UniqueIdentifier, customerId)
    .query(`
      SELECT Id, OrderDate, Total, PaymentStatus
      FROM Orders
      WHERE CustomerId=@CustomerId
      ORDER BY OrderDate DESC
    `);
  return res.recordset;
}

/**
 * 🔹 Update customer information (used in drawer)
 */
export async function updateCustomer(
  id: string,
  phone: string | null,
  address: string | null
) {
  const db = await getDb();
  await db
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("Phone", sql.NVarChar(50), phone ?? null)
    .input("Address", sql.NVarChar(500), address ?? null)
    .query("UPDATE Customers SET Phone=@Phone, Address=@Address WHERE Id=@Id");

  return true;
}

/**
 * 🔹 Delete a customer
 */
export async function deleteCustomer(id: string) {
  const db = await getDb();
  await db
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query("DELETE FROM Customers WHERE Id=@Id");

  return true;
}
