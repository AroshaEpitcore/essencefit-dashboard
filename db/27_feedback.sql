/* ============================================================
   27_feedback.sql
   Additive, idempotent migration: admin-managed customer feedback wall.
   Each FeedbackItem is one customer-feedback screenshot (WhatsApp chat
   etc.) with an optional customer name. Screenshot-first: no product
   link, rating, or message.
   - No column drops / renames. Safe to run multiple times.
   - NOTE: the runtime DB is PostgreSQL (Supabase); db/pg/schema.sql is
     authoritative. This file exists for MSSQL parity only.
   ============================================================ */

IF OBJECT_ID('FeedbackItems', 'U') IS NULL
CREATE TABLE FeedbackItems (
  Id           UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  CustomerName NVARCHAR(200) NULL,
  ImageUrl     NVARCHAR(1000) NOT NULL,
  IsPublished  BIT NOT NULL CONSTRAINT DF_FeedbackItems_IsPublished DEFAULT 1,
  SortOrder    INT NOT NULL CONSTRAINT DF_FeedbackItems_SortOrder DEFAULT 0,
  CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_FeedbackItems_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO
