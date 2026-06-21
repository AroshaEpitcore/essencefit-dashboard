/* ---------- Design-per-image products ----------
   SelectByImage marks a product whose images are distinct designs the customer
   picks (instead of colour/size). Each design is a ProductVariants row linked to
   its image via ProductImages.VariantId. */

IF COL_LENGTH('Products', 'SelectByImage') IS NULL
  ALTER TABLE Products ADD SelectByImage BIT NOT NULL CONSTRAINT DF_Products_SelectByImage DEFAULT 0;
GO

IF COL_LENGTH('ProductImages', 'VariantId') IS NULL
  ALTER TABLE ProductImages ADD VariantId UNIQUEIDENTIFIER NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProductImages_VariantId')
  CREATE INDEX IX_ProductImages_VariantId ON ProductImages(VariantId);
GO
