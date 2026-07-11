"use server";

import { getDb } from "@/lib/db";
import sql from "@/lib/sqlShim";
import bcrypt from "bcryptjs";
import { setAdminSessionCookie, clearAdminSessionCookie } from "@/lib/adminAuth";

type AdminSession = { Id: string; Username: string; Email: string; Role: string };

export async function loginUser(
  username: string,
  password: string
): Promise<{ ok: true; user: AdminSession } | { ok: false; error: string }> {
  const pool = await getDb();

  const result = await pool
    .request()
    .input("Username", sql.NVarChar, username)
    .query("SELECT * FROM Users WHERE Username=@Username LIMIT 1");

  // Same message for both cases so a wrong username can't be distinguished
  // from a wrong password (Next.js would mask a thrown message anyway).
  if (result.recordset.length === 0) return { ok: false, error: "Invalid username or password." };

  const user = result.recordset[0];
  const valid = await bcrypt.compare(password, user.PasswordHash);

  if (!valid) return { ok: false, error: "Invalid username or password." };

  const session: AdminSession = {
    Id: user.Id,
    Username: user.Username,
    Email: user.Email,
    Role: user.Role,
  };

  // Server-side session — the middleware and every admin action check this
  // cookie; the localStorage copy the login page keeps is UI-only.
  await setAdminSessionCookie(session);

  return { ok: true, user: session };
}

export async function logoutUser() {
  await clearAdminSessionCookie();
  return true;
}
