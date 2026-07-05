"use server";

import { requireAdmin } from "@/lib/adminAuth";

import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

// Fetch all users
export async function getUsers() {
  await requireAdmin();
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT Id, Username, Email, Role, CreatedAt
    FROM Users
    ORDER BY CreatedAt DESC
  `);
  return result.recordset;
}

// Add new user
export async function addUser(username: string, email: string, password: string, role: string) {
  await requireAdmin();
  if (!password || password.length < 6) throw new Error("Password must be at least 6 characters.");
  // Hash here — this used to store the raw password in PasswordHash, which
  // both leaked it and made login impossible (login bcrypt-compares).
  const passwordHash = await bcrypt.hash(password, 10);
  const pool = await getDb();
  const result = await pool.request()
    .input("username", username)
    .input("email", email)
    .input("passwordHash", passwordHash)
    .input("role", role)
    .query(`
      INSERT INTO Users (Username, Email, PasswordHash, Role)
      VALUES (@username, @email, @passwordHash, @role)
      RETURNING Id, Username, Email, Role, CreatedAt
    `);
  return result.recordset[0];
}

// Update user (without changing password here)
export async function updateUser(id: string, username: string, email: string, role: string) {
  await requireAdmin();
  const pool = await getDb();
  const result = await pool.request()
    .input("id", id)
    .input("username", username)
    .input("email", email)
    .input("role", role)
    .query(`
      UPDATE Users
      SET Username = @username, Email = @email, Role = @role
      WHERE Id = @id
      RETURNING Id, Username, Email, Role, CreatedAt
    `);
  return result.recordset[0];
}

// Delete user
export async function deleteUser(id: string) {
  await requireAdmin();
  const pool = await getDb();
  await pool.request().input("id", id).query(`DELETE FROM Users WHERE Id = @id`);
  return { success: true };
}
