/* ---------- Products: per-product size chart image ----------
   An uploaded size-chart image shown on the storefront product page (opens in a
   modal). NULL = no chart for that product. */

IF COL_LENGTH('Products', 'SizeChartUrl') IS NULL
  ALTER TABLE Products ADD SizeChartUrl NVARCHAR(500) NULL;
GO
