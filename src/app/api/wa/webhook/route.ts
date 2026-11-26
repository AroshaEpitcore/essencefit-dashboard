import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getStockBySize } from "@/lib/waStock";
import { parseSize, formatStockReply } from "@/lib/waReply";
import { runAgent, type WaReferral } from "@/lib/waAgent";

/* WhatsApp Cloud API webhook (Phase 1).
 *
 * GET  — Meta's one-time verification handshake. When you set the Callback URL
 *        in the app's WhatsApp → Configuration page, Meta calls this with
 *        ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=… — we echo the
 *        challenge back only if the token matches WHATSAPP_VERIFY_TOKEN.
 *
 * POST — every inbound message (and delivery status) lands here. For now we
 *        reply to text messages with a simple canned greeting to prove the loop
 *        end-to-end. Later phases swap this for the Claude + live-stock logic.
 *
 * Env vars (set these in Vercel → Project → Settings → Environment Variables):
 *   WHATSAPP_VERIFY_TOKEN     — any secret string you invent; paste the SAME
 *                               value into Meta's "Verify token" box.
 *   WHATSAPP_TOKEN            — the access token from the API Setup page.
 *   WHATSAPP_PHONE_NUMBER_ID  — the Phone Number ID (test: 1396464750225919).
 *   WHATSAPP_APP_SECRET       — (optional) the app secret, to verify Meta's
 *                               signature. If unset, signature check is skipped.
 *   WHATSAPP_GRAPH_VERSION    — (optional) Graph API version, defaults to v21.0.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

/* ---- GET: verification handshake ---- */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    // Meta expects the raw challenge back as plain text, status 200.
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/* ---- POST: incoming messages + statuses ---- */
export async function POST(req: NextRequest) {
  // Read the RAW body first — signature verification needs the exact bytes.
  const raw = await req.text();

  if (!verifySignature(req, raw)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  // Always return 200 quickly so Meta doesn't retry. Do the work, but never
  // let an error bubble into a non-200 (that would make Meta resend the event).
  try {
    const body = JSON.parse(raw) as WaWebhookBody;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        // Delivery/read statuses arrive with `statuses`, not `messages` — ignore.
        // The sender's WhatsApp display name travels alongside the message, in
        // value.contacts — used to guess the honorific (sir/miss/dear).
        const profileName = value?.contacts?.[0]?.profile?.name ?? null;
        for (const msg of value?.messages ?? []) {
          // Meta re-delivers a webhook if it doesn't get a prompt 200 (and
          // occasionally even when it does). Each delivery carries the same
          // message id, so skip ones we've already handled to avoid double
          // replies. Best-effort (per warm instance); see note on seen set.
          if (msg.id && alreadySeen(msg.id)) continue;
          await handleInboundMessage(msg, profileName);
        }
      }
    }
  } catch (err) {
    // Log for debugging in Vercel; still ack with 200.
    console.error("[wa/webhook] error:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true });
}

/* ---- Phase 2b logic: AI reply, with the 2a stock reply as a safety net ---- */
async function handleInboundMessage(
  msg: WaMessage,
  profileName: string | null
): Promise<void> {
  const from = msg.from; // customer's wa_id (phone)
  if (!from) return;

  // Blue-tick the customer's message so they know it was received (standard UX).
  if (msg.id) void markRead(msg.id);

  if (msg.type === "text" && msg.text?.body) {
    const text = msg.text.body;

    // 1) Try the AI brain (Gemini) — product-scoped, Singlish, honorifics, images.
    try {
      const result = await runAgent({
        waId: from,
        text,
        profileName,
        referral: msg.referral ?? null,
      });
      if (result) {
        for (const link of result.images) await sendImage(from, link);
        if (result.text) await sendText(from, result.text);
        return;
      }
    } catch (err) {
      console.error("[wa/webhook] agent failed, falling back:", err);
    }

    // 2) Fallback (AI unavailable): deterministic 2a behaviour.
    const size = parseSize(text);
    if (size) {
      await sendText(from, await buildStockReply(size));
      return;
    }
    // AI momentarily unavailable and not a bare size — a brief neutral line is
    // far less confusing than re-sending the full welcome mid-conversation.
    await sendText(from, "Poddak inna dear 🙏 podi delay ekak. Ayemath ekpaarak evannada?");
    return;
  }

  // Non-text (image, button, etc.) — acknowledge for now.
  await sendText(
    from,
    "Thanks! 🙏 We received your message. A team member will assist you shortly."
  );
}

/** Fetches live stock for a size and formats the reply (graceful on DB error). */
async function buildStockReply(size: string): Promise<string> {
  try {
    const stock = await getStockBySize(size);
    return formatStockReply(size, stock);
  } catch (err) {
    console.error("[wa/webhook] getStockBySize failed:", err);
    return (
      `Size ${size} ගැන බලන්න පොඩි issue එකක් 🙏 ` +
      `පොඩ්ඩක් ඉඳලා ආයෙ try කරන්න, නැත්නම් අපි manually බලලා කියන්නම්.`
    );
  }
}

/* ---- Send a plain text message back via the Graph API ---- */
async function sendText(to: string, bodyText: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.error("[wa/webhook] missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
    return;
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: bodyText },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[wa/webhook] send failed ${res.status}: ${detail}`);
  }
}

/* ---- Send an image by public URL (size chart / colours) ---- */
async function sendImage(to: string, link: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "image",
          image: { link },
        }),
      }
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[wa/webhook] image send failed ${res.status}: ${detail}`);
    }
  } catch (err) {
    console.error("[wa/webhook] image send error:", err);
  }
}

/* ---- Optional signature verification (Meta signs POST bodies) ---- */
function verifySignature(req: NextRequest, raw: string): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true; // not configured yet — skip during initial testing

  const header = req.headers.get("x-hub-signature-256") || "";
  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
  // Constant-time compare; lengths must match or timingSafeEqual throws.
  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

/* ---- Mark an inbound message as read (blue ticks) ---- */
async function markRead(messageId: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return;

  try {
    await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
      }
    );
  } catch (err) {
    // Non-critical — never block the reply on a read receipt.
    console.error("[wa/webhook] markRead failed:", err);
  }
}

/* ---- Best-effort webhook de-duplication ----
 * Meta may deliver the same message id more than once. We remember recently
 * seen ids in-process to drop duplicates. This survives only within a warm
 * serverless instance (Fluid Compute reuses instances, so it catches the common
 * rapid-retry case); a cold start forgets. For hard idempotency across instances,
 * promote this to a DB/Redis check keyed on message id — tracked for Phase 2b. */
const SEEN_MAX = 500;
const seen = new Set<string>();
function alreadySeen(id: string): boolean {
  if (seen.has(id)) return true;
  seen.add(id);
  if (seen.size > SEEN_MAX) {
    // Drop the oldest entry (insertion order) to cap memory.
    const oldest = seen.values().next().value;
    if (oldest !== undefined) seen.delete(oldest);
  }
  return false;
}

/* ---- Minimal payload types (only the fields we read) ---- */
type WaMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  // Present on the first message when the customer tapped a Click-to-WhatsApp ad.
  referral?: WaReferral;
};
type WaContact = { profile?: { name?: string }; wa_id?: string };
type WaWebhookBody = {
  entry?: {
    changes?: {
      value?: { messages?: WaMessage[]; contacts?: WaContact[] };
    }[];
  }[];
};
