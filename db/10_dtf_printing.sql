/* ============================================================
   DTF PRINTING MODULE  (T-Shirts / Shorts / Oversize / Skinners)
   EssenceFit Dashboard
   ------------------------------------------------------------
   Run order: after the core EssenceFit schema.
   MSSQL (SQL Server). All Ids are UNIQUEIDENTIFIER (NEWID()).
   ============================================================ */


/* ------------------------------------------------------------
   1) DtfPriceItems
   The single source of truth for every price component.
   Category = 'Garment' | 'Print' | 'Overhead' | 'Profit'
     Garment  -> base cost of the blank (Regular Tee, Oversize, Short, Skinner)
     Print    -> print rate per position/size (A4, A3, Front, Back ...)
     Overhead -> packaging, utilities, electricity, etc.
     Profit   -> default profit added per piece
   Everything the Quote Builder and the message templates use is
   read from this table, so updating a price here updates it
   everywhere automatically.
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.DtfPriceItems', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.DtfPriceItems (
    Id        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    Category  NVARCHAR(20)  NOT NULL,                 -- Garment | Print | Overhead | Profit
    Name      NVARCHAR(100) NOT NULL,                 -- e.g. "Oversize T-Shirt", "A3 Print"
    Amount    DECIMAL(10,2) NOT NULL DEFAULT 0,       -- cost / rate in Rs
    Unit      NVARCHAR(30)  NULL,                      -- e.g. "per piece", "per print"
    SortOrder INT           NOT NULL DEFAULT 0,
    IsActive  BIT           NOT NULL DEFAULT 1,
    UpdatedAt DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO


/* ------------------------------------------------------------
   2) DtfQuotes
   Saved customer quotations created from the Quote Builder.
   BreakdownJson stores the full line-by-line calculation so an
   old quote can always be re-opened exactly as it was made.
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.DtfQuotes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.DtfQuotes (
    Id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    QuoteRef      NVARCHAR(20)  NOT NULL,              -- e.g. DTF-1001
    CustomerName  NVARCHAR(150) NULL,
    CustomerPhone NVARCHAR(30)  NULL,
    GarmentName   NVARCHAR(100) NOT NULL,
    PrintNames    NVARCHAR(300) NULL,                  -- comma list e.g. "A3 Print, Back Print"
    Quantity      INT           NOT NULL DEFAULT 1,
    GarmentCost   DECIMAL(10,2) NOT NULL DEFAULT 0,
    PrintCost     DECIMAL(10,2) NOT NULL DEFAULT 0,
    Packaging     DECIMAL(10,2) NOT NULL DEFAULT 0,
    Utilities     DECIMAL(10,2) NOT NULL DEFAULT 0,
    Profit        DECIMAL(10,2) NOT NULL DEFAULT 0,
    UnitPrice     DECIMAL(10,2) NOT NULL DEFAULT 0,    -- selling price for ONE piece
    Total         DECIMAL(10,2) NOT NULL DEFAULT 0,    -- UnitPrice * Quantity
    Extra         DECIMAL(10,2) NOT NULL DEFAULT 0,    -- flat per-order extra (e.g. 90)
    FinalTotal    DECIMAL(10,2) NOT NULL DEFAULT 0,    -- Total + Extra (what customer pays)
    AdvancePct    DECIMAL(5,2)  NOT NULL DEFAULT 0,    -- deposit % to confirm
    AdvanceAmount DECIMAL(10,2) NOT NULL DEFAULT 0,    -- FinalTotal * AdvancePct/100
    Notes         NVARCHAR(500) NULL,
    BreakdownJson NVARCHAR(MAX) NULL,
    CreatedAt     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO


/* ------------------------------------------------------------
   3) DtfTemplates
   Re-usable WhatsApp message templates (Sinhala / English).
   Supports placeholders that are filled with LIVE prices:
     {garment} {print} {qty} {unit_price} {total}
     {price_list}  -> expands to the full current price list
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.DtfTemplates', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.DtfTemplates (
    Id        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    Title     NVARCHAR(150) NOT NULL,
    Content   NVARCHAR(MAX) NOT NULL,
    Category  NVARCHAR(50)  NOT NULL DEFAULT 'General',
    Language  NVARCHAR(20)  NOT NULL DEFAULT 'Sinhala',   -- Sinhala | English | Mixed
    SortOrder INT           NOT NULL DEFAULT 0,
    IsActive  BIT           NOT NULL DEFAULT 1,
    CreatedAt DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO


/* ============================================================
   SEED DATA  (safe to re-run – only inserts when empty)
   Amounts are starting values – edit them in the UI any time.
   ============================================================ */

