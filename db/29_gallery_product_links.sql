/* ============================================================
   29_gallery_product_links.sql
   Additive, idempotent migration: link custom-orders gallery items
   to storefront products (many-to-many). An assigned item surfaces
   on that product's PDP; unassigned pages fall back to all items.
   - No column drops / renames. Safe to run multiple times.
   - NOTE: the runtime DB is PostgreSQL (Supabase); db/pg/schema.sql is
     authoritative. This file exists for MSSQL parity only.
   ============================================================ */

IF OBJECT_ID('GalleryItemProducts', 'U') IS NULL
CREATE TABLE GalleryItemProducts (
  GalleryItemId UNIQUEIDENTIFIER NOT NULL,
  ProductId     UNIQUEIDENTIFIER NOT NULL,
  CONSTRAINT PK_GalleryItemProducts PRIMARY KEY (GalleryItemId, ProductId)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_GalleryItemProducts_ProductId')
  CREATE INDEX IX_GalleryItemProducts_ProductId ON GalleryItemProducts (ProductId);
GO
