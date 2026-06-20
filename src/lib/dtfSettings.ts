import { getDb } from "@/lib/db";
import { getPublicStoreSettings } from "@/lib/storeSettings";

/* Admin-editable content for the customer Customize page, stored in the
   generic Settings Key/Value table. WhatsApp/phone are reused from the
   existing store settings (no duplicate fields). */

export const DTF_KEYS = {
  introNote: "dtf_intro_note",
  suggestions: "dtf_suggestions", // JSON string[]
} as const;

export type DtfPageSettings = {
  introNote: string;
  suggestions: string[];
  whatsapp: string;
  contactPhone: string;
};

const DEFAULT_INTRO =
  "Upload your design, pick your garment and we'll print it with premium DTF. This price is an estimate — the final price may change after we review your artwork.";

const DEFAULT_SUGGESTIONS = [
  "Send high-resolution artwork (300 DPI) for the sharpest print.",
  "PNG with a transparent background works best.",
  "Tell us the exact print position (front / back / pocket) in your note.",
  "Not sure about sizing or placement? Add a note and we'll guide you.",
];

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getDtfPageSettings(): Promise<DtfPageSettings> {
  const pool = await getDb();
  const res = await pool.request().query(`SELECT [Key], [Value] FROM Settings`);
  const map: Record<string, string> = {};
  for (const row of res.recordset) map[row.Key] = row.Value;

  const store = await getPublicStoreSettings();
  return {
    introNote: map[DTF_KEYS.introNote] ?? DEFAULT_INTRO,
    suggestions: parseJson<string[]>(map[DTF_KEYS.suggestions], DEFAULT_SUGGESTIONS),
    whatsapp: store.social?.whatsapp || store.contactPhone || "",
    contactPhone: store.contactPhone || "",
  };
}
