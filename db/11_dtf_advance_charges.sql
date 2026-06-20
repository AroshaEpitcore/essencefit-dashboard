/* ============================================================
   DTF PRINTING — Advance payment + per-order extra charge
   ------------------------------------------------------------
   Safe migration for an ALREADY-SEEDED database.
   Only adds new columns / rows when they are missing, so it
   never touches the prices you already entered.
   Run AFTER 10_dtf_printing.sql.
   ============================================================ */


/* ------------------------------------------------------------
   1) New 'Charge' price items
      - Order Extra  : flat amount added to every order total (e.g. 90)
      - Advance %    : default deposit % to confirm an order (e.g. 50)
      Both are editable in the Price Setup tab.
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM dbo.DtfPriceItems WHERE Category='Charge' AND Name='Order Extra')
  INSERT INTO dbo.DtfPriceItems (Category, Name, Amount, Unit, SortOrder)
  VALUES ('Charge', 'Order Extra', 90, 'per order', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.DtfPriceItems WHERE Category='Charge' AND Name='Advance %')
  INSERT INTO dbo.DtfPriceItems (Category, Name, Amount, Unit, SortOrder)
  VALUES ('Charge', 'Advance %', 50, '%', 2);
GO


/* ------------------------------------------------------------
   2) Extra columns on DtfQuotes so a saved quote remembers the
      extra charge, final total and advance figures.
   ------------------------------------------------------------ */
IF COL_LENGTH('dbo.DtfQuotes', 'Extra') IS NULL
  ALTER TABLE dbo.DtfQuotes ADD Extra DECIMAL(10,2) NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('dbo.DtfQuotes', 'FinalTotal') IS NULL
  ALTER TABLE dbo.DtfQuotes ADD FinalTotal DECIMAL(10,2) NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('dbo.DtfQuotes', 'AdvancePct') IS NULL
  ALTER TABLE dbo.DtfQuotes ADD AdvancePct DECIMAL(5,2) NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('dbo.DtfQuotes', 'AdvanceAmount') IS NULL
  ALTER TABLE dbo.DtfQuotes ADD AdvanceAmount DECIMAL(10,2) NOT NULL DEFAULT 0;
GO

/* Backfill FinalTotal for any quotes created before this change */
UPDATE dbo.DtfQuotes SET FinalTotal = Total WHERE FinalTotal = 0 AND Total > 0;
GO


/* ------------------------------------------------------------
   3) Polite Sinhala advance-payment templates
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM dbo.DtfTemplates WHERE Title='Advance Payment (50%)')
  INSERT INTO dbo.DtfTemplates (Title, Content, Category, Language, SortOrder) VALUES
  ('Advance Payment (50%)',
   N'ස්තූතියි ඔයාගේ order එකට 🙏✨' + CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10) +
   N'අපි custom DTF print කරන නිසා, order එක confirm කරන්න මුළු මුදලෙන් *50%ක advance* එකක් අවශ්‍යයි 🙂' + CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10) +
   N'🧾 මුළු මිල: Rs {total}' + CHAR(13)+CHAR(10) +
   N'💳 Advance (50%): *Rs {advance}*' + CHAR(13)+CHAR(10) +
   N'🚚 ඉතිරි මුදල parcel එක ලැබෙද්දී / delivery එකේදී ගෙවන්න පුළුවන්' + CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10) +
   N'🏦 Bank: HNB (Koggala)' + CHAR(13)+CHAR(10) +
   N'👤 M.G.Arosha Ravishan' + CHAR(13)+CHAR(10) +
   N'🔢 237020072483' + CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10) +
   N'📸 Advance එක දාලා slip එක එවන්න, මම order එක වහාම start කරන්නම් ✅',
   'Payment', 'Sinhala', 7);

IF NOT EXISTS (SELECT 1 FROM dbo.DtfTemplates WHERE Title='Advance Received – Confirmed')
  INSERT INTO dbo.DtfTemplates (Title, Content, Category, Language, SortOrder) VALUES
  ('Advance Received – Confirmed',
   N'Advance එක ලැබුණා ✅ ස්තූතියි 🙏' + CHAR(13)+CHAR(10) +
   N'ඔයාගේ order එක දැන් confirm 🎉 Print එක ready වෙන්න දවස් 2-3ක් යනවා.' + CHAR(13)+CHAR(10) +
   N'Ready උනාම ඉතිරි මුදල ගැන මම message කරන්නම් 📦',
   'Payment', 'Sinhala', 8);
GO


/* ------------------------------------------------------------
   USEFUL QUERIES
   ------------------------------------------------------------ */
-- Current default extra + advance %
-- SELECT Name, Amount, Unit FROM dbo.DtfPriceItems WHERE Category='Charge';

-- Change the flat extra to 100
-- UPDATE dbo.DtfPriceItems SET Amount=100, UpdatedAt=SYSUTCDATETIME()
-- WHERE Category='Charge' AND Name='Order Extra';

-- Change default advance to 60%
-- UPDATE dbo.DtfPriceItems SET Amount=60, UpdatedAt=SYSUTCDATETIME()
-- WHERE Category='Charge' AND Name='Advance %';

-- Outstanding balance still to collect across saved quotes
-- SELECT QuoteRef, CustomerName, FinalTotal, AdvanceAmount,
--        (FinalTotal - AdvanceAmount) AS BalanceDue
-- FROM dbo.DtfQuotes
-- ORDER BY CreatedAt DESC;
