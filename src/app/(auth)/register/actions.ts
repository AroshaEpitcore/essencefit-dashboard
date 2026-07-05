"use server";

import { getDb } from "@/lib/db";
import sql from "@/lib/sqlShim";
import bcrypt from "bcryptjs";
import { getAdminSession } from "@/lib/adminAuth";

export async function registerUser(username: string, email: string, password: string, role: string) {
  const pool = await getDb();

  // Registration is NOT public: only a signed-in Admin can create users.
  // Sole exception: the very first user (empty Users table) bootstraps as Admin.
  const session = await getAdminSession();
  if (!session || session.Role !== "Admin") {
    const count = await pool.request().query(`SELECT COUNT(*)::int AS n FROM Users`);
    if (Number(count.recordset[0].n) > 0) {
      throw new Error("Only an Admin can create new users. Please log in as Admin first.");
    }
    role = "Admin"; // first-ever user becomes the Admin regardless of the form value
  }

  if (role !== "Admin" && role !== "Staff") throw new Error("Invalid role.");
  if (!password || password.length < 6) throw new Error("Password must be at least 6 characters.");

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
      VALUES (gen_random_uuid(), @Username, @Email, @PasswordHash, @Role, now())
    `);

  return { success: true, username, role };
}
