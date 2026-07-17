-- Rate limiting (plan: workflow/plans/2026-07-05-storefront-admin-gap-analysis.md, Phase 5)
-- Serverless-safe attempt counter: Vercel instances share no memory, so the
-- window lives in Postgres (stands in for Redis at this traffic level).
-- Idempotent. Also mirrored in db/pg/schema.sql.

CREATE TABLE IF NOT EXISTS auth_attempts (
  key          text PRIMARY KEY,          -- e.g. 'clogin:0771234567' or 'alogin-ip:1.2.3.4'
  count        int  NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);
