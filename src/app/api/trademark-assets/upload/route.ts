import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "video/mp4",
  "application/pdf",
]);

const MAX_BYTES = 25 * 1024 * 1024;

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const kindRaw = form.get("kind");
    const file = form.get("file");
    const kind = typeof kindRaw === "string" ? kindRaw : "other";
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || "unknown"}` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large. Max 25MB." }, { status: 413 });
    }

    // Mirror USPTO drawing guidance guardrail for sound mark files.
    if (file.type.startsWith("audio/") && file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio file exceeds 5MB intake guardrail." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

    const ext = path.extname(file.name) || "";
    const fileId = crypto.randomUUID();
    const safeName = sanitizeName(path.basename(file.name, ext));
    const finalName = `${fileId}-${safeName}${ext}`;

    const relativeDir = path.join("uploads", "trademark", String(userId));
    const absoluteDir = path.join(process.cwd(), "public", relativeDir);
    await fs.mkdir(absoluteDir, { recursive: true });
    const absolutePath = path.join(absoluteDir, finalName);
    await fs.writeFile(absolutePath, bytes);

    const uri = `/${relativeDir}/${finalName}`;
    return NextResponse.json({
      id: fileId,
      kind,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      sha256,
      uri,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("trademark-assets/upload POST failed", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
