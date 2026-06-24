import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
// The app's db config reads DB_SERVER raw — normalize the instance separator.
const dbServer = (process.env.DB_SERVER || "localhost").replace(/\\\\/g, "\\");

export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./test/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
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
      DB_USER: process.env.DB_USER ?? "",
      DB_PASSWORD: process.env.DB_PASSWORD ?? "",
      DB_SERVER: dbServer,
      DB_NAME: process.env.DB_NAME ?? "",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    },
  },
});
