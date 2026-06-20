/* Resolve a display swatch colour for a product colour.
   Priority: explicit admin Hex → exact name map → keyword match → null (neutral chip).
   Pure & importable from both server and client components. */

export const COLOR_NAME_HEX: Record<string, string> = {
  black: "#111111",
  white: "#FFFFFF",
  offwhite: "#F5F1E8",
  ivory: "#FFFFF0",
  cream: "#F5EFE0",
  red: "#E11D48",
  maroon: "#7F1D1D",
  burgundy: "#6D1A2E",
  wine: "#722F37",
  pink: "#EC4899",
  rose: "#F43F5E",
  peach: "#FFB996",
  coral: "#FF6F61",
  orange: "#F97316",
  rust: "#B7410E",
  yellow: "#EAB308",
  mustard: "#D4A017",
  gold: "#D4AF37",
  green: "#16A34A",
  olive: "#6B7330",
  lime: "#84CC16",
  mint: "#9FE2BF",
  teal: "#14B8A6",
  cyan: "#06B6D4",
  blue: "#2563EB",
  navy: "#1E2A52",
  royal: "#1D4ED8",
  sky: "#38BDF8",
  denim: "#3B5998",
  peacock: "#1B7A8C",
  turquoise: "#30D5C8",
  purple: "#7C3AED",
  violet: "#8B5CF6",
  lavender: "#B59CE0",
  lilac: "#C8A2C8",
  brown: "#7C4A2D",
  chocolate: "#5C3A21",
  beige: "#E3D5B8",
  tan: "#D2B48C",
  khaki: "#B6A66A",
  grey: "#6B7280",
  gray: "#6B7280",
  silver: "#C0C5CE",
  charcoal: "#36393F",
  ash: "#9AA0A6",
  dark: "#374151",
  light: "#D1D5DB",
};

const norm = (s: string) => s.toLowerCase().trim();

// Words that modify a colour but aren't the colour itself — a real colour word wins over these.
const MODIFIERS = new Set([
  "light", "dark", "bright", "deep", "pale", "dull", "neon", "highlight",
  "dot", "marl", "heather", "mid", "hot", "soft", "muted",
]);

/** Resolve a colour name to a hex via the keyword map (no admin override). */
export function hexFromName(name: string): string | null {
  const n = norm(name);
  if (COLOR_NAME_HEX[n]) return COLOR_NAME_HEX[n];
  // strip non-letters and try a compact key (e.g. "off-white" -> "offwhite")
  const compact = n.replace(/[^a-z]/g, "");
  if (COLOR_NAME_HEX[compact]) return COLOR_NAME_HEX[compact];
  const words = n.split(/[^a-z]+/).filter(Boolean);
  // Prefer a real colour word over modifiers: "Light Green" -> green, "Navy Blue" -> navy.
  for (const w of words) if (!MODIFIERS.has(w) && COLOR_NAME_HEX[w]) return COLOR_NAME_HEX[w];
  // Fall back to any matching word (e.g. a colour literally named "Light").
  for (const w of words) if (COLOR_NAME_HEX[w]) return COLOR_NAME_HEX[w];
  return null;
}

/** True if a hex colour is perceptually light (so it needs a dark outline/line). */
export function isLightHex(hex: string): boolean {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.7;
}

/** A diagonal "cut" line colour that contrasts with the swatch underneath. */
export function cutLineColor(hex: string | null): string {
  if (!hex) return "#6B7280"; // neutral split chip → dark-ish line
  return isLightHex(hex) ? "#4B5563" : "#E5E7EB";
}

export type Swatch = { hex: string | null; label: string };

/** Explicit hex wins; else derive from the name; else null (caller shows a neutral split chip). */
export function resolveSwatch(name: string, hex?: string | null): Swatch {
  const explicit = hex && /^#?[0-9a-fA-F]{3,8}$/.test(hex.trim())
    ? (hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`)
    : null;
  return { hex: explicit ?? hexFromName(name), label: name };
}
