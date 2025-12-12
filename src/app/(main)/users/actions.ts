"use server";

import { getDb } from "@/lib/db";

// Fetch all users
export async function getUsers() {
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT Id, Username, Email, Role, CreatedAt
    FROM Users
    ORDER BY CreatedAt DESC
  `);
  return result.recordset;
}

// Add new user
export async function addUser(username: string, email: string, passwordHash: string, role: string) {
  const pool = await getDb();
  const result = await pool.request()
    .input("username", username)
    .input("email", email)
    .input("passwordHash", passwordHash)
    .input("role", role)
    .query(`
      INSERT INTO Users (Username, Email, PasswordHash, Role)
      OUTPUT INSERTED.Id, INSERTED.Username, INSERTED.Email, INSERTED.Role, INSERTED.CreatedAt
      VALUES (@username, @email, @passwordHash, @role)
    `);
  return result.recordset[0];
}

// Update user (without changing password here)
export async function updateUser(id: string, username: string, email: string, role: string) {
  const pool = await getDb();
  const result = await pool.request()
    .input("id", id)
    .input("username", username)
    .input("email", email)
    .input("role", role)
    .query(`
      UPDATE Users
      SET Username = @username, Email = @email, Role = @role
      OUTPUT INSERTED.Id, INSERTED.Username, INSERTED.Email, INSERTED.Role, INSERTED.CreatedAt
      WHERE Id = @id
    `);
  return result.recordset[0];
}

// Delete user
export async function deleteUser(id: string) {
  const pool = await getDb();
  await pool.request().input("id", id).query(`DELETE FROM Users WHERE Id = @id`);
  return { success: true };
}
