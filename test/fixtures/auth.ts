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

/* Admin auth = signed `ef_admin` cookie (src/lib/adminAuth.ts, enforced by
   middleware + requireAdmin() in every admin action) plus a localStorage
   `authUser` copy that the (main) layout uses for its client-side gate. */
export const TEST_ADMIN = {
  Id: "AAAAAAAA-0000-0000-0000-000000000001",
  Username: "autotest-admin",
  Email: "autotest-admin@test.local",
  Role: "Admin",
};

export function mintAdminCookie(user: { Id: string; Username: string; Role: string }): string {
  const body = JSON.stringify({
    uid: user.Id,
    un: user.Username,
    role: user.Role,
    exp: Date.now() + 60 * 60 * 24 * 7 * 1000,
  });
  const b64 = Buffer.from(body).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

type Fixtures = {
  /** Context pre-authenticated as an admin (session cookie + localStorage). */
  asAdmin: BrowserContext;
};

export const test = base.extend<Fixtures>({
  asAdmin: async ({ context, baseURL }, use) => {
    const host = new URL(baseURL || "http://localhost:3100").hostname;
    await context.addCookies([
      {
        name: "ef_admin",
        value: mintAdminCookie(TEST_ADMIN),
        domain: host,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await context.addInitScript((user) => {
      window.localStorage.setItem("authUser", JSON.stringify(user));
    }, TEST_ADMIN);
    await use(context);
  },
});

export { expect } from "@playwright/test";
