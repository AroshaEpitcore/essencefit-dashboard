import { execSync } from "node:child_process";

/* Reset + reseed the dedicated test DB once before the E2E run. */
export default async function globalSetup() {
  execSync("node test/db/reset.mjs", { stdio: "inherit" });
}
