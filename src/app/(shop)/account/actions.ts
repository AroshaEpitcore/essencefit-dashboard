"use server";

import bcrypt from "bcryptjs";
import { getDb, sql } from "@/lib/db";
import {
  getCurrentCustomer,
  setSessionCookie,
  clearSessionCookie,
  type CustomerSession,
} from "@/lib/customerAuth";

export async function registerCustomer(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.trim();
  const password = input.password;

  if (!name || !email || !phone || !password) throw new Error("All fields are required.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  const pool = await getDb();

  // email already registered?
  const emailTaken = await pool
    .request()
    .input("Email", sql.NVarChar(200), email)
    .query(`SELECT TOP 1 Id FROM Customers WHERE Email=@Email AND PasswordHash IS NOT NULL`);
  if (emailTaken.recordset.length) throw new Error("An account with this email already exists.");

  const hash = await bcrypt.hash(password, 10);

  // Link to an existing guest customer with the same phone, else create new.
  const guest = await pool
    .request()
    .input("Phone", sql.NVarChar(50), phone)
    .query(`SELECT TOP 1 Id FROM Customers WHERE Phone=@Phone AND PasswordHash IS NULL`);

  let id: string;
  if (guest.recordset.length) {
    id = guest.recordset[0].Id;
    await pool
      .request()
      .input("Id", sql.UniqueIdentifier, id)
      .input("Name", sql.NVarChar(200), name)
      .input("Email", sql.NVarChar(200), email)
      .input("Hash", sql.NVarChar(200), hash)
      .query(`UPDATE Customers SET Name=@Name, Email=@Email, PasswordHash=@Hash WHERE Id=@Id`);
  } else {
    id = crypto.randomUUID();
    await pool
      .request()
      .input("Id", sql.UniqueIdentifier, id)
      .input("Name", sql.NVarChar(200), name)
      .input("Email", sql.NVarChar(200), email)
      .input("Phone", sql.NVarChar(50), phone)
      .input("Hash", sql.NVarChar(200), hash)
      .query(`INSERT INTO Customers (Id, Name, Email, Phone, PasswordHash)
              VALUES (@Id, @Name, @Email, @Phone, @Hash)`);
  }

  await setSessionCookie(id);
  return { ok: true };
}

export async function loginCustomer(input: { identifier: string; password: string }) {
  const identifier = input.identifier?.trim();
  if (!identifier || !input.password) throw new Error("Enter your email/phone and password.");

  const pool = await getDb();
  const res = await pool
    .request()
    .input("Id", sql.NVarChar(200), identifier.toLowerCase())
    .input("Phone", sql.NVarChar(50), identifier)
    .query(`SELECT TOP 1 Id, PasswordHash FROM Customers
            WHERE (LOWER(Email)=@Id OR Phone=@Phone) AND PasswordHash IS NOT NULL`);

  const row = res.recordset[0];
  if (!row) throw new Error("Invalid credentials.");
  const ok = await bcrypt.compare(input.password, row.PasswordHash);
  if (!ok) throw new Error("Invalid credentials.");

  await setSessionCookie(row.Id);
  return { ok: true };
}

export async function logoutCustomer() {
  await clearSessionCookie();
  return { ok: true };
}

export async function getMyAccount(): Promise<CustomerSession | null> {
  return getCurrentCustomer();
}

export async function getMyOrders() {
  const me = await getCurrentCustomer();
  if (!me) return [];
  const pool = await getDb();
  const res = await pool
    .request()
    .input("Cid", sql.UniqueIdentifier, me.Id)
    .query(`
      SELECT o.Id, o.OrderDate, o.PaymentStatus, o.PaymentMethod, o.Total,
             (SELECT COUNT(*) FROM OrderItems oi WHERE oi.OrderId=o.Id) AS LineCount
      FROM Orders o
      WHERE o.CustomerId=@Cid
      ORDER BY o.OrderDate DESC
    `);
  return res.recordset;
}

export async function updateMyProfile(input: { name: string; phone: string; address: string; password?: string }) {
  const me = await getCurrentCustomer();
  if (!me) throw new Error("Not signed in.");

  const pool = await getDb();
  const req = pool
    .request()
    .input("Id", sql.UniqueIdentifier, me.Id)
    .input("Name", sql.NVarChar(200), input.name?.trim() || me.Name)
    .input("Phone", sql.NVarChar(50), input.phone?.trim() || null)
    .input("Address", sql.NVarChar(500), input.address?.trim() || null);

  let setPassword = "";
  if (input.password && input.password.trim()) {
    if (input.password.length < 6) throw new Error("Password must be at least 6 characters.");
    req.input("Hash", sql.NVarChar(200), await bcrypt.hash(input.password, 10));
    setPassword = ", PasswordHash=@Hash";
  }

  await req.query(`UPDATE Customers SET Name=@Name, Phone=@Phone, Address=@Address${setPassword} WHERE Id=@Id`);
  return { ok: true };
}
