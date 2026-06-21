/* ============================================================
   18_shared_stock.sql
   Shared "blank" stock across products + per-product DTF profit
   + print-on-demand flag, and a resolver function that maps any
   variant to the variant that actually holds its stock.
   Additive, idempotent. Safe to re-run.
   ============================================================ */

IF COL_LENGTH('Products','BlankProductId') IS NULL
  ALTER TABLE Products ADD BlankProductId UNIQUEIDENTIFIER NULL;
GO
IF COL_LENGTH('Products','DtfProfit') IS NULL
  ALTER TABLE Products ADD DtfProfit DECIMAL(10,2) NULL;
GO
IF COL_LENGTH('Products','PrintOnDemand') IS NULL
  ALTER TABLE Products ADD PrintOnDemand BIT NOT NULL
        CONSTRAINT DF_Products_PrintOnDemand DEFAULT 0;
GO

/* Resolve a variant to the variant that actually holds its stock:
   - if the variant's product is linked to a blank, the blank's variant
     matching the same Size+Colour;
   - otherwise the variant itself. */
CREATE OR ALTER FUNCTION dbo.fn_StockVariantId(@VariantId UNIQUEIDENTIFIER)
RETURNS UNIQUEIDENTIFIER AS
BEGIN
  DECLARE @Res UNIQUEIDENTIFIER = @VariantId,
          @Blank UNIQUEIDENTIFIER, @Size UNIQUEIDENTIFIER, @Color UNIQUEIDENTIFIER;
  SELECT @Blank = p.BlankProductId, @Size = v.SizeId, @Color = v.ColorId
  FROM ProductVariants v JOIN Products p ON p.Id = v.ProductId
  WHERE v.Id = @VariantId;
  IF @Blank IS NOT NULL
  BEGIN
    SELECT TOP 1 @Res = b.Id FROM ProductVariants b
    WHERE b.ProductId = @Blank
      AND ISNULL(CONVERT(NVARCHAR(36), b.SizeId), '') = ISNULL(CONVERT(NVARCHAR(36), @Size), '')
      AND ISNULL(CONVERT(NVARCHAR(36), b.ColorId), '') = ISNULL(CONVERT(NVARCHAR(36), @Color), '');
    IF @Res IS NULL SET @Res = @VariantId;
  END
  RETURN @Res;
END
GO
