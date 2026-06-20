import { getDb } from "@/lib/db";

/* Typed wrapper over the generic Settings Key/Value table for storefront config.
   Reads are safe to call from server components. Writes live in
   src/app/(main)/settings/actions.ts (saveStoreSettings). */

export type BankDetails = {
  bank: string;
  accountName: string;
  accountNo: string;
  branch: string;
};

export type HeroSlide = {
  type: "image" | "video";
  src: string;
  heading: string;
  subheading: string;
  ctaText: string;
  ctaLink: string;
  align: "left" | "center" | "right";
};

export type SocialLinks = {
  facebook: string;
  instagram: string;
  whatsapp: string;
  tiktok: string;
};

export type StoreSettings = {
  storeName: string;
  logo: string; // legacy single logo (fallback)
  logoDark: string; // shown on the solid white header
  logoLight: string; // shown on the transparent header (over hero)
  announcement: string;
  heroSlides: HeroSlide[];
  bank: BankDetails;
  deliveryFee: number;
  freeDeliveryOver: number; // 0 = disabled
  contactPhone: string;
  contactEmail: string;
  social: SocialLinks;
};

// Settings keys ↔ struct mapping
export const STORE_KEYS = {
  storeName: "store_name",
  logo: "store_logo",
  logoDark: "store_logo_dark",
  logoLight: "store_logo_light",
  announcement: "announcement",
  heroSlides: "hero_slides",
  bank: "bank_details",
  deliveryFee: "delivery_fee",
  freeDeliveryOver: "free_delivery_over",
  contactPhone: "contact_phone",
  contactEmail: "contact_email",
  social: "social",
} as const;

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "EssenceFit",
  logo: "",
  logoDark: "",
  logoLight: "",
  announcement: "Free delivery on orders over Rs. 10,000 • Island-wide cash on delivery",
  heroSlides: [],
  bank: { bank: "", accountName: "", accountNo: "", branch: "" },
  deliveryFee: 400,
  freeDeliveryOver: 0,
  contactPhone: "",
  contactEmail: "",
  social: { facebook: "", instagram: "", whatsapp: "", tiktok: "" },
};

// Normalise stored slides — supports the legacy {image,title,subtitle,link} shape.
function normaliseSlides(raw: unknown): HeroSlide[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: Record<string, unknown>): HeroSlide => {
      const type: HeroSlide["type"] = s.type === "video" ? "video" : "image";
      const align: HeroSlide["align"] =
        s.align === "left" || s.align === "right" ? s.align : "center";
      return {
        type,
        src: String(s.src ?? s.image ?? ""),
        heading: String(s.heading ?? s.title ?? ""),
        subheading: String(s.subheading ?? s.subtitle ?? ""),
        ctaText: String(s.ctaText ?? "Shop now"),
        ctaLink: String(s.ctaLink ?? s.link ?? "/shop"),
        align,
      };
    })
    .filter((s) => s.src);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getPublicStoreSettings(): Promise<StoreSettings> {
  const pool = await getDb();
  const res = await pool.request().query(`SELECT [Key], [Value] FROM Settings`);
  const map: Record<string, string> = {};
  for (const row of res.recordset) map[row.Key] = row.Value;

  const d = DEFAULT_STORE_SETTINGS;
  return {
    storeName: map[STORE_KEYS.storeName] || d.storeName,
    logo: map[STORE_KEYS.logo] || d.logo,
    logoDark: map[STORE_KEYS.logoDark] || map[STORE_KEYS.logo] || d.logoDark,
    logoLight: map[STORE_KEYS.logoLight] || d.logoLight,
    announcement: map[STORE_KEYS.announcement] ?? d.announcement,
    heroSlides: normaliseSlides(parseJson<unknown>(map[STORE_KEYS.heroSlides], [])),
    bank: parseJson<BankDetails>(map[STORE_KEYS.bank], d.bank),
    deliveryFee: Number(map[STORE_KEYS.deliveryFee] ?? d.deliveryFee) || 0,
    freeDeliveryOver: Number(map[STORE_KEYS.freeDeliveryOver] ?? d.freeDeliveryOver) || 0,
    contactPhone: map[STORE_KEYS.contactPhone] || d.contactPhone,
    contactEmail: map[STORE_KEYS.contactEmail] || d.contactEmail,
    social: parseJson<SocialLinks>(map[STORE_KEYS.social], d.social),
  };
}
