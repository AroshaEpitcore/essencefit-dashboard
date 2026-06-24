import crypto from "node:crypto";
import { test as base, type BrowserContext } from "@playwright/test";

/* Mirror of src/lib/customerAuth.ts token format so E2E/integration tests can
   mint a valid `ef_customer` session cookie deterministically. */
const MAX_AGE = 60 * 60 * 24 * 30;
function secret(): string {
  return process.env.SESSION_SECRET || "test-secret";
}
function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}
export function mintCustomerCookie(customerId: string): string {
  const body = JSON.stringify({ cid: customerId, exp: Date.now() + MAX_AGE * 1000 });
  const b64 = Buffer.from(body).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

export const SEED_ADMIN = {
  Id: "AAAAAAAA-0000-0000-0000-000000000001",
  Username: "admin",
  Email: "admin@test.local",
  Role: "Admin",
};
export const SEED_CUSTOMER_ID = "CCCCCCCC-0000-0000-0000-000000000001";

type Fixtures = {
  /** Context pre-authenticated as the seeded storefront customer (cookie). */
  asCustomer: BrowserContext;
  /** Context pre-authenticated as the seeded admin (localStorage authUser). */
  asAdmin: BrowserContext;
};

export const test = base.extend<Fixtures>({
  asCustomer: async ({ context, baseURL }, use) => {
    const host = new URL(baseURL || "http://localhost:3100").hostname;
    await context.addCookies([
      {
        name: "ef_customer",
        value: mintCustomerCookie(SEED_CUSTOMER_ID),
        domain: host,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await use(context);
  },
  asAdmin: async ({ context }, use) => {
    // Admin auth is localStorage-only (src/lib/useAuth.ts) — seed it before any page loads.
    await context.addInitScript((user) => {
      window.localStorage.setItem("authUser", JSON.stringify(user));
    }, SEED_ADMIN);
    await use(context);
  },
});

export { expect } from "@playwright/test";