/* ---- Price items ---- */
IF NOT EXISTS (SELECT 1 FROM dbo.DtfPriceItems)
BEGIN
  INSERT INTO dbo.DtfPriceItems (Category, Name, Amount, Unit, SortOrder) VALUES
  -- Garments (blank cost)
  ('Garment',  'Regular T-Shirt',  450, 'per piece', 1),
  ('Garment',  'Oversize T-Shirt', 650, 'per piece', 2),
  ('Garment',  'Short',            500, 'per piece', 3),
  ('Garment',  'Skinner',          400, 'per piece', 4),
  -- Print rates
  ('Print',    'A4 Print',         350, 'per print', 1),
  ('Print',    'A3 Print',         500, 'per print', 2),
  ('Print',    'Front Print',      250, 'per print', 3),
  ('Print',    'Back Print',       250, 'per print', 4),
  ('Print',    'Small / Pocket Print', 150, 'per print', 5),
  -- Overheads
  ('Overhead', 'Packaging',         50, 'per piece', 1),
  ('Overhead', 'Utilities',         30, 'per piece', 2),
  -- Profit
  ('Profit',   'Default Profit',   350, 'per piece', 1),
  -- Charges (added to the whole order, not per piece)
  ('Charge',   'Order Extra',       90, 'per order', 1),
  ('Charge',   'Advance %',         50, '%',         2);
END
GO

/* ---- Sinhala message templates ---- */
IF NOT EXISTS (SELECT 1 FROM dbo.DtfTemplates)
BEGIN
  INSERT INTO dbo.DtfTemplates (Title, Content, Category, Language, SortOrder) VALUES
  ('Welcome / Greeting',
   N'Ayubowan 🙏 EssenceFit DTF Printing එකට සාදරයෙන් පිළිගනිමු!' + CHAR(13)+CHAR(10) +
   N'ඔයාට කැමති design එකක්, photo එකක්, logo එකක් අපි quality DTF print එකකින් t-shirt එකට දාලා දෙනවා 👕✨' + CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10) +
   N'මොන වගේ item එකක්ද ඔයාට ඕන? (T-Shirt / Oversize / Short / Skinner)',
   'Greeting', 'Sinhala', 1),

  ('Full Price List',
   N'🖨️ *EssenceFit DTF Printing – මිල ගණන්*' + CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10) +
   N'{price_list}' + CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10) +
   N'👉 Design එක WhatsApp කරන්න, මම exact මිල කියන්නම් 😊',
   'Price List', 'Sinhala', 2),

  ('Single Quote',
   N'ඔයාගේ order එකට මිල මෙහෙමයි 👇' + CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10) +
   N'👕 Item: {garment}' + CHAR(13)+CHAR(10) +
   N'🖨️ Print: {print}' + CHAR(13)+CHAR(10) +
   N'🔢 Qty: {qty}' + CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10) +
   N'💰 එක් එකක් Rs {unit_price}' + CHAR(13)+CHAR(10) +
   N'🧾 මුළු මිල: *Rs {total}*' + CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10) +
   N'Order එක confirm කරන්නද? ✅',
   'Quote', 'Sinhala', 3),

  ('Artwork Request',
   N'Print එක clear වෙන්න, මෙහෙම එවන්න 🙏' + CHAR(13)+CHAR(10) +
   N'1️⃣ Design / Photo එක (high quality)' + CHAR(13)+CHAR(10) +
   N'2️⃣ Size එක (M / L / XL / XXL)' + CHAR(13)+CHAR(10) +
   N'3️⃣ Print එක ඕන තැන (Front / Back / both)' + CHAR(13)+CHAR(10) +
   N'4️⃣ Color එක',
   'Order', 'Sinhala', 4),

  ('Order Confirmed',
   N'Order එක confirm උනා ✅ ස්තූතියි! 🙏' + CHAR(13)+CHAR(10) +
   N'Print එක ready වෙන්න දවස් 2-3ක් යනවා. Ready උනාම මම message කරන්නම් 📦',
   'Order', 'Sinhala', 5),

  ('Payment / Bank Details',
   N'Order එක confirm කරන්න advance/full payment එක මෙ account එකට දාන්න 🙏' + CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10) +
   N'🏦 Bank: HNB (Koggala)' + CHAR(13)+CHAR(10) +
   N'👤 M.G.Arosha Ravishan' + CHAR(13)+CHAR(10) +
   N'🔢 237020072483' + CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10) +
   N'📸 Slip එක එවන්න order එක start කරන්න.',
   'Payment', 'Sinhala', 6),

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
END
GO


