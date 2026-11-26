import { generateReply } from "@/lib/waAi";
import { getConvo, saveConvo, type WaConvo } from "@/lib/waConvo";
import {
  getStockBySize,
  getCatalogSummary,
  getProductStockText,
  type CatalogItem,
} from "@/lib/waStock";
import {
  extractSize,
  parseImageTags,
  parseOrderTag,
  detectImageRequest,
  WA_IMAGE_PATHS,
  type ProductStock,
} from "@/lib/waReply";
import { savePendingOrder } from "@/lib/waPendingOrders";

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

// The shop's standard opening message (from the admin WhatsApp templates),
// sent verbatim on first contact for Corduroy Shorts — mirrors the manual flow.
const CORDUROY_WELCOME = `Thank you so much for choosing EssenceFit 🙌

Size කොහොමද dear 30 32 34 36?

✅ Any 3 items — Free Delivery !

මේක සාමාන්‍ය Baby Corduroy නෙවෙයි. උසස් තත්ත්වයේ Imported Corduroy Material එකකින් නිෂ්පාදනය කරලා තියෙන විශේෂ Collection එකක්.

Casual outings, trips සහ everyday outfits වලට perfect match වෙන stylish look එකක් වගේම, හොඳ durability එකකුත් මේ material එකේ තියෙනවා.

Imported material එකක් නිසා කල්පැවැත්ම ගැනත් විශ්වාසයෙන් යුතුව අවුරුදු ගණනාවක් භාවිතා කරන්න පුළුවන්.

👖 එකක් රු. 1,500යි.
🚚 Shorts 3ක් ගත්තොත් Free Delivery!`;

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
  const productKnownBefore = !!convo.productName;
  // Resolve the product from: already-known → the ad referral → the customer's
  // own words ("corduroy shorts"). Setting it means the AI gets that product's
  // live stock, and we can proactively send its photos.
  const resolvedProduct =
    convo.productName ||
    (productFromAd && matchCatalog(productFromAd, catalog)) ||
    matchCatalog(input.text, catalog);
  if (resolvedProduct && !convo.productName) convo.productName = resolvedProduct;
  const productJustResolved = !!convo.productName && !productKnownBefore;

  // First contact with Corduroy Shorts → send the standard welcome message +
  // size chart + product photos verbatim (matches the manual opening). No AI
  // call needed, so this is instant and free.
  if (productJustResolved && /corduroy/i.test(convo.productName ?? "")) {
    convo.history = [
      ...convo.history,
      { role: "user", text: input.text },
      { role: "model", text: CORDUROY_WELCOME },
    ];
    try {
      await saveConvo(convo, input.referral ?? undefined);
    } catch (err) {
      console.error("[wa/agent] saveConvo (welcome) failed:", err);
    }
    return {
      text: CORDUROY_WELCOME,
      images: ["size-chart", "corduroy-1", "corduroy-2"].map(
        (k) => `${BASE_URL}${WA_IMAGE_PATHS[k]}`
      ),
    };
  }

  const size = extractSize(input.text);
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

  // If the AI signalled a completed order, save it for the owner to review and
  // place (Phase 2c — collect + hand to human). Strip the tag from the reply.
  const { text: afterOrder, order } = parseOrderTag(raw);
  if (order) {
    try {
      const saved = await savePendingOrder({
        waId: input.waId,
        name: order.name ?? convo.profileName ?? null,
        address: order.address ?? null,
        phone: order.phone ?? input.waId,
        items: order.items,
      });
      console.log(`[wa/agent] pending order saved ${saved.id} total=${saved.total}`);
    } catch (err) {
      console.error("[wa/agent] savePendingOrder failed:", err);
    }
  }

  const { text, imageKeys } = parseImageTags(afterOrder);
  // Union the AI's requested images with deterministic triggers, so images
  // attach even if the AI omits the tag:
  //  - chart/colours on keyword request;
  //  - Corduroy product photos the first time the product is resolved, or when
  //    the customer explicitly asks to see photos.
  const deterministic = [...detectImageRequest(input.text)];
  const isCorduroy = !!convo.productName && /corduroy/i.test(convo.productName);
  const asksPhoto = /\b(photo|photos|pic|pics|image|images|penna|pennanna|balanna)\b/i.test(input.text);
  if (isCorduroy && (productJustResolved || asksPhoto)) {
    deterministic.push("corduroy-1", "corduroy-2");
    // On first engagement, also send the size chart (matches the manual flow).
    if (productJustResolved) deterministic.push("size-chart");
  }
  const allKeys = [...new Set([...imageKeys, ...deterministic])].filter((k) => WA_IMAGE_PATHS[k]);
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
    .map((c) => `- ${c.product} (${c.category}) — Rs. ${c.price} — sizes: ${c.sizes}`)
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
- Match the customer's language. Most write "Singlish" (romanized Sinhala + English). Reply in natural, correct Singlish like a friendly Sri Lankan shop assistant. Keep the Sinhala SIMPLE and correct — everyday words, not literary ones. If unsure how to phrase something in Sinhala, say that part in plain English rather than awkward/broken Sinhala. Never output garbled words or stray characters.
- HONORIFIC: "sir" for a man, "miss" for a woman, "dear" when unsure. ${nameCtx} Default to "dear" — never guess wrongly.
- BE SHORT. Usually 1–2 lines. Answer only what the customer asked, then ask the ONE next thing. Do not re-explain the whole order process in every message. Don't pile multiple questions or long instructions together.
- Be confident. Never apologise for or second-guess numbers you have, and never say "I'll check with the team" when the stock data below already answers it.

