/* ============================================================
   12_ecommerce.sql
   Additive, idempotent migration that turns the admin catalog
   into a storefront-capable catalog.
   - No column drops / renames.
   - Safe to run multiple times.
   - DB name / connection unchanged (InvFin).
   ============================================================ */

/* ---------- Products: storefront fields ---------- */
IF COL_LENGTH('Products', 'Slug') IS NULL
  ALTER TABLE Products ADD Slug NVARCHAR(250) NULL;

IF COL_LENGTH('Products', 'Description') IS NULL
  ALTER TABLE Products ADD Description NVARCHAR(MAX) NULL;

IF COL_LENGTH('Products', 'ImageUrl') IS NULL
  ALTER TABLE Products ADD ImageUrl NVARCHAR(500) NULL;          -- primary / thumbnail

IF COL_LENGTH('Products', 'CompareAtPrice') IS NULL
  ALTER TABLE Products ADD CompareAtPrice DECIMAL(18,2) NULL;    -- "cut" / original price

IF COL_LENGTH('Products', 'IsActive') IS NULL
  ALTER TABLE Products ADD IsActive BIT NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT 1;

IF COL_LENGTH('Products', 'IsFeatured') IS NULL
  ALTER TABLE Products ADD IsFeatured BIT NOT NULL CONSTRAINT DF_Products_IsFeatured DEFAULT 0;

IF COL_LENGTH('Products', 'SortOrder') IS NULL
  ALTER TABLE Products ADD SortOrder INT NOT NULL CONSTRAINT DF_Products_SortOrder DEFAULT 0;
GO

/* ---------- Product image gallery ---------- */
IF OBJECT_ID('ProductImages', 'U') IS NULL
BEGIN
  CREATE TABLE ProductImages (
    Id        uniqueidentifier NOT NULL CONSTRAINT DF_ProductImages_Id DEFAULT NEWID()
                                          CONSTRAINT PK_ProductImages PRIMARY KEY,
    ProductId uniqueidentifier NOT NULL,
    Url       NVARCHAR(500)    NOT NULL,
    SortOrder INT              NOT NULL CONSTRAINT DF_ProductImages_SortOrder DEFAULT 0,
    CreatedAt datetime2        NOT NULL CONSTRAINT DF_ProductImages_CreatedAt DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_ProductImages_ProductId ON ProductImages(ProductId);
END
GO

/* ---------- Categories: storefront fields ---------- */
IF COL_LENGTH('Categories', 'Slug') IS NULL
  ALTER TABLE Categories ADD Slug NVARCHAR(150) NULL;

IF COL_LENGTH('Categories', 'ImageUrl') IS NULL
  ALTER TABLE Categories ADD ImageUrl NVARCHAR(500) NULL;

IF COL_LENGTH('Categories', 'Description') IS NULL
  ALTER TABLE Categories ADD Description NVARCHAR(500) NULL;

IF COL_LENGTH('Categories', 'IsActive') IS NULL
  ALTER TABLE Categories ADD IsActive BIT NOT NULL CONSTRAINT DF_Categories_IsActive DEFAULT 1;

IF COL_LENGTH('Categories', 'SortOrder') IS NULL
  ALTER TABLE Categories ADD SortOrder INT NOT NULL CONSTRAINT DF_Categories_SortOrder DEFAULT 0;
GO

/* ---------- Customers: optional accounts (guests keep these NULL) ---------- */
IF COL_LENGTH('Customers', 'Email') IS NULL
  ALTER TABLE Customers ADD Email NVARCHAR(200) NULL;

IF COL_LENGTH('Customers', 'PasswordHash') IS NULL
  ALTER TABLE Customers ADD PasswordHash NVARCHAR(200) NULL;
GO

/* ---------- Orders: web-order + payment fields ---------- */
IF COL_LENGTH('Orders', 'Source') IS NULL
  ALTER TABLE Orders ADD Source NVARCHAR(20) NULL;              -- 'web' | NULL (admin)

IF COL_LENGTH('Orders', 'CustomerEmail') IS NULL
  ALTER TABLE Orders ADD CustomerEmail NVARCHAR(200) NULL;

IF COL_LENGTH('Orders', 'PaymentMethod') IS NULL
  ALTER TABLE Orders ADD PaymentMethod NVARCHAR(30) NULL;       -- 'COD' | 'BankTransfer'

IF COL_LENGTH('Orders', 'PaymentSlipUrl') IS NULL
  ALTER TABLE Orders ADD PaymentSlipUrl NVARCHAR(500) NULL;

IF COL_LENGTH('Orders', 'PaymentVerified') IS NULL
  ALTER TABLE Orders ADD PaymentVerified BIT NOT NULL CONSTRAINT DF_Orders_PaymentVerified DEFAULT 0;
GO

/* ---------- Backfill: slugs + active flag for existing rows ---------- */

-- Product slugs from Name (lowercase, spaces -> '-', strip non-alphanumerics),
-- suffixed with a short id fragment to guarantee uniqueness.
UPDATE Products
SET Slug = LOWER(
      LEFT(
        REPLACE(
          REPLACE(
            REPLACE(LTRIM(RTRIM(Name)), '  ', ' '),
          ' ', '-'),
        '/', '-')
      , 60)
    ) + '-' + LEFT(CONVERT(NVARCHAR(36), Id), 8)
WHERE Slug IS NULL;

UPDATE Categories
SET Slug = LOWER(
      REPLACE(LTRIM(RTRIM(Name)), ' ', '-')
    ) + '-' + LEFT(CONVERT(NVARCHAR(36), Id), 8)
WHERE Slug IS NULL;
GO
