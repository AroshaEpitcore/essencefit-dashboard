"use server";

import { getDb } from "@/lib/db";
import sql from "mssql";

// ✅ Get all suppliers
export async function getSuppliers() {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, Name, Contact, Notes, CreatedAt
    FROM Suppliers
    ORDER BY CreatedAt DESC
  `);
  return res.recordset;
}

// ✅ Create supplier
export async function createSupplier(name: string, contact: string | null, notes: string | null) {
  const pool = await getDb();
  const id = crypto.randomUUID();

  await pool.request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("Name", sql.NVarChar(200), name)
    .input("Contact", sql.NVarChar(200), contact || null)
    .input("Notes", sql.NVarChar(sql.MAX), notes || null)
    .input("CreatedAt", sql.DateTime2, new Date())
    .query(`
      INSERT INTO Suppliers (Id, Name, Contact, Notes, CreatedAt)
      VALUES (@Id, @Name, @Contact, @Notes, @CreatedAt)
    `);

  return { Id: id, Name: name, Contact: contact, Notes: notes };
}

// ✅ Update supplier
export async function updateSupplier(id: string, name: string, contact: string | null, notes: string | null) {
  const pool = await getDb();
  await pool.request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("Name", sql.NVarChar(200), name)
    .input("Contact", sql.NVarChar(200), contact || null)
    .input("Notes", sql.NVarChar(sql.MAX), notes || null)
    .query(`
      UPDATE Suppliers
      SET Name=@Name, Contact=@Contact, Notes=@Notes
      WHERE Id=@Id
    `);
  return true;
}

// ✅ Delete supplier
export async function deleteSupplier(id: string) {
  const pool = await getDb();
  await pool.request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`DELETE FROM Suppliers WHERE Id=@Id`);
  return true;
}

// ✅ Get single supplier (for edit form)
export async function getSupplierById(id: string) {
  const pool = await getDb();
  const res = await pool.request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`SELECT Id, Name, Contact, Notes FROM Suppliers WHERE Id=@Id`);
  return res.recordset[0] || null;
}