PRODUCT CONTEXT:
${productCtx}

CONVERSATION FLOW (one short step at a time — do NOT jump ahead):
1. Customer interested in a product → send its product photos (see IMAGES) and ask their size. One line.
2. Customer gives a size → tell them the available colours for that size and ask them to pick one. Nothing about name/address yet.
3. Customer picks a colour → THEN (and only then) ask for full name, address, and phone to place the order.
4. You have all details → confirm the order briefly and say a team member will finalise it. Do NOT confirm the order yourself.

UNDERSTANDING THE CUSTOMER (answer what they ACTUALLY asked — don't just repeat the last list):
- SIZE: "ina 36", "ina size 36", "size 36", "36 size", "waist 36", or a bare "36" all mean the customer's size is 36 ("ina" = waist). → reply with that size's Stock List using the STOCK LIST FORMAT, listing the real in-stock colours from the data. Do NOT reply vaguely or say "I'll send the colour chart" — give the actual colour list.
- "ekak kiyada" / "keeyada" / "kiyada" / "keeyak" / "price eka" / "how much" = PRICE question → answer the per-piece price (Corduroy Rs. 1,500, Dry-Fit Rs. 990). Do NOT resend the colour list.
- "mona/monawa/mokak colours" / "colours mnwada" = which colours → give the colour list.
- "size chart" / "chart" = send the size chart image.
- If you're unsure what they mean, ask a short clarifying question — don't guess by repeating a previous answer.

SHOP FACTS (mention only what's relevant — don't dump everything):
- Corduroy Shorts: premium imported corduroy, Rs. 1,500 each. Sizes 30/32/34/36 (waist inches).
- STRETCH: the fabric stretches ~2 inches and the waistband has an adjuster, so e.g. a 34 waist fits 32, and 36 stretches to about 38. If the exact size is out of stock, offer the nearest size and mention the stretch instead of just saying no.
- DELIVERY: islandwide, 1–2 days. ~Rs. 400 Colombo / 450 outstation / 500 East & North. FREE when buying 3 or more.
- COD: the customer may open and check the parcel before paying (cash on delivery). East & North are prepaid only.

STOCK LIST FORMAT — when the customer asks the colours/stock for a size, reply EXACTLY in this shape (bullets, with pcs), only colours that are in stock:
Shorts - <size> Stock List

Corduroy Shorts
• <Colour> - <n> pcs

PRICE FORMAT — for N shorts: "Rs. 1,500 × N = Rs. <total>" and "Free delivery 🚚" when N ≥ 3.

ORDER DETAILS — once the customer agrees to order, send:
📦 To place your order, please share:
1️⃣ Full Name
2️⃣ Delivery Address
3️⃣ Contact Number

COMPLETING AN ORDER — when you have the item(s) (product + size + colour + qty) AND the customer's name, address and phone, do BOTH:
1. Output this tag on its own line (the system reads it; the customer does NOT see it):
[[ORDER:{"items":[{"product":"Corduroy Shorts","size":"34","colour":"Beige","qty":1}],"name":"<name>","address":"<full address>","phone":"<phone>"}]]
   - "product" must be the exact product name from IN-STOCK PRODUCTS. One entry per colour/size, with its qty.
2. Then a short friendly confirmation to the customer (1–2 lines) saying the order is noted and the team will confirm and arrange delivery. Do NOT quote a made-up order number.
Only emit the tag when you truly have all the details. Price is NOT in the tag — the system calculates it.

RULES:
- Use stock numbers from the LIVE data below or what you already told them — they are correct; never invent or walk them back.
- Keep normal chat to 1–2 lines. The stock-list, price and order-details blocks above are the only longer messages.
- Do NOT confirm or finalise the order yourself. Once you have their details, say the team will confirm and arrange delivery.
- WhatsApp text only: *bold* with single asterisks. The "•" bullet in the stock list is fine; no other markdown.
- IMAGES (attached automatically — don't paste them as text): size chart → [[IMG:size-chart]]; colours → [[IMG:colours]]; Corduroy product photos → [[IMG:corduroy-1]], [[IMG:corduroy-2]]. Put each tag on its own line.

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

// Generic garment words that don't identify a specific product on their own.
const GENERIC_WORDS = new Set([
  "short", "shorts", "tshirt", "t-shirt", "shirt", "tee", "polo", "collar",
  "dryfit", "dry", "fit", "sport", "active", "wear", "plain", "regular",
  "sleeveless", "skinner", "premium", "size", "color", "colour",
]);

/**
 * Matches text against catalog product names. First tries a full-name substring
 * ("corduroy shorts" → "Corduroy Shorts"), then a distinctive-word match so a
 * bare "corduroy" still resolves. Generic garment words never match alone.
 */
function matchCatalog(text: string, catalog: CatalogItem[]): string | null {
  const hay = text.toLowerCase();
  // Longest product name first, so "Ck Sport short" beats a bare "short".
  const byLen = [...catalog].sort((a, b) => b.product.length - a.product.length);
  for (const c of byLen) {
    if (hay.includes(c.product.toLowerCase())) return c.product;
  }
  // Distinctive-word fallback (e.g. "corduroy", "ceylon", "eddie").
  for (const c of byLen) {
    const tokens = c.product
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !GENERIC_WORDS.has(w));
    if (tokens.some((tok) => new RegExp(`\\b${tok}\\b`).test(hay))) return c.product;
  }
  return null;
}
