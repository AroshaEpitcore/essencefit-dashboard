"use server";

import { requireAdmin } from "@/lib/adminAuth";

import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

// User management is Admin-only (Staff can't reach the page — the actions
// enforce the same rule server-side).

// Fetch all users
export async function getUsers() {
  await requireAdmin("Admin");
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT Id, Username, Email, Role, CreatedAt
    FROM Users
    ORDER BY CreatedAt DESC
  `);
  return result.recordset;
}

type UserResult = { ok: true } | { ok: false; error: string };

// Add new user
export async function addUser(username: string, email: string, password: string, role: string): Promise<UserResult> {
  await requireAdmin("Admin");
  if (!password || password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  // Hash here — this used to store the raw password in PasswordHash, which
  // both leaked it and made login impossible (login bcrypt-compares).
  const passwordHash = await bcrypt.hash(password, 10);
  const pool = await getDb();
  await pool.request()
    .input("username", username)
    .input("email", email)
    .input("passwordHash", passwordHash)
    .input("role", role)
    .query(`
      INSERT INTO Users (Username, Email, PasswordHash, Role)
      VALUES (@username, @email, @passwordHash, @role)
      RETURNING Id, Username, Email, Role, CreatedAt
    `);
  return { ok: true };
}

// Update user (without changing password here)
export async function updateUser(id: string, username: string, email: string, role: string): Promise<UserResult> {
  await requireAdmin("Admin");
  const pool = await getDb();

  // Never demote the last Admin (including demoting yourself when alone).
  if (role !== "Admin") {
    const admins = await pool.request().input("id", id).query(
      `SELECT COUNT(*)::int AS n FROM Users WHERE Role = 'Admin' AND Id <> @id`
    );
    const current = await pool.request().input("id", id).query(
      `SELECT Role FROM Users WHERE Id = @id LIMIT 1`
    );
    if (current.recordset[0]?.Role === "Admin" && Number(admins.recordset[0].n) === 0) {
      return { ok: false, error: "You can't remove the last Admin." };
    }
  }

  await pool.request()
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
  return { ok: true };
}

// Set a new password for an existing user (Admin resets it; there is no
// self-service reset for admin users).
export async function updateUserPassword(id: string, password: string): Promise<UserResult> {
  await requireAdmin("Admin");
  if (!password || password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  const passwordHash = await bcrypt.hash(password, 10);
  const pool = await getDb();
  await pool.request()
    .input("id", id)
    .input("passwordHash", passwordHash)
    .query(`UPDATE Users SET PasswordHash = @passwordHash WHERE Id = @id`);
  return { ok: true };
}

// Delete user
export async function deleteUser(id: string): Promise<UserResult> {
  const session = await requireAdmin("Admin");
  if (session.Id?.toLowerCase() === id?.toLowerCase()) {
    return { ok: false, error: "You can't delete your own account while signed in with it." };
  }
  const pool = await getDb();
  // Never delete the last Admin — that would lock everyone out.
  const target = await pool.request().input("id", id).query(
    `SELECT Role FROM Users WHERE Id = @id LIMIT 1`
  );
  if (target.recordset[0]?.Role === "Admin") {
    const others = await pool.request().input("id", id).query(
      `SELECT COUNT(*)::int AS n FROM Users WHERE Role = 'Admin' AND Id <> @id`
    );
    if (Number(others.recordset[0].n) === 0) return { ok: false, error: "You can't delete the last Admin." };
  }
  await pool.request().input("id", id).query(`DELETE FROM Users WHERE Id = @id`);
  return { ok: true };
}
