/* ============================================================
   23_customer_reviews.sql
   Additive, idempotent migration: admin-managed customer reviews.
   Each review is assigned to a product (the category is derived from
   Products.CategoryId). ReviewImages holds the optional gallery photos.
   - No column drops / renames. Safe to run multiple times.
   - NOTE: the runtime DB is PostgreSQL (Supabase); db/pg/schema.sql is
     authoritative. This file exists for MSSQL parity only.
   ============================================================ */

IF OBJECT_ID('Reviews', 'U') IS NULL
CREATE TABLE Reviews (
  Id            UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  ProductId     UNIQUEIDENTIFIER NOT NULL,
  CustomerName  NVARCHAR(200) NOT NULL,
  CustomerImage NVARCHAR(1000) NULL,
  Rating        TINYINT NOT NULL CONSTRAINT DF_Reviews_Rating DEFAULT 5,
  Message       NVARCHAR(MAX) NOT NULL,
  IsPublished   BIT NOT NULL CONSTRAINT DF_Reviews_IsPublished DEFAULT 1,
  SortOrder     INT NOT NULL CONSTRAINT DF_Reviews_SortOrder DEFAULT 0,
  CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_Reviews_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('ReviewImages', 'U') IS NULL
CREATE TABLE ReviewImages (
  Id        UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  ReviewId  UNIQUEIDENTIFIER NOT NULL,
  Url       NVARCHAR(1000) NOT NULL,
  SortOrder INT NOT NULL CONSTRAINT DF_ReviewImages_SortOrder DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ReviewImages_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Reviews_ProductId')
  CREATE INDEX IX_Reviews_ProductId ON Reviews (ProductId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReviewImages_ReviewId')
  CREATE INDEX IX_ReviewImages_ReviewId ON ReviewImages (ReviewId);
GO