/* ============================================================
   USEFUL BUSINESS QUERIES
   ============================================================ */

-- A) Current price components grouped by category
-- SELECT Category, Name, Amount, Unit
-- FROM dbo.DtfPriceItems
-- WHERE IsActive = 1
-- ORDER BY Category, SortOrder;

-- B) Selling price for one garment + one print (A3 example)
--    selling = garment + print + packaging + utilities + profit
-- DECLARE @garment NVARCHAR(100) = 'Oversize T-Shirt';
-- DECLARE @print   NVARCHAR(100) = 'A3 Print';
-- SELECT
--   @garment AS Garment,
--   @print   AS Print,
--   (SELECT Amount FROM dbo.DtfPriceItems WHERE Category='Garment'  AND Name=@garment) AS GarmentCost,
--   (SELECT Amount FROM dbo.DtfPriceItems WHERE Category='Print'    AND Name=@print)   AS PrintCost,
--   (SELECT SUM(Amount) FROM dbo.DtfPriceItems WHERE Category='Overhead' AND IsActive=1) AS Overheads,
--   (SELECT TOP 1 Amount FROM dbo.DtfPriceItems WHERE Category='Profit' ORDER BY SortOrder) AS Profit,
--   (SELECT Amount FROM dbo.DtfPriceItems WHERE Category='Garment' AND Name=@garment)
--   + (SELECT Amount FROM dbo.DtfPriceItems WHERE Category='Print' AND Name=@print)
--   + (SELECT ISNULL(SUM(Amount),0) FROM dbo.DtfPriceItems WHERE Category='Overhead' AND IsActive=1)
--   + (SELECT TOP 1 Amount FROM dbo.DtfPriceItems WHERE Category='Profit' ORDER BY SortOrder) AS SellingPrice;

-- C) Auto price list: every garment with a Front Print
-- SELECT g.Name AS Garment,
--        g.Amount AS Blank,
--        p.Amount AS PrintRate,
--        g.Amount + p.Amount
--          + (SELECT ISNULL(SUM(Amount),0) FROM dbo.DtfPriceItems WHERE Category='Overhead' AND IsActive=1)
--          + (SELECT TOP 1 Amount FROM dbo.DtfPriceItems WHERE Category='Profit' ORDER BY SortOrder)
--          AS SellingPrice
-- FROM dbo.DtfPriceItems g
-- CROSS JOIN (SELECT Amount FROM dbo.DtfPriceItems WHERE Category='Print' AND Name='Front Print') p
-- WHERE g.Category='Garment' AND g.IsActive=1
-- ORDER BY g.SortOrder;

-- D) Profit report from saved quotes (per day)
-- SELECT CAST(CreatedAt AS DATE) AS Day,
--        COUNT(*) AS Quotes,
--        SUM(Quantity) AS Pieces,
--        SUM(Profit * Quantity) AS TotalProfit,
--        SUM(Total) AS Revenue
-- FROM dbo.DtfQuotes
-- GROUP BY CAST(CreatedAt AS DATE)
-- ORDER BY Day DESC;

-- E) Best selling garment types (by saved quotes)
-- SELECT GarmentName, COUNT(*) AS Orders, SUM(Quantity) AS Pieces, SUM(Total) AS Revenue
-- FROM dbo.DtfQuotes
-- GROUP BY GarmentName
-- ORDER BY Revenue DESC;

-- F) Update a price (flows into builder + templates automatically)
-- UPDATE dbo.DtfPriceItems
-- SET Amount = 550, UpdatedAt = SYSUTCDATETIME()
-- WHERE Category='Print' AND Name='A3 Print';
