import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { getAuthedUserId } from "@/lib/api/auth";
import {
  classifySiteBuilderUploadMime,
  extForSiteBuilderMime,
  type SiteBuilderAssetRecord,
} from "@/lib/site-builder/site-builder-asset";
import { siteBuilderAssetAbsoluteDir } from "@/lib/site-builder/site-builder-asset-paths";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const mime = (file.type || "application/octet-stream").toLowerCase().split(";")[0]!.trim();
  const kind = classifySiteBuilderUploadMime(mime);
  if (!kind) {
    return NextResponse.json({ error: "Unsupported type — use JPG, PNG, WebP, GIF, or MP4" }, { status: 400 });
  }

  const ext = extForSiteBuilderMime(mime);
  if (!ext) {
    return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
  }

  const assetId = randomUUID();
  const rel = `${userId}/${assetId}${ext}`;
  const dir = siteBuilderAssetAbsoluteDir();
  await mkdir(path.join(dir, String(userId)), { recursive: true });
  await writeFile(path.join(dir, String(userId), `${assetId}${ext}`), buf);

  const publicUrl = `/api/site-builder/assets/${assetId}`;
  const asset: SiteBuilderAssetRecord = {
    assetId,
    kind,
    originalName: file.name || `upload${ext}`,
    mimeType: mime,
    storagePath: rel,
    storageKey: rel,
    publicUrl,
  };

  return NextResponse.json({ asset });
}
