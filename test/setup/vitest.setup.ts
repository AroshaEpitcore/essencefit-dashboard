import path from "node:path";
import dotenv from "dotenv";
import "@testing-library/jest-dom/vitest";

// Ensure env is loaded inside each worker (config-level load doesn't always
// propagate). The app's db singleton reads DB_SERVER raw, so normalize the
// instance separator (`\\` in the env file → single `\`).
dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });
if (process.env.DB_SERVER) {
  process.env.DB_SERVER = process.env.DB_SERVER.replace(/\\\\/g, "\\");
}
