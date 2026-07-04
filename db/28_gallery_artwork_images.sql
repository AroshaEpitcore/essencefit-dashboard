/* ============================================================
   28_gallery_artwork_images.sql
   Additive, idempotent migration: allow MULTIPLE customer-artwork
   images per gallery item. GalleryImages rows are tagged with a
   Kind ('final' = delivered-product photo, 'artwork' = customer's
   submitted artwork); the legacy single GalleryItems.ArtworkUrl is
   migrated into the child table and no longer written by the app.
   - No column drops / renames. Safe to run multiple times.
   - NOTE: the runtime DB is PostgreSQL (Supabase); db/pg/schema.sql is
     authoritative. This file exists for MSSQL parity only.
   ============================================================ */

IF COL_LENGTH('GalleryImages', 'Kind') IS NULL
  ALTER TABLE GalleryImages ADD Kind NVARCHAR(20) NOT NULL
    CONSTRAINT DF_GalleryImages_Kind DEFAULT 'final';
GO

INSERT INTO GalleryImages (GalleryItemId, Url, Kind, SortOrder)
SELECT g.Id, g.ArtworkUrl, 'artwork', 0
FROM GalleryItems g
WHERE g.ArtworkUrl IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM GalleryImages gi
    WHERE gi.GalleryItemId = g.Id AND gi.Kind = 'artwork'
  );
GO
