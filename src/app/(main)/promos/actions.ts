"use server";

import { requireAdmin } from "@/lib/adminAuth";
import { getDb, sql } from "@/lib/db";
import { userErrorMessage } from "@/lib/userError";

const { UniqueIdentifier, NVarChar, Int, Bit, DateTime2 } = sql;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type PopupInput = {
  id?: string;
  name: string;
  isActive: boolean;
  priority: number;
  layout: string;
  heading: string;
  body: string;
  imageUrl?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  couponCode?: string | null;
  accentColor?: string | null;
  trigger: string;
  triggerValue: number;
  frequency: string;
  showOn: string;
  device: string;
  audience: string;
  startAt?: string | null; // ISO date or null
  endAt?: string | null;
};

export type AdminPopup = PopupInput & { id: string; impressions: number; clicks: number; createdAt: string };

const LAYOUT = new Set(["center", "corner", "bar"]);
const TRIGGER = new Set(["immediate", "delay", "scroll", "exit"]);
const FREQ = new Set(["always", "session", "daily", "once"]);
const SHOWON = new Set(["all", "home", "shop", "product"]);
const DEVICE = new Set(["all", "desktop", "mobile"]);
const AUDIENCE = new Set(["all", "new", "returning"]);
const pick = (s: Set<string>, v: string, def: string) => (s.has(v) ? v : def);

function mapAdmin(r: any): AdminPopup {
  return {
    id: String(r.id),
    name: r.name ?? "",
    isActive: !!r.isactive,
    priority: Number(r.priority ?? 0),
    layout: r.layout ?? "center",
    heading: r.heading ?? "",
    body: r.body ?? "",
    imageUrl: r.imageurl ?? null,
    ctaText: r.ctatext ?? null,
    ctaLink: r.ctalink ?? null,
    couponCode: r.couponcode ?? null,
    accentColor: r.accentcolor ?? null,
    trigger: r.triggertype ?? "delay",
    triggerValue: Number(r.triggervalue ?? 30),
    frequency: r.frequency ?? "session",
    showOn: r.showon ?? "all",
    device: r.device ?? "all",
    audience: r.audience ?? "all",
    startAt: r.startat ? new Date(r.startat).toISOString() : null,
    endAt: r.endat ? new Date(r.endat).toISOString() : null,
    createdAt: r.createdat ? new Date(r.createdat).toISOString() : "",
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
  };
}

export async function listPopups(): Promise<AdminPopup[]> {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool.request().queryRaw(`
    SELECT p.*,
      (SELECT count(*) FROM popup_events e WHERE e.popupid = p.id AND e.event = 'impression') AS impressions,
      (SELECT count(*) FROM popup_events e WHERE e.popupid = p.id AND e.event = 'click') AS clicks
    FROM popups p
    ORDER BY p.priority DESC, p.createdat DESC
  `);
  return res.recordset.map(mapAdmin);
}

export async function getPopup(id: string): Promise<AdminPopup | null> {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool.request().input("Id", UniqueIdentifier, id).queryRaw(
    `SELECT p.*, 0 AS impressions, 0 AS clicks FROM popups p WHERE p.id = @Id LIMIT 1`
  );
  return res.recordset[0] ? mapAdmin(res.recordset[0]) : null;
}

