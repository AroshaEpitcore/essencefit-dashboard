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
  image: string;
  title: string;
  subtitle: string;
  link: string;
};

export type SocialLinks = {
  facebook: string;
  instagram: string;
  whatsapp: string;
  tiktok: string;
};

export type StoreSettings = {
  storeName: string;
  logo: string;
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
  announcement: "Free delivery on orders over Rs. 10,000 • Island-wide cash on delivery",
  heroSlides: [],
  bank: { bank: "", accountName: "", accountNo: "", branch: "" },
  deliveryFee: 400,
  freeDeliveryOver: 0,
  contactPhone: "",
  contactEmail: "",
  social: { facebook: "", instagram: "", whatsapp: "", tiktok: "" },
};

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
    announcement: map[STORE_KEYS.announcement] ?? d.announcement,
    heroSlides: parseJson<HeroSlide[]>(map[STORE_KEYS.heroSlides], d.heroSlides),
    bank: parseJson<BankDetails>(map[STORE_KEYS.bank], d.bank),
    deliveryFee: Number(map[STORE_KEYS.deliveryFee] ?? d.deliveryFee) || 0,
    freeDeliveryOver: Number(map[STORE_KEYS.freeDeliveryOver] ?? d.freeDeliveryOver) || 0,
    contactPhone: map[STORE_KEYS.contactPhone] || d.contactPhone,
    contactEmail: map[STORE_KEYS.contactEmail] || d.contactEmail,
    social: parseJson<SocialLinks>(map[STORE_KEYS.social], d.social),
  };
}
