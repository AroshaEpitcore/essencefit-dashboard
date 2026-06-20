/* ============================================================
   13_color_images.sql
   Adds colour hex + per-colour product images. Additive & idempotent.
   - Colors.Hex            : optional admin override swatch colour
   - ProductImages.ColorId : NULL = shared / applies to all colours
   ============================================================ */

IF COL_LENGTH('Colors', 'Hex') IS NULL
  ALTER TABLE Colors ADD Hex NVARCHAR(20) NULL;            -- e.g. '#1B1B3A'

IF COL_LENGTH('ProductImages', 'ColorId') IS NULL
  ALTER TABLE ProductImages ADD ColorId UNIQUEIDENTIFIER NULL;  -- NULL = all colours
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProductImages_Product_Color')
  CREATE INDEX IX_ProductImages_Product_Color ON ProductImages(ProductId, ColorId);
GO

/* ---------- Backfill Hex from common colour names (only where NULL) ---------- */
UPDATE Colors SET Hex = CASE LOWER(LTRIM(RTRIM(Name)))
  WHEN 'black'   THEN '#111111'
  WHEN 'white'   THEN '#FFFFFF'
  WHEN 'red'     THEN '#E11D48'
  WHEN 'maroon'  THEN '#7F1D1D'
  WHEN 'pink'    THEN '#EC4899'
  WHEN 'rose'    THEN '#F43F5E'
  WHEN 'orange'  THEN '#F97316'
  WHEN 'yellow'  THEN '#EAB308'
  WHEN 'mustard' THEN '#D4A017'
  WHEN 'gold'    THEN '#D4AF37'
  WHEN 'green'   THEN '#16A34A'
  WHEN 'olive'   THEN '#6B7330'
  WHEN 'teal'    THEN '#14B8A6'
  WHEN 'cyan'    THEN '#06B6D4'
  WHEN 'blue'    THEN '#2563EB'
  WHEN 'navy'    THEN '#1E2A52'
  WHEN 'royal'   THEN '#1D4ED8'
  WHEN 'sky'     THEN '#38BDF8'
  WHEN 'purple'  THEN '#7C3AED'
  WHEN 'violet'  THEN '#8B5CF6'
  WHEN 'brown'   THEN '#7C4A2D'
  WHEN 'beige'   THEN '#E3D5B8'
  WHEN 'cream'   THEN '#F5EFE0'
  WHEN 'tan'     THEN '#D2B48C'
  WHEN 'khaki'   THEN '#B6A66A'
  WHEN 'grey'    THEN '#6B7280'
  WHEN 'gray'    THEN '#6B7280'
  WHEN 'silver'  THEN '#C0C5CE'
  WHEN 'charcoal' THEN '#36393F'
  WHEN 'ash'     THEN '#9AA0A6'
  ELSE Hex
END
WHERE Hex IS NULL;
GO
