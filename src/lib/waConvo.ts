import { getDb } from "@/lib/db";
import type { ChatTurn } from "@/lib/waGemini";

/*
 * Per-customer conversation memory for the WhatsApp bot (Phase 2b), backed by
 * the wa_conversations table. Lets the bot remember the ad's product, the
 * honorific, and recent chat across stateless webhook calls.
 */

export type WaConvo = {
  waId: string;
  profileName: string | null;
  honorific: string | null;
  productName: string | null;
  history: ChatTurn[];
};

const HISTORY_MAX = 12; // keep the last N turns to bound the prompt

export async function getConvo(waId: string): Promise<WaConvo> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("waId", waId)
    .query(`
      SELECT wa_id, profile_name, honorific, product_name, history
      FROM wa_conversations
      WHERE wa_id = @waId
    `);
  const row = (res.recordset ?? [])[0];
  if (!row) {
    return { waId, profileName: null, honorific: null, productName: null, history: [] };
  }
  return {
    waId,
    profileName: row.profile_name ?? null,
    honorific: row.honorific ?? null,
    productName: row.product_name ?? null,
    history: normalizeHistory(row.history),
  };
}

/** Upsert the conversation, trimming history to the last HISTORY_MAX turns. */
export async function saveConvo(convo: WaConvo, referral?: unknown): Promise<void> {
  const history = convo.history.slice(-HISTORY_MAX);
  const pool = await getDb();
  await pool
    .request()
    .input("waId", convo.waId)
    .input("profileName", convo.profileName)
    .input("honorific", convo.honorific)
    .input("productName", convo.productName)
    .input("referral", referral ? JSON.stringify(referral) : null)
    .input("history", JSON.stringify(history))
    .query(`
      INSERT INTO wa_conversations
        (wa_id, profile_name, honorific, product_name, referral, history, updated_at)
      VALUES
        (@waId, @profileName, @honorific, @productName, @referral::jsonb, @history::jsonb, now())
      ON CONFLICT (wa_id) DO UPDATE SET
        profile_name = COALESCE(EXCLUDED.profile_name, wa_conversations.profile_name),
        honorific    = COALESCE(EXCLUDED.honorific, wa_conversations.honorific),
        product_name = COALESCE(EXCLUDED.product_name, wa_conversations.product_name),
        referral     = COALESCE(EXCLUDED.referral, wa_conversations.referral),
        history      = EXCLUDED.history,
        updated_at   = now()
    `);
}

function normalizeHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (t): t is ChatTurn =>
        !!t &&
        (t.role === "user" || t.role === "model") &&
        typeof t.text === "string"
    )
    .slice(-HISTORY_MAX);
}
