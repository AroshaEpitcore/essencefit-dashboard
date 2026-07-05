import crypto from "node:crypto";
import { test as base, type BrowserContext } from "@playwright/test";

/* Mirror of src/lib/customerAuth.ts token format so tests can mint a valid
   `ef_customer` session cookie deterministically (SESSION_SECRET comes from
   .env.local via playwright.config.ts). */
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

export async function loginContextAsCustomer(context: BrowserContext, baseURL: string, customerId: string) {
  const host = new URL(baseURL).hostname;
  await context.addCookies([
    {
      name: "ef_customer",
      value: mintCustomerCookie(customerId),
      domain: host,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/* Admin auth is localStorage-only (src/lib/useAuth.ts + (main)/layout.tsx) —
   seeding `authUser` before any page loads is exactly what the real login
   page does, no server session involved. */
export const TEST_ADMIN = {
  Id: "AAAAAAAA-0000-0000-0000-000000000001",
  Username: "autotest-admin",
  Email: "autotest-admin@test.local",
  Role: "Admin",
};

type Fixtures = {
  /** Context pre-authenticated as an admin (localStorage authUser). */
  asAdmin: BrowserContext;
};

export const test = base.extend<Fixtures>({
  asAdmin: async ({ context }, use) => {
    await context.addInitScript((user) => {
      window.localStorage.setItem("authUser", JSON.stringify(user));
    }, TEST_ADMIN);
    await use(context);
  },
});

export { expect } from "@playwright/test";
