import { getDb } from "@/lib/db";

/* Promo popups — admin-configured storefront modals. Reads use queryRaw so the
   many lowercase columns don't each need a columnCase entry; we map to a typed
   camelCase shape here. Admin writes live in src/app/(main)/promos/actions.ts. */

export type PopupLayout = "center" | "split" | "corner" | "bar";
export type TriggerType = "immediate" | "delay" | "scroll" | "exit";
export type Frequency = "always" | "session" | "daily" | "once";
export type ShowOn = "all" | "home" | "shop" | "product";
export type DeviceTarget = "all" | "desktop" | "mobile";
export type Audience = "all" | "new" | "returning";

// Shape sent to the storefront client component (no admin-only `name`).
export type PublicPopup = {
  id: string;
  layout: PopupLayout;
  heading: string;
  body: string;
  imageUrl: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  couponCode: string | null;
  accentColor: string | null;
  trigger: TriggerType;
  triggerValue: number;
  frequency: Frequency;
  showOn: ShowOn;
  device: DeviceTarget;
  audience: Audience;
  priority: number;
};

function mapPublic(r: any): PublicPopup {
  return {
    id: String(r.id),
    layout: (r.layout || "center") as PopupLayout,
    heading: r.heading ?? "",
    body: r.body ?? "",
    imageUrl: r.imageurl ?? null,
    ctaText: r.ctatext ?? null,
    ctaLink: r.ctalink ?? null,
    couponCode: r.couponcode ?? null,
    accentColor: r.accentcolor ?? null,
    trigger: (r.triggertype || "delay") as TriggerType,
    triggerValue: Number(r.triggervalue ?? 30),
    frequency: (r.frequency || "session") as Frequency,
    showOn: (r.showon || "all") as ShowOn,
    device: (r.device || "all") as DeviceTarget,
    audience: (r.audience || "all") as Audience,
    priority: Number(r.priority ?? 0),
  };
}

// Active popups currently within their schedule, best (highest priority) first.
// No cookies()/per-request state so the storefront layout stays ISR-friendly.
export async function getActivePopups(): Promise<PublicPopup[]> {
  try {
    const pool = await getDb();
    const res = await pool.request().queryRaw(`
      SELECT id, layout, heading, body, imageurl, ctatext, ctalink, couponcode,
             accentcolor, triggertype, triggervalue, frequency, showon, device,
             audience, priority
      FROM popups
      WHERE isactive = true
        AND (startat IS NULL OR startat <= now())
        AND (endat   IS NULL OR endat   >= now())
      ORDER BY priority DESC, createdat DESC
    `);
    return res.recordset.map(mapPublic);
  } catch (err) {
    // A popups failure must never break the storefront — just show none.
    console.error("[promos] getActivePopups failed:", err);
    return [];
  }
}
