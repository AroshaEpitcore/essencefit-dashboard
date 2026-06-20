/* ============================================================
   15_new_arrivals.sql
   Additive, idempotent migration: a "New Arrival" flag on
   Products so the storefront can show a dedicated "New
   Collection" slider after the hero banner.
   - No column drops / renames.  Safe to run multiple times.
   ============================================================ */

IF COL_LENGTH('Products', 'IsNewArrival') IS NULL
  ALTER TABLE Products ADD IsNewArrival BIT NOT NULL
        CONSTRAINT DF_Products_IsNewArrival DEFAULT 0;
GO
