/* Demo seed so the storefront homepage shows Featured & Deals rows.
   Safe/idempotent-ish: only sets flags on existing products. Admin can change
   these any time in Storefront Catalog. Run: node db/apply.mjs db/seed_demo.sql */

-- Feature the two highest-priced active products
;WITH Top2 AS (
  SELECT TOP 2 Id FROM Products WHERE IsActive = 1 ORDER BY SellingPrice DESC
)
UPDATE Products SET IsFeatured = 1 WHERE Id IN (SELECT Id FROM Top2);

-- Put one product on sale (compare-at 25% higher than selling) if none on sale yet
IF NOT EXISTS (SELECT 1 FROM Products WHERE CompareAtPrice IS NOT NULL AND CompareAtPrice > SellingPrice)
BEGIN
  ;WITH OneCheap AS (
    SELECT TOP 1 Id, SellingPrice FROM Products WHERE IsActive = 1 ORDER BY SellingPrice ASC
  )
  UPDATE p SET p.CompareAtPrice = CAST(o.SellingPrice * 1.25 AS DECIMAL(18,2)), p.IsFeatured = 1
  FROM Products p JOIN OneCheap o ON o.Id = p.Id;
END
GO
