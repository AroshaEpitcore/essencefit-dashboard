"use server";

import { getDb } from "@/lib/db";
import sql from "@/lib/sqlShim";
import bcrypt from "bcryptjs";

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

  return {
    Id: user.Id,
    Username: user.Username,
    Email: user.Email,
    Role: user.Role,
  };
}
