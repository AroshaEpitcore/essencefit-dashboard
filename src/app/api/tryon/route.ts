import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";

/* Virtual try-on: forwards the customer's photo + the product image to the
   Gemini image model and returns the generated preview as a data URL.
   Privacy by design: the photo lives only in this request — nothing is
   written to Supabase Storage or the DB except an IP row for rate caps. */

const { NVarChar } = sql;

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = "gemini-2.5-flash-image";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO = 5 * 1024 * 1024; // 5MB (client downscales to ~1280px first)
const PER_IP_DAILY = 8; // generations per IP per rolling 24h
const GLOBAL_DAILY = 150; // generations store-wide per rolling 24h
const LIMIT_MSG = "Daily try-on limit reached. Please try again tomorrow.";

const PROMPT =
  "Virtual try-on. The first image is a photo of a person. The second image " +
  "is a product photo of a garment. Generate a photorealistic image of the " +
  "same person wearing that garment. Keep the person's face, hair, body " +
  "shape, pose and the background exactly as in the first image — only " +
  "replace their clothing with the garment, fitted naturally with realistic " +
  "drape, lighting and shadows.";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Only product images we host may be fetched server-side (SSRF guard):
   Supabase public-storage URLs or same-origin relative paths. */
function resolveProductImage(raw: string, origin: string): string | null {
  if (SUPABASE_URL && raw.startsWith(`${SUPABASE_URL}/storage/v1/object/public/`)) return raw;
  if (raw.startsWith("/") && !raw.startsWith("//")) return `${origin}${raw}`;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_KEY) {
      return NextResponse.json({ error: "Try-on is not configured." }, { status: 500 });
    }

    const form = await req.formData();
    const photo = form.get("photo");
    const productImageRaw = String(form.get("productImage") || "");
    const productName = String(form.get("productName") || "this garment").slice(0, 200);

    if (!photo || typeof photo === "string" || !PHOTO_TYPES.has((photo as File).type)) {
      return NextResponse.json({ error: "Please upload a JPG, PNG or WEBP photo." }, { status: 415 });
    }
    const photoFile = photo as File;
    if (photoFile.size > MAX_PHOTO) {
      return NextResponse.json({ error: "Photo too large (max 5MB)." }, { status: 413 });
    }
    const productImage = resolveProductImage(productImageRaw, req.nextUrl.origin);
    if (!productImage) {
      return NextResponse.json({ error: "Invalid product image." }, { status: 400 });
    }

    // Rate caps (rolling 24h). Lowercase aliases on purpose: they're not in
    // the columnCase map, so they come back exactly as written.
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const db = await getDb();
    const counts = await db
      .request()
      .input("Ip", NVarChar(100), ip)
      .query(`SELECT
                (SELECT COUNT(*) FROM TryOnUsage WHERE Ip = @Ip AND CreatedAt >= now() - interval '24 hours') AS ipcount,
                (SELECT COUNT(*) FROM TryOnUsage WHERE CreatedAt >= now() - interval '24 hours') AS globalcount`);
    const row = counts.recordset[0] as { ipcount?: number | string; globalcount?: number | string };
    if (Number(row?.ipcount ?? 0) >= PER_IP_DAILY || Number(row?.globalcount ?? 0) >= GLOBAL_DAILY) {
      return NextResponse.json({ error: LIMIT_MSG }, { status: 429 });
    }
    // Log the attempt before calling the model so failed generations still count.
    await db.request().input("Ip", NVarChar(100), ip).query(`INSERT INTO TryOnUsage (Ip) VALUES (@Ip)`);

    // Fetch the garment image server-side and base64 both inputs.
    const imgRes = await fetch(productImage);
    const imgType = imgRes.headers.get("content-type")?.split(";")[0] || "";
    if (!imgRes.ok || !imgType.startsWith("image/")) {
      return NextResponse.json({ error: "Could not load the product image." }, { status: 502 });
    }
    const garmentB64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
    const photoB64 = Buffer.from(await photoFile.arrayBuffer()).toString("base64");

    const gen = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${PROMPT} The garment is: ${productName}.` },
                { inlineData: { mimeType: photoFile.type, data: photoB64 } },
                { inlineData: { mimeType: imgType, data: garmentB64 } },
              ],
            },
          ],
        }),
      }
    );
    if (!gen.ok) {
      console.error("[tryon] gemini failed:", gen.status, await gen.text().catch(() => ""));
      return NextResponse.json(
        { error: "The try-on service is busy right now. Please try again in a minute." },
        { status: 502 }
      );
    }

    const data = (await gen.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
    };
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) {
      // Model declined (e.g. safety) or returned text only.
      return NextResponse.json(
        { error: "Couldn't generate a try-on from this photo. Try a clearer, full-body photo." },
        { status: 422 }
      );
    }

    const mime = part.inlineData.mimeType || "image/png";
    return NextResponse.json({ image: `data:${mime};base64,${part.inlineData.data}` });
  } catch (err) {
    console.error("[tryon] failed:", err);
    return NextResponse.json({ error: "Try-on failed. Please try again." }, { status: 500 });
  }
}
