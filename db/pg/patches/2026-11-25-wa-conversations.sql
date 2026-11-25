-- WhatsApp bot conversation memory (Phase 2b).
-- One row per customer wa_id: remembers the ad's product, the guessed
-- honorific, the profile name, and a short rolling chat history so the AI
-- (Gemini) has context across messages. Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS wa_conversations (
  wa_id        text PRIMARY KEY,                 -- customer phone / wa_id
  profile_name text,                             -- WhatsApp display name (for honorific)
  honorific    text,                             -- 'sir' | 'miss' | 'dear'
  product_name text,                             -- product context (from the ad referral)
  referral     jsonb,                            -- raw Click-to-WhatsApp ad referral, if any
  history      jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{role:'user'|'model', text}]
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
