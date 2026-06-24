import { describe, it, expect, afterAll } from "vitest";
import { testDb, closeTestDb, SEED } from "../fixtures/db";

/* Assumes the test DB was provisioned via `npm run test:db:reset`. */
describe("integration smoke (test DB)", () => {
  afterAll(closeTestDb);

  it("connects to the test DB and finds the seed admin", async () => {
    const pool = await testDb();
    const r = await pool.request().query(`SELECT Username, Role FROM Users WHERE Username='admin'`);
    expect(r.recordset[0]?.Role).toBe("Admin");
  });

  it("has the three seed products (normal, design, POD)", async () => {
    const pool = await testDb();
    const r = await pool
      .request()
      .query(`SELECT COUNT(*) AS c FROM Products WHERE Id IN ('${SEED.productNormal}','${SEED.productDesign}','${SEED.productPod}')`);
    expect(r.recordset[0].c).toBe(3);
  });

  it("resolves stock through dbo.fn_StockVariantId", async () => {
    const pool = await testDb();
    const r = await pool
      .request()
      .query(`SELECT dbo.fn_StockVariantId('${SEED.variantNormalSBlack}') AS v`);
    expect(r.recordset[0].v.toLowerCase()).toBe(SEED.variantNormalSBlack.toLowerCase());
  });
});
