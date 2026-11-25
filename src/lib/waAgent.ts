import { generateReply } from "@/lib/waAi";
import { getConvo, saveConvo, type WaConvo } from "@/lib/waConvo";
import {
  getStockBySize,
  getCatalogSummary,
  getProductStockText,
  type CatalogItem,
} from "@/lib/waStock";
import {
  parseSize,
  parseImageTags,
  detectImageRequest,
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

  // Always load the resolved product's full live stock so the AI has real
  // numbers every turn and never walks back figures it already gave.
  let productStock = "";
  if (convo.productName) {
    try {
      productStock = await getProductStockText(convo.productName);
    } catch (err) {
      console.error("[wa/agent] product stock lookup failed:", err);
    }
  }

  const system = buildSystemPrompt(convo, catalog, input.referral ?? null, size, sizeStock, productStock);
  const raw = await generateReply(system, convo.history, input.text);
  if (!raw) return null; // AI unavailable → caller falls back to 2a

  const { text, imageKeys } = parseImageTags(raw);
  // Union the AI's requested images with a deterministic keyword match, so a
  // chart/colours request still attaches the image if the AI omits the tag.
  const allKeys = [...new Set([...imageKeys, ...detectImageRequest(input.text)])];
  const images = allKeys.map((k) => `${BASE_URL}${WA_IMAGE_PATHS[k]}`);

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
  sizeStock: ProductStock[] | null,
  productStock: string
): string {
  const catalogLines = catalog
    .map((c) => `- ${c.product} (${c.category}) — sizes: ${c.sizes}`)
    .join("\n");

  // The resolved product's full live stock — present every turn once we know
  // the product, so the AI always has real numbers.
  const productBlock =
    convo.productName && productStock
      ? `\nLIVE STOCK for ${convo.productName} (size: colour(qty) — these are current and correct):\n${productStock}`
      : "";

  // Cross-product stock for a size the customer just asked about.
  const sizeBlock =
    size && sizeStock && sizeStock.length
      ? `\nLIVE STOCK across products for size "${size}":\n` +
        sizeStock
          .map(
            (p) => `- ${p.product}: ` + p.colors.map((c) => `${c.name}(${c.qty})`).join(", ")
          )
          .join("\n")
      : "";

  const productCtx = convo.productName
    ? `The customer is interested in: "${convo.productName}". Answer for THIS product first. If they ask about other items, offer the other products below.`
    : referral
    ? `The customer arrived from a Meta ad (headline: "${referral.headline ?? ""}"). Infer which product below it matches; if unsure, ask them which item they want.`
    : `You don't yet know which product the customer wants. If they send a bare size, ask which item they mean (name 2-3 options) unless it's obvious.`;

  const nameCtx = convo.profileName
    ? `The customer's WhatsApp name is "${convo.profileName}".`
    : `You don't know the customer's name.`;

  return `You are the EssenceFit WhatsApp shop assistant for a Sri Lankan clothing store. You reply to real customers on WhatsApp.

STYLE:
- Match the customer's language. Most write "Singlish" (romanized Sinhala + English). Reply in natural, correct Singlish the way a friendly Sri Lankan shop assistant would. Keep the Sinhala SIMPLE and correct — use everyday words, not literary ones. If you are not confident how to phrase something in Sinhala, say that part in plain English instead of writing awkward or broken Sinhala. Never output garbled words, stray characters, or non-Sinhala/non-English letters. Short, warm, light on emoji.
- HONORIFIC: "sir" for a man, "miss" for a woman, "dear" when unsure. ${nameCtx} Default to "dear" — never guess wrongly.
- Be concise and confident. Do NOT apologise for or second-guess numbers you have. Do NOT add disclaimers like "I'm not sure, I'll check with the team" when the stock data below already has the answer.

PRODUCT CONTEXT:
${productCtx}

RULES:
- State stock/sizes/colours from the LIVE data below, or from what you already told the customer earlier in this chat. Those numbers are correct — never invent new ones and never walk back numbers you already gave. Only offer to "check with the team" if the data genuinely doesn't contain what they asked.
- Each short is around Rs. 1,500 (Corduroy) / Rs. 990 (Dry-Fit) — quote price only if asked.
- Offer: buy any 3 items = FREE delivery.
- IMAGES: to send the size chart put [[IMG:size-chart]] on its own line; for colour options put [[IMG:colours]]. The image is attached automatically — when you send a tag, don't also claim "here's the chart" in a way that implies you pasted it in text. Only these two tags exist.
- When the customer is ready to buy, collect full name, address, and phone. Do NOT confirm the order yourself — say a team member will finalise it.

IN-STOCK PRODUCTS:
${catalogLines}
${productBlock}
${sizeBlock}`;
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
