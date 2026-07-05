"use server";

import bcrypt from "bcryptjs";
import { getDb, sql } from "@/lib/db";
import {
  getCurrentCustomer,
  setSessionCookie,
  clearSessionCookie,
  createResetToken,
  verifyResetToken,
  hashFingerprint,
  type CustomerSession,
} from "@/lib/customerAuth";
import { sendCustomerPasswordReset } from "@/lib/orderNotify";

/* NOTE (all account actions): expected failures are RETURNED as
   { ok:false, error } instead of thrown — Next.js masks thrown Error messages
   from server actions in production, so a throw would show the customer a
   generic "an error occurred" instead of the real reason. */
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function registerCustomer(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<ActionResult> {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.trim();
  const password = input.password;

  if (!name || !email || !phone || !password) return { ok: false, error: "All fields are required." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const pool = await getDb();

  // email already registered?
  const emailTaken = await pool
    .request()
    .input("Email", sql.NVarChar(200), email)
    .query(`SELECT Id FROM Customers WHERE Email=@Email AND PasswordHash IS NOT NULL LIMIT 1`);
  if (emailTaken.recordset.length) return { ok: false, error: "An account with this email already exists." };

  const hash = await bcrypt.hash(password, 10);

  // Link to an existing guest customer with the same phone, else create new.
  const guest = await pool
    .request()
    .input("Phone", sql.NVarChar(50), phone)
    .query(`SELECT Id FROM Customers WHERE Phone=@Phone AND PasswordHash IS NULL LIMIT 1`);

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

export async function loginCustomer(input: { identifier: string; password: string }): Promise<ActionResult> {
  const identifier = input.identifier?.trim();
  if (!identifier || !input.password) return { ok: false, error: "Enter your email/phone and password." };

  const pool = await getDb();
  const res = await pool
    .request()
    .input("Id", sql.NVarChar(200), identifier.toLowerCase())
    .input("Phone", sql.NVarChar(50), identifier)
    .query(`SELECT Id, PasswordHash FROM Customers
            WHERE (LOWER(Email)=@Id OR Phone=@Phone) AND PasswordHash IS NOT NULL LIMIT 1`);

  const row = res.recordset[0];
  if (!row) return { ok: false, error: "Invalid credentials." };
  const ok = await bcrypt.compare(input.password, row.PasswordHash);
  if (!ok) return { ok: false, error: "Invalid credentials." };

  await setSessionCookie(row.Id);
  return { ok: true };
}

export async function logoutCustomer() {
  await clearSessionCookie();
  return { ok: true };
}

/* Forgot password: emails a 30-minute reset link. Always resolves { ok: true }
   so the response never reveals whether an account exists for that email. */
export async function requestPasswordReset(email: string) {
  const e = email?.trim().toLowerCase();
  if (!e) return { ok: true };

  const pool = await getDb();
  const res = await pool
    .request()
    .input("Email", sql.NVarChar(200), e)
    .query(`SELECT Id, Name, Email, PasswordHash FROM Customers
            WHERE LOWER(Email)=@Email AND PasswordHash IS NOT NULL LIMIT 1`);
  const row = res.recordset[0];
  if (row) {
    const token = createResetToken(row.Id, row.PasswordHash);
    const site = process.env.NEXT_PUBLIC_SITE_URL || "";
    const link = `${site}/account/reset?token=${encodeURIComponent(token)}`;
    await sendCustomerPasswordReset({ to: row.Email, customerName: row.Name || "", link });
  }
  return { ok: true };
}

export async function resetPassword(input: { token: string; password: string }): Promise<ActionResult> {
  const password = input.password || "";
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const data = verifyResetToken(input.token || "");
  if (!data) return { ok: false, error: "This reset link is invalid or has expired. Please request a new one." };

  const pool = await getDb();
  const res = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, data.cid)
    .query(`SELECT Id, PasswordHash FROM Customers WHERE Id=@Id AND PasswordHash IS NOT NULL LIMIT 1`);
  const row = res.recordset[0];
  // The token fingerprints the hash it was issued against — once the password
  // changes (this link was used, or a newer one was), it no longer matches.
  if (!row || hashFingerprint(row.PasswordHash) !== data.fp) {
    return { ok: false, error: "This reset link is invalid or has expired. Please request a new one." };
  }

  const hash = await bcrypt.hash(password, 10);
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, row.Id)
    .input("Hash", sql.NVarChar(200), hash)
    .query(`UPDATE Customers SET PasswordHash=@Hash WHERE Id=@Id`);

  await setSessionCookie(row.Id); // signed in with the new password
  return { ok: true };
}

export async function getMyAccount(): Promise<CustomerSession | null> {
  return getCurrentCustomer();
}

export type MyOrder = {
  kind: "order" | "dtf";
  id: string;
  number: string; // display reference
  date: string;
  status: string;
  total: number;
  count: number; // line items / designs
  label: string | null; // payment method / "Custom print"
  href: string;
  thumbs: string[]; // a few product / design image urls for the list preview
};

const splitThumbs = (s: string | null): string[] =>
  (s ? s.split("|") : []).filter(Boolean);

/* All of the customer's orders — regular web orders AND DTF custom orders —
   matched by account id OR the same phone/email (so guest-placed orders surface
   once they log in). Newest first. */
export async function getMyOrders(): Promise<MyOrder[]> {
  const me = await getCurrentCustomer();
  if (!me) return [];
  const pool = await getDb();

  const bind = (r: ReturnType<Awaited<ReturnType<typeof getDb>>["request"]>) =>
    r
      .input("Cid", sql.UniqueIdentifier, me.Id)
      .input("Phone", sql.NVarChar(50), me.Phone || null)
      .input("Email", sql.NVarChar(200), me.Email || null);

  const ordersRes = await bind(pool.request()).query(`
    SELECT o.Id, o.OrderDate, o.PaymentStatus, o.PaymentMethod, o.Total,
           (SELECT COUNT(*) FROM OrderItems oi WHERE oi.OrderId=o.Id) AS LineCount,
           (SELECT STRING_AGG(t.Url, '|') FROM (
              SELECT COALESCE((SELECT Url FROM ProductImages WHERE VariantId = oi.VariantId LIMIT 1), p.ImageUrl) AS Url
              FROM OrderItems oi
              JOIN ProductVariants v ON v.Id = oi.VariantId
              JOIN Products p ON p.Id = v.ProductId
              WHERE oi.OrderId = o.Id LIMIT 4
            ) t) AS Thumbs
    FROM Orders o
    WHERE o.Source='web' AND (o.CustomerId=@Cid
       OR (@Phone IS NOT NULL AND o.CustomerPhone=@Phone)
       OR (@Email IS NOT NULL AND o.CustomerEmail=@Email))
    ORDER BY o.OrderDate DESC
  `);

  const dtfRes = await bind(pool.request()).query(`
    SELECT d.Id, d.Ref, d.CreatedAt, d.Status,
           COALESCE(d.FinalTotal, d.EstimatedTotal) AS Total,
           (SELECT COUNT(*) FROM DtfOrderDesigns g WHERE g.DtfOrderId=d.Id) AS DesignCount,
           (SELECT STRING_AGG(t.Url, '|') FROM (
              SELECT Url FROM DtfOrderDesigns
              WHERE DtfOrderId = d.Id AND Kind = 'image' ORDER BY SortOrder LIMIT 4
            ) t) AS Thumbs
    FROM DtfOrders d
    WHERE d.CustomerId=@Cid
       OR (@Phone IS NOT NULL AND d.CustomerPhone=@Phone)
       OR (@Email IS NOT NULL AND d.Email=@Email)
    ORDER BY d.CreatedAt DESC
  `);

  const orders: MyOrder[] = ordersRes.recordset.map((o: any) => ({
    kind: "order",
    id: o.Id,
    number: String(o.Id).slice(0, 8).toUpperCase(),
    date: o.OrderDate,
    status: o.PaymentStatus,
    total: Number(o.Total) || 0,
    count: o.LineCount,
    label: o.PaymentMethod || null,
    href: `/order/${o.Id}`,
    thumbs: splitThumbs(o.Thumbs),
  }));

  const dtf: MyOrder[] = dtfRes.recordset.map((d: any) => ({
    kind: "dtf",
    id: d.Id,
    number: d.Ref,
    date: d.CreatedAt,
    status: d.Status,
    total: Number(d.Total) || 0,
    count: d.DesignCount,
    label: "Custom print",
    href: `/dtf-order/${d.Id}`,
    thumbs: splitThumbs(d.Thumbs),
  }));

  return [...orders, ...dtf].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

/* A single DTF order for the owner (account id or matching phone/email), for the
   customer tracking page. Returns null if it isn't theirs. */
export async function getMyDtfOrder(id: string) {
  const me = await getCurrentCustomer();
  if (!me) return null;
  const pool = await getDb();
  const header = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("Cid", sql.UniqueIdentifier, me.Id)
    .input("Phone", sql.NVarChar(50), me.Phone || null)
    .input("Email", sql.NVarChar(200), me.Email || null)
    .query(`
      SELECT d.*, p.Name AS ProductName, s.Name AS SizeName, c.Name AS ColorName
      FROM DtfOrders d
      LEFT JOIN Products p ON p.Id = d.ProductId
      LEFT JOIN ProductVariants v ON v.Id = d.VariantId
      LEFT JOIN Sizes s ON s.Id = v.SizeId
      LEFT JOIN Colors c ON c.Id = v.ColorId
      WHERE d.Id=@Id AND (
        d.CustomerId=@Cid
        OR (@Phone IS NOT NULL AND d.CustomerPhone=@Phone)
        OR (@Email IS NOT NULL AND d.Email=@Email)
      ) LIMIT 1
    `);
  if (!header.recordset[0]) return null;
  const designs = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`SELECT Id, Url, Kind, SortOrder FROM DtfOrderDesigns WHERE DtfOrderId=@Id ORDER BY SortOrder`);
  return { order: header.recordset[0], designs: designs.recordset };
}

export type MyOrderItem = {
  Qty: number;
  SellingPrice: number;
  ProductName: string;
  Slug: string | null;
  ImageUrl: string | null;
  SizeName: string | null;
  ColorName: string | null;
};

export type MyOrderStatusLog = {
  OldStatus: string | null;
  NewStatus: string;
  ChangedAt: string;
};

/* A single web order for its owner (account id or matching phone/email), for the
   customer order-detail / tracking page. Returns null if it isn't theirs. */
export async function getMyOrder(id: string) {
  const me = await getCurrentCustomer();
  if (!me) return null;
  const pool = await getDb();

  const header = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("Cid", sql.UniqueIdentifier, me.Id)
    .input("Phone", sql.NVarChar(50), me.Phone || null)
    .input("Email", sql.NVarChar(200), me.Email || null)
    .query(`
      SELECT o.Id, o.Customer, o.CustomerPhone, o.SecondaryPhone, o.Address, o.Province,
             o.CustomerEmail, o.Notes, o.PaymentMethod, o.PaymentSlipUrl, o.PaymentStatus,
             o.PaymentVerified, o.OrderDate, o.Subtotal, o.ManualDiscount, o.Discount,
             o.DeliveryFee, o.Total
      FROM Orders o
      WHERE o.Id=@Id AND o.Source='web' AND (
        o.CustomerId=@Cid
        OR (@Phone IS NOT NULL AND o.CustomerPhone=@Phone)
        OR (@Email IS NOT NULL AND o.CustomerEmail=@Email)
      ) LIMIT 1
    `);
  if (!header.recordset[0]) return null;

  const items = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`
      SELECT oi.Qty, oi.SellingPrice, p.Name AS ProductName, p.Slug,
             COALESCE((SELECT Url FROM ProductImages WHERE VariantId = oi.VariantId LIMIT 1), p.ImageUrl) AS ImageUrl,
             s.Name AS SizeName, c.Name AS ColorName
      FROM OrderItems oi
      JOIN ProductVariants v ON v.Id = oi.VariantId
      JOIN Products p ON p.Id = v.ProductId
      LEFT JOIN Sizes s ON s.Id = v.SizeId
      LEFT JOIN Colors c ON c.Id = v.ColorId
      WHERE oi.OrderId=@Id
      ORDER BY p.Name
    `);

  const logs = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`SELECT OldStatus, NewStatus, ChangedAt FROM OrderStatusLogs
            WHERE OrderId=@Id ORDER BY ChangedAt ASC`);

  return {
    order: header.recordset[0],
    items: items.recordset as MyOrderItem[],
    logs: logs.recordset as MyOrderStatusLog[],
  };
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
