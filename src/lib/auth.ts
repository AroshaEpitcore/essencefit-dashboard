"use server";
import sql from "mssql";

import { getDb } from "./db";
import bcrypt from "bcryptjs";

export async function registerUser(username: string, email: string, password: string, role: string) {
  const db = await getDb();
  const hashed = await bcrypt.hash(password, 10);

  const result = await db.request()
    .input("Id", sql.UniqueIdentifier, crypto.randomUUID())
    .input("Username", sql.NVarChar(100), username)
    .input("Email", sql.NVarChar(200), email)
    .input("PasswordHash", sql.NVarChar(200), hashed)
    .input("Role", sql.NVarChar(20), role)
    .input("CreatedAt", sql.DateTime2, new Date())
    .query(`
      INSERT INTO Users (Id, Username, Email, PasswordHash, Role, CreatedAt)
      VALUES (@Id, @Username, @Email, @PasswordHash, @Role, @CreatedAt)
    `);

  return result.rowsAffected[0] > 0;
}

export async function loginUser(username: string, password: string) {
  const db = await getDb();

  const user = await db.request()
    .input("Username", sql.NVarChar(100), username)
    .query(`SELECT TOP 1 * FROM Users WHERE Username = @Username`);

  if (user.recordset.length === 0) return null;

  const dbUser = user.recordset[0];
  const isMatch = await bcrypt.compare(password, dbUser.PasswordHash);

  if (!isMatch) return null;

  return {
    Id: dbUser.Id,
    Username: dbUser.Username,
    Email: dbUser.Email,
    Role: dbUser.Role,
  };
}
