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

export type DeliveryProvince = { name: string; fee: number };

// Sri Lanka's 9 provinces with starting fees — all editable in Store Settings.
export const DEFAULT_PROVINCES: DeliveryProvince[] = [
  { name: "Western", fee: 400 },
  { name: "Southern", fee: 400 },
  { name: "Central", fee: 450 },
  { name: "North Western", fee: 450 },
  { name: "Sabaragamuwa", fee: 450 },
  { name: "Uva", fee: 500 },
  { name: "Eastern", fee: 500 },
  { name: "Northern", fee: 500 },
  { name: "North Central", fee: 500 },
];

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
  deliveryProvinces: DeliveryProvince[]; // per-province delivery fees (Sri Lanka)
  contactPhone: string;
  contactEmail: string;
  social: SocialLinks;
  orderNotificationEmail: string; // owner alert address — new-order emails are sent here
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
  deliveryProvinces: "delivery_provinces",
  contactPhone: "contact_phone",
  contactEmail: "contact_email",
  social: "social",
  orderNotificationEmail: "order_notification_email",
} as const;

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "EssenceFit",
  logo: "",
  logoDark: "",
  logoLight: "",
  // The free-delivery line is generated from freeDeliveryOver in the header, so it's not listed here.
  announcement: "Island-wide cash on delivery\nNew arrivals dropping every week\nQuality apparel, delivered to your door",
  heroSlides: [],
  bank: { bank: "", accountName: "", accountNo: "", branch: "" },
  deliveryFee: 400,
  freeDeliveryOver: 7500,
  deliveryProvinces: DEFAULT_PROVINCES,
  contactPhone: "",
  contactEmail: "",
  social: { facebook: "", instagram: "", whatsapp: "", tiktok: "" },
  orderNotificationEmail: "",
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

// Keep stored province fees but fall back to the default list if unset/empty.
function normaliseProvinces(raw: unknown): DeliveryProvince[] {
  if (!Array.isArray(raw)) return DEFAULT_PROVINCES;
  const list = raw
    .map((p: Record<string, unknown>) => ({ name: String(p?.name ?? "").trim(), fee: Number(p?.fee) || 0 }))
    .filter((p) => p.name);
  return list.length ? list : DEFAULT_PROVINCES;
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
  const res = await pool.request().query(`SELECT key, value FROM Settings`);
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
    deliveryProvinces: normaliseProvinces(parseJson<unknown>(map[STORE_KEYS.deliveryProvinces], null)),
    contactPhone: map[STORE_KEYS.contactPhone] || d.contactPhone,
    contactEmail: map[STORE_KEYS.contactEmail] || d.contactEmail,
    social: parseJson<SocialLinks>(map[STORE_KEYS.social], d.social),
    orderNotificationEmail: map[STORE_KEYS.orderNotificationEmail] || d.orderNotificationEmail,
  };
}
