"use server";

import { requireAdmin } from "@/lib/adminAuth";

import { getDb } from "@/lib/db";
import sql from "@/lib/sqlShim";
import {
  STORE_KEYS,
  getPublicStoreSettings,
  type StoreSettings,
} from "@/lib/storeSettings";

// ✅ Get all settings
export async function getSettings() {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, key, value, UpdatedAt 
    FROM Settings ORDER BY key
  `);
  return res.recordset;
}

// ✅ Get setting by key
export async function getSetting(key: string) {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool
    .request()
    .input("Key", sql.NVarChar(100), key)
    .query(`SELECT * FROM Settings WHERE key=@Key LIMIT 1`);
  return res.recordset[0] || null;
}

// ✅ Upsert (create/update) setting
export async function saveSetting(key: string, value: string | null) {
  await requireAdmin();
  const pool = await getDb();

  await pool
    .request()
    .input("Key", sql.NVarChar(100), key)
    .input("Value", sql.NVarChar(sql.MAX), value)
    .query(`
      INSERT INTO Settings (Id, key, value, UpdatedAt)
      VALUES (gen_random_uuid(), @Key, @Value, now())
      ON CONFLICT (key) DO UPDATE SET value = @Value, UpdatedAt = now();
    `);

  return true;
}

// ✅ Delete setting
export async function deleteSetting(id: string) {
  await requireAdmin();
  const pool = await getDb();
  await pool.request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`DELETE FROM Settings WHERE Id=@Id`);
  return true;
}

/* ============================================================
   STORE / WEBSITE SETTINGS (typed wrapper over Settings store)
   ============================================================ */

// Read all store settings (for the admin form)
export async function getStoreSettings(): Promise<StoreSettings> {
  await requireAdmin();
  return getPublicStoreSettings();
}

// Save the full store settings object (one upsert per key)
export async function saveStoreSettings(s: StoreSettings) {
  await requireAdmin();
  const pairs: Array<[string, string | null]> = [
    [STORE_KEYS.storeName, s.storeName ?? ""],
    [STORE_KEYS.logo, s.logo ?? ""],
    [STORE_KEYS.logoDark, s.logoDark ?? ""],
    [STORE_KEYS.logoLight, s.logoLight ?? ""],
    [STORE_KEYS.announcement, s.announcement ?? ""],
    [STORE_KEYS.heroSlides, JSON.stringify(s.heroSlides ?? [])],
    [STORE_KEYS.bank, JSON.stringify(s.bank ?? {})],
    [STORE_KEYS.deliveryFee, String(s.deliveryFee ?? 0)],
    [STORE_KEYS.freeDeliveryOver, String(s.freeDeliveryOver ?? 0)],
    [STORE_KEYS.deliveryProvinces, JSON.stringify(s.deliveryProvinces ?? [])],
    [STORE_KEYS.contactPhone, s.contactPhone ?? ""],
    [STORE_KEYS.contactEmail, s.contactEmail ?? ""],
    [STORE_KEYS.social, JSON.stringify(s.social ?? {})],
    [STORE_KEYS.orderNotificationEmail, s.orderNotificationEmail ?? ""],
  ];
  for (const [key, value] of pairs) {
    await saveSetting(key, value);
  }
  return true;
}
