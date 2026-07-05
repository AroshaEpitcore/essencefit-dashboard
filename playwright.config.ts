import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import dotenv from "dotenv";

// The app now runs on Supabase Postgres (DATABASE_URL) — E2E tests drive a
// locally started production build against that same database, so orders the
// suite places are real and land in the admin "Website Orders" screen.
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./test/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // Supabase is remote — server actions can take a few seconds each.
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Build runs once in the `test:e2e` script; here we only start the server
    // (a combined build+start exceeds any reasonable startup timeout).
    command: `npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      // Deliberately blanked: `next start` reads .env.local itself, and a set
      // RESEND_API_KEY would email the store owner for every test order.
      // Values already present in the environment win over .env.local, so an
      // empty string here disables all order emails for the test server.
      RESEND_API_KEY: "",
    },
  },
});
