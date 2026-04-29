/**
 * POST /api/admin/world-assets/upload
 * Accepts GLB and/or image files, stores in public/models/world-assets/ and public/images/world-assets/.
 * Returns { modelUrl?, previewImageUrl? }
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value || request.cookies.get("auth-token")?.value;
  if (!token) throw new Error("Unauthorized");
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin && !decoded?.userId) throw new Error("Forbidden");
}

const MAX_GLB_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const form = await request.formData();
    const glb = form.get("glb") as File | null;
    const previewImage = form.get("previewImage") as File | null;

    const result: { modelUrl?: string; previewImageUrl?: string } = {};

    if (glb && glb instanceof File) {
      if (!glb.name.toLowerCase().endsWith(".glb")) {
        return NextResponse.json({ error: "Model file must be .glb" }, { status: 400 });
      }
      const arrayBuffer = await glb.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_GLB_BYTES) {
        return NextResponse.json({ error: "Model file too large (max 50MB)" }, { status: 400 });
      }
      const slug = (form.get("slug") as string)?.trim()?.replace(/[^a-z0-9_-]/gi, "_") || randomUUID().slice(0, 8);
      const outDir = path.join(process.cwd(), "public", "models", "world-assets");
      await fs.mkdir(outDir, { recursive: true });
      const baseName = `${slug}.glb`;
      const glbPath = path.join(outDir, baseName);
      await fs.writeFile(glbPath, Buffer.from(arrayBuffer));
      result.modelUrl = `/models/world-assets/${baseName}`;
    }

    if (previewImage && previewImage instanceof File) {
      const ext = path.extname(previewImage.name).toLowerCase();
      if (!IMAGE_EXTS.includes(ext)) {
        return NextResponse.json({ error: "Preview must be JPG, PNG, WebP, or GIF" }, { status: 400 });
      }
      const arrayBuffer = await previewImage.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Preview image too large (max 5MB)" }, { status: 400 });
      }
      const slug = (form.get("slug") as string)?.trim()?.replace(/[^a-z0-9_-]/gi, "_") || randomUUID().slice(0, 8);
      const outDir = path.join(process.cwd(), "public", "images", "world-assets");
      await fs.mkdir(outDir, { recursive: true });
      const baseName = `${slug}${ext}`;
      const imgPath = path.join(outDir, baseName);
      await fs.writeFile(imgPath, Buffer.from(arrayBuffer));
      result.previewImageUrl = `/images/world-assets/${baseName}`;
    }

    if (!result.modelUrl && !result.previewImageUrl) {
      return NextResponse.json({ error: "Provide glb and/or previewImage file" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[admin world-assets upload]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
