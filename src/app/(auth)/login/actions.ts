"use server";

import { getDb } from "@/lib/db";
import sql from "@/lib/sqlShim";
import bcrypt from "bcryptjs";
import { setAdminSessionCookie, clearAdminSessionCookie } from "@/lib/adminAuth";

export async function loginUser(username: string, password: string) {
  const pool = await getDb();

  const result = await pool
    .request()
    .input("Username", sql.NVarChar, username)
    .query("SELECT * FROM Users WHERE Username=@Username LIMIT 1");

  if (result.recordset.length === 0) throw new Error("User not found");

  const user = result.recordset[0];
  const valid = await bcrypt.compare(password, user.PasswordHash);

  if (!valid) throw new Error("Invalid password");

  const session = {
    Id: user.Id,
    Username: user.Username,
    Email: user.Email,
    Role: user.Role,
  };

  // Server-side session — the middleware and every admin action check this
  // cookie; the localStorage copy the login page keeps is UI-only.
  await setAdminSessionCookie(session);

  return session;
}

export async function logoutUser() {
  await clearAdminSessionCookie();
  return true;
}
