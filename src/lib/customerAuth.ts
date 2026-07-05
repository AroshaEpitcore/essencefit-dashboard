import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getDb, sql } from "@/lib/db";

/* Lightweight signed-cookie session for storefront customer accounts.
   - Token = base64url(payload).base64url(hmacSHA256(payload, SESSION_SECRET))
   - Reads (getCurrentCustomer) are safe in server components.
   - Setting/clearing the cookie must happen in a server action or route handler. */

const COOKIE = "ef_customer";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    // Fail closed: with the dev fallback an attacker could mint session tokens.
    throw new Error("SESSION_SECRET is not set — refusing to sign/verify customer sessions.");
  }
  return s || "essencefit-dev-secret-change-me";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createToken(customerId: string): string {
  const body = JSON.stringify({ cid: customerId, exp: Date.now() + MAX_AGE * 1000 });
  const b64 = Buffer.from(body).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

function verifyToken(token: string): string | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expected = sign(b64);
  if (
    expected.length !== sig.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  ) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(b64, "base64url").toString());
    if (!data.cid || !data.exp || Date.now() > data.exp) return null;
    return data.cid as string;
  } catch {
    return null;
  }
}

export type CustomerSession = {
  Id: string;
  Name: string;
  Email: string | null;
  Phone: string | null;
  Address: string | null;
};

export async function getCurrentCustomer(): Promise<CustomerSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const cid = verifyToken(token);
  if (!cid) return null;

  const pool = await getDb();
  const res = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, cid)
    .query(`SELECT Id, Name, Email, Phone, Address FROM Customers WHERE Id=@Id AND PasswordHash IS NOT NULL LIMIT 1`);
  return (res.recordset[0] as CustomerSession) || null;
}

// Cookie mutation helpers — call only from server actions / route handlers.
export async function setSessionCookie(customerId: string) {
  const store = await cookies();
  store.set(COOKIE, createToken(customerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}
