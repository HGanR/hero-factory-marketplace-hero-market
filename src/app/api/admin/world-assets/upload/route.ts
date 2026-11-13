/** Admin GLB/image uploads to persistent Pinata storage (Vercel filesystem is read-only). */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif",
};

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value || request.cookies.get("auth-token")?.value;
  let isAdmin = false;
  try { isAdmin = !!token && verifyToken(token)?.isAdmin === true; } catch { /* invalid token */ }
  if (!isAdmin) return NextResponse.json({ error: "Administrator authorization required" }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Persistent asset storage is not configured" }, { status: 503 });
  }
  try {
    const form = await request.formData();
    const glb = form.get("glb");
    const preview = form.get("previewImage");
    const isModel = glb instanceof File;
    const file = isModel ? glb : preview;
    if (!(file instanceof File) || (isModel && preview instanceof File)) {
      return NextResponse.json({ error: "Provide one GLB or preview image" }, { status: 400 });
    }
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const mime = isModel ? "model/gltf-binary" : IMAGE_TYPES[ext];
    if ((isModel && ext !== ".glb") || !mime) {
      return NextResponse.json({ error: isModel ? "Model must be .glb" : "Unsupported preview image type" }, { status: 400 });
    }
    const limit = isModel ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size === 0 || file.size > limit) {
      return NextResponse.json({ error: "File empty or exceeds size limit" }, { status: 400 });
    }
    const slug = String(form.get("slug") || "asset").replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
    const filename = `${slug}-${randomUUID()}${ext}`;
    const blobResponse = await fetch(`https://blob.vercel-storage.com/world-assets/${filename}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        "x-api-version": "7",
        "x-content-type": mime,
        "x-add-random-suffix": "0",
      },
      body: Buffer.from(await file.arrayBuffer()),
    });
    if (!blobResponse.ok) throw new Error(`Blob upload HTTP ${blobResponse.status}`);
    const blobResult = await blobResponse.json() as { url?: string };
    if (!blobResult.url?.startsWith("https://")) throw new Error("Blob upload did not return a URL");
    const url = blobResult.url;
    return NextResponse.json(isModel ? { ok: true, modelUrl: url } : { ok: true, previewImageUrl: url });
  } catch (error) {
    console.error("[admin world-assets upload]", error);
    return NextResponse.json({ error: "Persistent upload failed; inspect server logs" }, { status: 502 });
  }
}
