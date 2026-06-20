import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO = 60 * 1024 * 1024; // 60MB
const SAFE_FOLDERS = new Set(["products", "categories", "slips", "store", "hero", "misc"]);

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

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPG, PNG, WEBP, GIF or MP4/WEBM." },
        { status: 415 }
      );
    }
    const limit = isVideo ? MAX_VIDEO : MAX_IMAGE;
    if (blob.size > limit) {
      return NextResponse.json(
        { error: `File too large (max ${isVideo ? "60MB" : "5MB"}).` },
        { status: 413 }
      );
    }

    const ext = EXT[blob.type] || "bin";
    const name = `${crypto.randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(dir, { recursive: true });

    const bytes = Buffer.from(await blob.arrayBuffer());
    await writeFile(path.join(dir, name), bytes);

    const url = `/uploads/${folder}/${name}`;
    return NextResponse.json({ url, kind: isVideo ? "video" : "image" });
  } catch (err) {
    console.error("[upload] failed:", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
