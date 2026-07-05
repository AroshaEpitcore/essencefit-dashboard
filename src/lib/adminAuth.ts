import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";

/* Signed-cookie session for the ADMIN panel (mirrors customerAuth.ts).
   Before this existed, admin "auth" was localStorage-only and every admin
   server action was callable by anyone. The cookie is the server-side source
   of truth; localStorage `authUser` remains a pure UI convenience.

   - Token = base64url(payload).base64url(hmacSHA256(payload, SESSION_SECRET))
   - Payload carries { uid, un, role, exp } so middleware and action guards can
     enforce role without a DB round-trip per call (HMAC makes it tamper-proof).
   - Middleware (src/middleware.ts) re-implements the verify with Web Crypto —
     keep the token shape in sync with it and with test/fixtures/auth.ts. */

const COOKIE = "ef_admin";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type AdminSession = { Id: string; Username: string; Role: string };

function secret(): string {
  return process.env.SESSION_SECRET || "essencefit-dev-secret-change-me";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createAdminToken(user: AdminSession): string {
  const body = JSON.stringify({
    uid: user.Id,
    un: user.Username,
    role: user.Role,
    exp: Date.now() + MAX_AGE * 1000,
  });
  const b64 = Buffer.from(body).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

function verifyAdminToken(token: string): AdminSession | null {
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
    if (!data.uid || !data.role || !data.exp || Date.now() > data.exp) return null;
    return { Id: data.uid, Username: data.un || "", Role: data.role };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

/* Guard for admin server actions. `role` tightens it to a single role
   (e.g. requireAdmin("Admin") for finance/users/settings actions — mirrors
   ADMIN_ONLY_ROUTES in useAuth.ts). Throws so the action never runs. */
export async function requireAdmin(role?: "Admin"): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("Not signed in — please log in to the admin panel.");
  if (role && session.Role !== role) throw new Error("This action requires the Admin role.");
  return session;
}

// Cookie mutation helpers — call only from server actions / route handlers.
export async function setAdminSessionCookie(user: AdminSession) {
  const store = await cookies();
  store.set(COOKIE, createAdminToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearAdminSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}
