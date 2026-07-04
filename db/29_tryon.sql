-- 29: Virtual try-on usage log — parity doc only (live DB is Postgres; the
-- executed version lives in db/pg/schema.sql). One row per generation attempt,
-- used only for per-IP / global daily caps. No customer photo is ever stored.
IF OBJECT_ID('dbo.TryOnUsage', 'U') IS NULL
CREATE TABLE dbo.TryOnUsage (
  Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  Ip NVARCHAR(100) NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TryOnUsage_CreatedAt')
CREATE INDEX IX_TryOnUsage_CreatedAt ON dbo.TryOnUsage (CreatedAt);
GO
