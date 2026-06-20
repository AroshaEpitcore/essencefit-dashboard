import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const SAFE_FOLDERS = new Set(["products", "categories", "slips", "store", "misc"]);

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
    if (!ALLOWED.has(blob.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPG, PNG, WEBP or GIF." },
        { status: 415 }
      );
    }
    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 5MB)." }, { status: 413 });
    }

    const ext = EXT[blob.type] || "bin";
    const name = `${crypto.randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(dir, { recursive: true });

    const bytes = Buffer.from(await blob.arrayBuffer());
    await writeFile(path.join(dir, name), bytes);

    const url = `/uploads/${folder}/${name}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload] failed:", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
