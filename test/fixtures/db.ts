import sql from "mssql";

/* A standalone connection pool to the test DB for setup/assertions inside
   integration tests (separate from the app's own src/lib/db singleton). */
let pool: sql.ConnectionPool | null = null;

export async function testDb(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: (process.env.DB_SERVER || "localhost").replace(/\\\\/g, "\\"),
      database: process.env.DB_NAME,
      options: { encrypt: false, trustServerCertificate: true },
    });
  }
  return pool;
}

export async function closeTestDb(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

/* Per-test unique identifiers so parallel/repeated runs don't collide. */
export function uniquePhone(): string {
  return "07" + String(Date.now()).slice(-7) + Math.floor(Math.random() * 10);
}
export function uniqueEmail(): string {
  return `t${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
}

/* Fixed seed ids from db/seed_test.sql. */
export const SEED = {
  adminUserId: "AAAAAAAA-0000-0000-0000-000000000001",
  staffUserId: "AAAAAAAA-0000-0000-0000-000000000002",
  customerId: "CCCCCCCC-0000-0000-0000-000000000001",
  customerEmail: "test@example.com",
  customerPhone: "0770000001",
  category: "0CA70000-0000-0000-0000-000000000001",
  sizeS: "5A000000-0000-0000-0000-000000000001",
  sizeM: "5A000000-0000-0000-0000-000000000002",
  sizeL: "5A000000-0000-0000-0000-000000000003",
  colorBlack: "C0000000-0000-0000-0000-000000000001",
  colorWhite: "C0000000-0000-0000-0000-000000000002",
  productNormal: "B0000000-0000-0000-0000-000000000001",
  productDesign: "B0000000-0000-0000-0000-000000000002",
  productPod: "B0000000-0000-0000-0000-000000000003",
  variantNormalSBlack: "D0000000-0000-0000-0000-000000000001", // qty 10
  variantNormalMBlack: "D0000000-0000-0000-0000-000000000002", // qty 5
  variantNormalLBlack: "D0000000-0000-0000-0000-000000000003", // qty 0 (out of stock)
  variantNormalMWhite: "D0000000-0000-0000-0000-000000000004", // qty 8
  variantDesign1: "D0000000-0000-0000-0000-000000000011", // qty 7
  variantDesign2: "D0000000-0000-0000-0000-000000000012", // qty 3
  variantPodSBlack: "D0000000-0000-0000-0000-000000000021", // qty 0 (POD)
  variantPodMBlack: "D0000000-0000-0000-0000-000000000022", // qty 0 (POD)
} as const;
