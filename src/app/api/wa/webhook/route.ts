import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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
        for (const msg of value?.messages ?? []) {
          await handleInboundMessage(msg);
        }
      }
    }
  } catch (err) {
    // Log for debugging in Vercel; still ack with 200.
    console.error("[wa/webhook] error:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true });
}

/* ---- Phase 1 logic: reply to a text message ---- */
async function handleInboundMessage(msg: WaMessage): Promise<void> {
  const from = msg.from; // customer's wa_id (phone)
  if (!from) return;

  if (msg.type === "text" && msg.text?.body) {
    // Minimal proof-of-life reply. Phase 2 replaces this with Claude + live stock.
    const reply =
      "Thank you for choosing EssenceFit 🙌\n" +
      "(This is an automated test reply — the bot is now live on this number.)\n\n" +
      `You said: "${msg.text.body}"`;
    await sendText(from, reply);
    return;
  }

  // Non-text (image, button, etc.) — acknowledge for now.
  await sendText(
    from,
    "Thanks! 🙏 We received your message. A team member will assist you shortly."
  );
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

/* ---- Minimal payload types (only the fields we read) ---- */
type WaMessage = {
  from?: string;
  type?: string;
  text?: { body?: string };
};
type WaWebhookBody = {
  entry?: {
    changes?: {
      value?: { messages?: WaMessage[] };
    }[];
  }[];
};
