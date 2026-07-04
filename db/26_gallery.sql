/* ============================================================
   26_gallery.sql
   Additive, idempotent migration: admin-managed custom-orders gallery.
   Each GalleryItem records a customer's order: the artwork the customer
   submitted (ArtworkUrl) and photos of the delivered product in the
   GalleryImages child table. Featured items surface first on the home page.
   - No column drops / renames. Safe to run multiple times.
   - NOTE: the runtime DB is PostgreSQL (Supabase); db/pg/schema.sql is
     authoritative. This file exists for MSSQL parity only.
   ============================================================ */

IF OBJECT_ID('GalleryItems', 'U') IS NULL
CREATE TABLE GalleryItems (
  Id           UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  CustomerName NVARCHAR(200) NOT NULL,
  ArtworkUrl   NVARCHAR(1000) NULL,
  Caption      NVARCHAR(MAX) NULL,
  IsFeatured   BIT NOT NULL CONSTRAINT DF_GalleryItems_IsFeatured DEFAULT 0,
  IsPublished  BIT NOT NULL CONSTRAINT DF_GalleryItems_IsPublished DEFAULT 1,
  SortOrder    INT NOT NULL CONSTRAINT DF_GalleryItems_SortOrder DEFAULT 0,
  CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_GalleryItems_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('GalleryImages', 'U') IS NULL
CREATE TABLE GalleryImages (
  Id            UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  GalleryItemId UNIQUEIDENTIFIER NOT NULL,
  Url           NVARCHAR(1000) NOT NULL,
  SortOrder     INT NOT NULL CONSTRAINT DF_GalleryImages_SortOrder DEFAULT 0,
  CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_GalleryImages_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_GalleryImages_GalleryItemId')
  CREATE INDEX IX_GalleryImages_GalleryItemId ON GalleryImages (GalleryItemId);
GO
