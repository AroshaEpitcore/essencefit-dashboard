/* ---------- Orders: delivery province (per-province delivery fees) ----------
   The storefront checkout lets customers pick their province; its fee comes from
   Settings(delivery_provinces) and the chosen name is stored here.
   SecondaryPhone is also guarded idempotently (added in an earlier session,
   previously without a checked-in migration). */

IF COL_LENGTH('Orders', 'Province') IS NULL
  ALTER TABLE Orders ADD Province NVARCHAR(50) NULL;
GO

IF COL_LENGTH('Orders', 'SecondaryPhone') IS NULL
  ALTER TABLE Orders ADD SecondaryPhone NVARCHAR(20) NULL;
GO
