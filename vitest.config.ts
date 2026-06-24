import { defineConfig } from "vitest/config";
import path from "node:path";
import dotenv from "dotenv";

// Load the test env so integration tests + the app's db singleton see DB_*/SESSION_SECRET.
dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
  test: {
    globals: true,
    environment: "node",
    // Unit tests run in jsdom; integration (and everything else) in node.
    environmentMatchGlobs: [["test/unit/**", "jsdom"]],
    include: ["test/unit/**/*.test.{ts,tsx}", "test/integration/**/*.test.ts"],
    setupFiles: ["test/setup/vitest.setup.ts"],
    // Integration tests hit a real SQL Server — keep them serial to avoid interference.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
