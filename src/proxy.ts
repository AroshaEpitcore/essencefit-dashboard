import { NextRequest, NextResponse } from "next/server";

/* Server-side gate for the admin panel (Next 16 'proxy' convention — the
   successor of middleware.ts). The (main) layout's localStorage
   check is cosmetic — real enforcement is this middleware (pages/RSC data)
   plus requireAdmin() inside every admin server action.

   Verifies the `ef_admin` signed cookie (shape defined in src/lib/adminAuth.ts)
   with Web Crypto because middleware runs on the edge runtime. */

const ADMIN_ONLY = [
  "/finance", "/expenses", "/reports", "/users", "/settings",
  "/dtf", "/dtf-orders", "/catalog", "/store-settings",
];

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToString(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function verifyToken(token: string, secret: string): Promise<{ role: string } | null> {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(b64));
  if (bytesToBase64url(new Uint8Array(mac)) !== sig) return null;
  try {
    const data = JSON.parse(base64urlToString(b64));
    if (!data.uid || !data.role || !data.exp || Date.now() > data.exp) return null;
    return { role: data.role as string };
  } catch {
    return null;
  }
}

export default async function proxy(req: NextRequest) {
  const token = req.cookies.get("ef_admin")?.value;
  // Fail closed in production: without a real secret no token can be trusted.
  const secret =
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "essencefit-dev-secret-change-me");
  const session = token && secret ? await verifyToken(token, secret) : null;
  const { pathname } = req.nextUrl;

  if (!session) {
    // Server actions / fetches get a 401; page loads get the login screen.
    if (req.method !== "GET") {
      return new NextResponse("Admin session required", { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (session.role !== "Admin" && ADMIN_ONLY.some((r) => pathname.startsWith(r))) {
    if (req.method !== "GET") {
      return new NextResponse("Admin role required", { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/* Every route under src/app/(main) — the storefront (shop) routes stay public.
   Note /orders vs storefront /order/[id], /dtf-orders vs /dtf-order: matchers
   are whole-segment so the storefront routes don't collide. */
export const config = {
  matcher: [
    "/analysis/:path*", "/catalog/:path*", "/color-requests/:path*",
    "/customers/:path*", "/dashboard/:path*", "/dispatch/:path*",
    "/dtf/:path*", "/dtf-orders/:path*", "/expenses/:path*",
    "/finance/:path*", "/inventory/:path*", "/invoices/:path*",
    "/map/:path*", "/order-logs/:path*", "/orders/:path*",
    "/purchases/:path*", "/reports/:path*", "/returns/:path*",
    "/reviews/:path*", "/sales/:path*", "/settings/:path*",
    "/stock-history/:path*", "/stocks/:path*", "/store-feedback/:path*",
    "/store-gallery/:path*", "/store-settings/:path*", "/suppliers/:path*",
    "/users/:path*", "/web-orders/:path*", "/whatsapp/:path*",
  ],
};
