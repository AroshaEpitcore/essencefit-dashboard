"use server";

import { getDb } from "@/lib/db";
import sql from "mssql";
import bcrypt from "bcryptjs";

export async function registerUser(username: string, email: string, password: string, role: string) {
  const pool = await getDb();

  // Check duplicate
  const existing = await pool
    .request()
    .input("Username", sql.NVarChar, username)
    .query("SELECT Id FROM Users WHERE Username=@Username OR Email=@Username");

  if (existing.recordset.length > 0) {
    throw new Error("User already exists");
  }

  const hashed = await bcrypt.hash(password, 10);

  await pool
    .request()
    .input("Username", sql.NVarChar, username)
    .input("Email", sql.NVarChar, email)
    .input("PasswordHash", sql.NVarChar, hashed)
    .input("Role", sql.NVarChar, role)
    .query(`
      INSERT INTO Users (Id, Username, Email, PasswordHash, Role, CreatedAt)
      VALUES (NEWID(), @Username, @Email, @PasswordHash, @Role, GETDATE())
    `);

  return { success: true, username, role };
}
