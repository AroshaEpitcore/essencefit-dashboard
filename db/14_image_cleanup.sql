/* ============================================================
   14_image_cleanup.sql
   "No general images" — remove legacy null-colour (general) images from any
   product that now has per-colour images, then recompute each product's primary
   thumbnail to its first remaining image. Idempotent.
   ============================================================ */

-- 1) Drop general (ColorId NULL) images for products that have per-colour images.
DELETE pi
FROM ProductImages pi
WHERE pi.ColorId IS NULL
  AND EXISTS (
    SELECT 1 FROM ProductImages x
    WHERE x.ProductId = pi.ProductId AND x.ColorId IS NOT NULL
  );
GO

-- 2) Recompute primary thumbnail = first remaining image by SortOrder (NULL if none).
UPDATE p
SET p.ImageUrl = (
  SELECT TOP 1 pi.Url FROM ProductImages pi
  WHERE pi.ProductId = p.Id ORDER BY pi.SortOrder
)
FROM Products p;
GO
