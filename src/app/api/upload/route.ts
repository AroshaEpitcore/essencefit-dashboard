import { NextRequest, NextResponse } from "next/server";

// Object storage on Supabase (serverless filesystems are read-only, so we
// can't write to public/uploads in production). Uploads go to a public bucket
// via the Storage REST API and we return the public CDN URL.
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "uploads";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const DOC_TYPES = new Set(["application/pdf"]);
const MAX_IMAGE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO = 60 * 1024 * 1024; // 60MB
const MAX_DESIGN = 25 * 1024 * 1024; // 25MB — customer DTF artwork (image or PDF)
const SAFE_FOLDERS = new Set(["products", "categories", "slips", "store", "hero", "designs", "reviews", "gallery", "misc"]);

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const folderRaw = String(form.get("folder") || "misc");
    const folder = SAFE_FOLDERS.has(folderRaw) ? folderRaw : "misc";

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const blob = file as File;
    const isImage = IMAGE_TYPES.has(blob.type);
    const isVideo = VIDEO_TYPES.has(blob.type);
    const isDoc = DOC_TYPES.has(blob.type);
    // PDFs are only accepted into the design-upload folder.
    const docAllowed = isDoc && folder === "designs";

    if (!isImage && !isVideo && !docAllowed) {
      return NextResponse.json(
        {
          error:
            folder === "designs"
              ? "Unsupported file type. Use JPG, PNG, WEBP, GIF or PDF."
              : "Unsupported file type. Use JPG, PNG, WEBP, GIF or MP4/WEBM.",
        },
        { status: 415 }
      );
    }

    // Design uploads (image or PDF) get a larger cap.
    const limit = folder === "designs" ? MAX_DESIGN : isVideo ? MAX_VIDEO : MAX_IMAGE;
    if (blob.size > limit) {
      const mb = folder === "designs" ? "25MB" : isVideo ? "60MB" : "5MB";
      return NextResponse.json({ error: `File too large (max ${mb}).` }, { status: 413 });
    }

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error("[upload] missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env");
      return NextResponse.json({ error: "Upload not configured." }, { status: 500 });
    }

    const ext = EXT[blob.type] || "bin";
    const objectPath = `${folder}/${crypto.randomUUID()}.${ext}`;
    const bytes = Buffer.from(await blob.arrayBuffer());

    const put = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": blob.type || "application/octet-stream",
        "x-upsert": "true",
        "cache-control": "public, max-age=31536000, immutable",
      },
      body: bytes,
    });
    if (!put.ok) {
      console.error("[upload] storage put failed:", put.status, await put.text().catch(() => ""));
      return NextResponse.json({ error: "Upload failed." }, { status: 500 });
    }

    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
    const kind = isVideo ? "video" : isDoc ? "pdf" : "image";
    return NextResponse.json({ url, kind });
  } catch (err) {
    console.error("[upload] failed:", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
