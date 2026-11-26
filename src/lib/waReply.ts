/*
 * Pure WhatsApp-bot helpers — NO database, NO path aliases — so they can be
 * unit-tested directly by the node:test runner (which doesn't resolve "@/…").
 * The DB queries live in waStock.ts and import from here.
 */

export type ProductStock = {
  product: string;
  category: string;
  colors: { name: string; qty: number }[];
};

/*
 * The catalog stores size names inconsistently — e.g. both "M" and "Medium",
 * both "3XL" and "XXXL" exist as separate Size rows. So we expand whatever the
 * customer typed into every equivalent spelling and match case-insensitively,
 * otherwise "Large" would silently miss the "L" stock (and vice-versa).
 */
const SIZE_ALIASES: Record<string, string[]> = {
  xs: ["xs", "extra small"],
  s: ["s", "small"],
  m: ["m", "medium"],
  l: ["l", "large"],
  xl: ["xl", "extra large"],
  xxl: ["xxl", "2xl"],
  xxxl: ["xxxl", "3xl"],
};

// Reverse index: EVERY spelling (incl. "large", "2xl", …) → its canonical key,
// so expansion works no matter which variant the customer types.
const ALIAS_TO_KEY: Record<string, string> = {};
for (const [key, variants] of Object.entries(SIZE_ALIASES)) {
  for (const v of variants) ALIAS_TO_KEY[v] = key;
}

export function expandSizeAliases(input: string): string[] {
  const typed = input.trim().toLowerCase();
  if (!typed) return [];
  const canonical = ALIAS_TO_KEY[typed] ?? typed;
  const group = SIZE_ALIASES[canonical];
  return group ? group : [typed]; // numeric sizes ("32") fall through as-is
}

/**
 * Returns the raw size token if the WHOLE message is just a size, else null.
 * Accepts "32", "  34 ", "L", "xl", "3XL", "Large" — not "size 32 please".
 * Alias normalisation (Large→L, 3XL→XXXL, …) happens in getStockBySize.
 */
export function parseSize(body: string): string | null {
  const t = body.trim();
  if (/^\d{2}$/.test(t)) return t; // 28–44 waist sizes
  if (/^(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|small|medium|large|extra\s*large)$/i.test(t)) {
    return t;
  }
  return null;
}

/*
 * Image sending: the AI can embed a tag like [[IMG:size-chart]] in its reply to
 * ask the bot to attach an image. Only keys in WA_IMAGE_PATHS are honoured
 * (public files under essencefit.lk/wa/); unknown tags are simply stripped.
 */
export const WA_IMAGE_PATHS: Record<string, string> = {
  "size-chart": "/wa/size-chart.png",
  colours: "/wa/colours.jpg",
  "corduroy-1": "/wa/corduroy-1.jpg", // Corduroy Shorts product photos
  "corduroy-2": "/wa/corduroy-2.jpg",
};

/**
 * Deterministic image-request detection from the customer's message, so a chart
 * / colours request sends the image even if the AI doesn't emit the tag.
 * Conservative keyword match (English + common Singlish).
 */
export function detectImageRequest(text: string): string[] {
  const t = text.toLowerCase();
  const keys: string[] = [];
  if (/size\s*chart|sizechart|\bchart\b|size\s*eka|sizes\s*(chart|eka)/.test(t)) {
    keys.push("size-chart");
  }
  if (/colou?rs?\b|\bcolour|\bcolor/.test(t)) {
    keys.push("colours");
  }
  return keys;
}

export type BotOrderDraft = {
  items: { product: string; size: string; colour: string; qty: number }[];
  name?: string;
  address?: string;
  phone?: string;
};

/**
 * Extracts a completed-order payload the AI emits once it has all details:
 *   [[ORDER:{"items":[{"product":"Corduroy Shorts","size":"34","colour":"Beige","qty":1}],
 *            "name":"...","address":"...","phone":"..."}]]
 * Returns the cleaned text (tag removed) and the parsed draft (or null).
 */
export function parseOrderTag(reply: string): { text: string; order: BotOrderDraft | null } {
  const m = reply.match(/\[\[ORDER:\s*(\{[\s\S]*?\})\s*\]\]/i);
  const text = reply.replace(/\[\[ORDER:[\s\S]*?\]\]/i, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!m) return { text, order: null };
  try {
    const raw = JSON.parse(m[1]) as BotOrderDraft;
    if (!Array.isArray(raw.items) || raw.items.length === 0) return { text, order: null };
    const items = raw.items
      .filter((i) => i && i.product && i.size && i.colour)
      .map((i) => ({
        product: String(i.product),
        size: String(i.size),
        colour: String(i.colour),
        qty: Math.max(1, Math.floor(Number(i.qty) || 1)),
      }));
    if (items.length === 0) return { text, order: null };
    return {
      text,
      order: {
        items,
        name: raw.name ? String(raw.name) : undefined,
        address: raw.address ? String(raw.address) : undefined,
        phone: raw.phone ? String(raw.phone) : undefined,
      },
    };
  } catch {
    return { text, order: null };
  }
}

/** Splits an AI reply into clean text + the image keys it asked to attach. */
export function parseImageTags(reply: string): { text: string; imageKeys: string[] } {
  const keys: string[] = [];
  const text = reply
    .replace(/\[\[IMG:([a-z0-9-]+)\]\]/gi, (_m, k: string) => {
      const key = k.toLowerCase();
      if (WA_IMAGE_PATHS[key]) keys.push(key);
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, imageKeys: [...new Set(keys)] };
}

/**
 * Looser size extraction that also catches a size stated mid-sentence with a
 * cue word: "ina 36" / "size 36" / "36 size" / "waist 36" ("ina" = waist in
 * Singlish), plus a bare "36". Returns the numeric size or null.
 */
export function extractSize(text: string): string | null {
  const t = text.trim();
  // cue word before the number: ina/size/waist/weist 36
  let m = t.match(/\b(?:ina|inna|size|waist|weist)\s*([23]\d)\b/i);
  if (m) return m[1];
  // number before a cue word: 36 size / 36 ina
  m = t.match(/\b([23]\d)\s*(?:size|ina|inna)\b/i);
  if (m) return m[1];
  // whole message is just a size
  const p = parseSize(t);
  if (p && /^\d{2}$/.test(p)) return p;
  return null;
}

/** Formats the live stock for a size into the WhatsApp reply text. */
export function formatStockReply(size: string, stock: ProductStock[]): string {
  if (stock.length === 0) {
    return (
      `Size ${size} දැනට stock නෑ 😔\n` +
      `ලඟදිම restock වෙයි — වෙන size එකක් try කරන්නත් පුළුවන් (30 / 32 / 34 / 36).`
    );
  }

  const lines: string[] = [`Size ${size} — available colours 👇\n`];
  for (const p of stock) {
    lines.push(`*${p.product}*`);
    for (const c of p.colors) {
      lines.push(`  • ${c.name} — ${c.qty}`);
    }
    lines.push("");
  }
  lines.push("ඕන colour එක reply කරන්න, order එක හදලා දෙන්නම් 🙌");
  return lines.join("\n");
}
