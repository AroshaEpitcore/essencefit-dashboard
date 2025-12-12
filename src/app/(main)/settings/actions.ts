"use server";

import { getDb } from "@/lib/db";
import sql from "mssql";

// ✅ Get all settings
export async function getSettings() {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, [Key], [Value], UpdatedAt 
    FROM Settings ORDER BY [Key]
  `);
  return res.recordset;
}

// ✅ Get setting by key
export async function getSetting(key: string) {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("Key", sql.NVarChar(100), key)
    .query(`SELECT TOP 1 * FROM Settings WHERE [Key]=@Key`);
  return res.recordset[0] || null;
}

// ✅ Upsert (create/update) setting
export async function saveSetting(key: string, value: string | null) {
  const pool = await getDb();

  await pool
    .request()
    .input("Key", sql.NVarChar(100), key)
    .input("Value", sql.NVarChar(sql.MAX), value)
    .query(`
      MERGE Settings AS target
      USING (SELECT @Key AS [Key]) AS src
      ON target.[Key] = src.[Key]
      WHEN MATCHED THEN
        UPDATE SET [Value]=@Value, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (Id, [Key], [Value], UpdatedAt)
        VALUES (NEWID(), @Key, @Value, SYSUTCDATETIME());
    `);

  return true;
}

// ✅ Delete setting
export async function deleteSetting(id: string) {
  const pool = await getDb();
  await pool.request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`DELETE FROM Settings WHERE Id=@Id`);
  return true;
}
