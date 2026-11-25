import { generateReply } from "@/lib/waGemini";
import { getConvo, saveConvo, type WaConvo } from "@/lib/waConvo";
import { getStockBySize, getCatalogSummary, type CatalogItem } from "@/lib/waStock";
import {
  parseSize,
  parseImageTags,
  formatStockReply,
  WA_IMAGE_PATHS,
  type ProductStock,
} from "@/lib/waReply";

/*
 * The WhatsApp bot "brain" (Phase 2b). Given an inbound message it:
 *   1. loads the customer's conversation memory (ad product, honorific, history),
 *   2. grounds the AI with the live catalog + real stock for any size mentioned,
 *   3. asks Gemini for a reply (Singlish-aware, honorific-aware, product-scoped),
 *   4. extracts any [[IMG:…]] tags into images to attach,
 *   5. saves the updated memory.
 * Returns null if the AI is unavailable so the webhook can fall back to the
 * deterministic 2a stock reply (bot never goes silent).
 */

const BASE_URL = process.env.WA_PUBLIC_BASE_URL || "https://essencefit.lk";

export type AgentInput = {
  waId: string;
  text: string;
  profileName?: string | null;
  referral?: WaReferral | null;
};
export type AgentResult = { text: string; images: string[] };

export async function runAgent(input: AgentInput): Promise<AgentResult | null> {
  const convo = await getConvo(input.waId);

  // Merge anything new from this message.
  if (input.profileName && !convo.profileName) convo.profileName = input.profileName;
  const productFromAd = input.referral ? guessProduct(input.referral) : null;

  // Ground the AI with real data.
  const catalog = await getCatalogSummary();
  const resolvedProduct = convo.productName || (productFromAd && matchCatalog(productFromAd, catalog));
  if (resolvedProduct && !convo.productName) convo.productName = resolvedProduct;

  const size = parseSize(input.text);
  let sizeStock: ProductStock[] | null = null;
  if (size) {
    try {
      sizeStock = await getStockBySize(size);
    } catch (err) {
      console.error("[wa/agent] stock lookup failed:", err);
    }
  }

  const system = buildSystemPrompt(convo, catalog, input.referral ?? null, size, sizeStock);
  const raw = await generateReply(system, convo.history, input.text);
  if (!raw) return null; // AI unavailable → caller falls back to 2a

  const { text, imageKeys } = parseImageTags(raw);
  const images = imageKeys.map((k) => `${BASE_URL}${WA_IMAGE_PATHS[k]}`);

  // Persist memory (append this exchange).
  convo.history = [
    ...convo.history,
    { role: "user", text: input.text },
    { role: "model", text },
  ];
  try {
    await saveConvo(convo, input.referral ?? undefined);
  } catch (err) {
    console.error("[wa/agent] saveConvo failed:", err);
  }

  return { text: text || "🙏", images };
}

/* ---- Prompt construction ---- */

function buildSystemPrompt(
  convo: WaConvo,
  catalog: CatalogItem[],
  referral: WaReferral | null,
  size: string | null,
  sizeStock: ProductStock[] | null
): string {
  const catalogLines = catalog
    .map((c) => `- ${c.product} (${c.category}) — sizes: ${c.sizes}`)
    .join("\n");

  const stockBlock =
    size && sizeStock
      ? `\nLIVE STOCK for size "${size}" (use ONLY these numbers, never invent):\n` +
        (sizeStock.length
          ? sizeStock
              .map(
                (p) =>
                  `- ${p.product}: ` +
                  p.colors.map((c) => `${c.name} (${c.qty})`).join(", ")
              )
              .join("\n")
          : `(nothing in stock for size ${size})`)
      : "";

  const productCtx = convo.productName
    ? `The customer came from an ad for: "${convo.productName}". When they ask about a size/colour, answer for THIS product first. If they ask about other options, offer the other products below.`
    : referral
    ? `The customer arrived from a Meta ad (headline: "${referral.headline ?? ""}"). Infer which product below it matches; if unsure, ask them which item they're interested in.`
    : `You don't yet know which product the customer wants. If they send a size, ask which item they mean (list a few options) unless it's obvious.`;

  const nameCtx = convo.profileName
    ? `The customer's WhatsApp name is "${convo.profileName}".`
    : `You don't know the customer's name.`;

  return `You are the EssenceFit WhatsApp shop assistant for a Sri Lankan clothing store. You reply to real customers on WhatsApp.

STYLE:
- Match the customer's language. Most write "Singlish" (romanized Sinhala mixed with English) — reply the same friendly way. Keep it short, warm, emoji-light.
- HONORIFIC: address the customer as "sir" if they appear to be a man, "miss" if a woman, and "dear" if you are NOT sure. ${nameCtx} Default to "dear" whenever unsure — never guess wrongly.

PRODUCT CONTEXT:
${productCtx}

RULES:
- Only state stock/sizes/colours from the LIVE data given below. Never invent availability. If you don't have the number, say you'll check.
- Each short is around Rs. 1,500 (Corduroy) / Rs. 990 (Dry-Fit) — only quote price if asked; don't overwhelm.
- Offer: buy any 3 items = FREE delivery.
- To show the size chart add the tag [[IMG:size-chart]] on its own line; to show the colour options add [[IMG:colours]]. Use them when the customer asks about sizes/fit or colours, or when offering other products. Only these two image tags exist.
- When the customer is ready, collect: full name, address, phone. Do NOT confirm an order yet (ordering comes later) — tell them a team member will finalise it.

IN-STOCK PRODUCTS:
${catalogLines}
${stockBlock}`;
}

/* ---- Ad referral → product guessing (best-effort, no AI) ---- */

export type WaReferral = {
  source_id?: string;
  source_url?: string;
  headline?: string;
  body?: string;
  ctwa_clid?: string;
};

/** Pulls a product-ish string out of the ad referral (headline/body/url). */
function guessProduct(ref: WaReferral): string | null {
  return ref.headline || ref.body || ref.source_url || null;
}

/** Matches referral text against known catalog product names (case-insensitive). */
function matchCatalog(text: string, catalog: CatalogItem[]): string | null {
  const hay = text.toLowerCase();
  // Longest product name first, so "Ck Sport short" beats a bare "short".
  const byLen = [...catalog].sort((a, b) => b.product.length - a.product.length);
  for (const c of byLen) {
    if (hay.includes(c.product.toLowerCase())) return c.product;
  }
  return null;
}