function bind(req: any, inp: PopupInput) {
  return req
    .input("Name", NVarChar(200), (inp.name || "").trim() || "Untitled")
    .input("IsActive", Bit, inp.isActive ? 1 : 0)
    .input("Priority", Int, Math.trunc(Number(inp.priority) || 0))
    .input("Layout", NVarChar(20), pick(LAYOUT, inp.layout, "center"))
    .input("Heading", NVarChar(300), inp.heading ?? "")
    .input("Body", NVarChar(1000), inp.body ?? "")
    .input("ImageUrl", NVarChar(1000), inp.imageUrl || null)
    .input("CtaText", NVarChar(120), inp.ctaText || null)
    .input("CtaLink", NVarChar(1000), inp.ctaLink || null)
    .input("CouponCode", NVarChar(60), inp.couponCode || null)
    .input("AccentColor", NVarChar(20), inp.accentColor || null)
    .input("Trigger", NVarChar(20), pick(TRIGGER, inp.trigger, "delay"))
    .input("TriggerValue", Int, Math.max(0, Math.trunc(Number(inp.triggerValue) || 0)))
    .input("Frequency", NVarChar(20), pick(FREQ, inp.frequency, "session"))
    .input("ShowOn", NVarChar(20), pick(SHOWON, inp.showOn, "all"))
    .input("Device", NVarChar(20), pick(DEVICE, inp.device, "all"))
    .input("Audience", NVarChar(20), pick(AUDIENCE, inp.audience, "all"))
    .input("StartAt", DateTime2(7), inp.startAt ? new Date(inp.startAt) : null)
    .input("EndAt", DateTime2(7), inp.endAt ? new Date(inp.endAt) : null);
}

export async function savePopup(inp: PopupInput): Promise<Result<{ id: string }>> {
  await requireAdmin();
  if (!inp.name?.trim() && !inp.heading?.trim()) {
    return { ok: false, error: "Give the popup a name or heading." };
  }
  try {
    const pool = await getDb();
    if (inp.id) {
      await bind(pool.request().input("Id", UniqueIdentifier, inp.id), inp).query(`
        UPDATE popups SET
          name=@Name, isactive=@IsActive, priority=@Priority, layout=@Layout,
          heading=@Heading, body=@Body, imageurl=@ImageUrl, ctatext=@CtaText,
          ctalink=@CtaLink, couponcode=@CouponCode, accentcolor=@AccentColor,
          triggertype=@Trigger, triggervalue=@TriggerValue, frequency=@Frequency,
          showon=@ShowOn, device=@Device, audience=@Audience,
          startat=@StartAt, endat=@EndAt
        WHERE id=@Id
      `);
      return { ok: true, id: inp.id };
    }
    const id = crypto.randomUUID();
    await bind(pool.request().input("Id", UniqueIdentifier, id), inp).query(`
      INSERT INTO popups
        (id, name, isactive, priority, layout, heading, body, imageurl, ctatext,
         ctalink, couponcode, accentcolor, triggertype, triggervalue, frequency,
         showon, device, audience, startat, endat)
      VALUES
        (@Id, @Name, @IsActive, @Priority, @Layout, @Heading, @Body, @ImageUrl, @CtaText,
         @CtaLink, @CouponCode, @AccentColor, @Trigger, @TriggerValue, @Frequency,
         @ShowOn, @Device, @Audience, @StartAt, @EndAt)
    `);
    return { ok: true, id };
  } catch (err) {
    const msg = userErrorMessage(err);
    if (msg) return { ok: false, error: msg };
    throw err;
  }
}

export async function togglePopup(id: string, isActive: boolean): Promise<Result> {
  await requireAdmin();
  try {
    const pool = await getDb();
    await pool.request().input("Id", UniqueIdentifier, id).input("A", Bit, isActive ? 1 : 0)
      .query(`UPDATE popups SET isactive=@A WHERE id=@Id`);
    return { ok: true };
  } catch (err) {
    const msg = userErrorMessage(err);
    if (msg) return { ok: false, error: msg };
    throw err;
  }
}

export async function deletePopup(id: string): Promise<Result> {
  await requireAdmin();
  try {
    const pool = await getDb();
    await pool.request().input("Id", UniqueIdentifier, id).query(`DELETE FROM popup_events WHERE popupid=@Id`);
    await pool.request().input("Id", UniqueIdentifier, id).query(`DELETE FROM popups WHERE id=@Id`);
    return { ok: true };
  } catch (err) {
    const msg = userErrorMessage(err);
    if (msg) return { ok: false, error: msg };
    throw err;
  }
}
