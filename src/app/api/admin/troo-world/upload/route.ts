/**
 * POST /api/admin/troo-world/upload
 * Accepts a GLB file, stores in public/models/troo-world/, returns glbUrl.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) throw new Error("Unauthorized");
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) throw new Error("Forbidden");
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const form = await request.formData();
    const glb = form.get("glb") as File | null;
    const elementKey = String(form.get("elementKey") || "").trim() || null;

    if (!glb || !(glb instanceof File)) {
      return NextResponse.json({ error: "Missing glb file" }, { status: 400 });
    }

    if (!glb.name.toLowerCase().endsWith(".glb")) {
      return NextResponse.json({ error: "File must be a .glb" }, { status: 400 });
    }

    const arrayBuffer = await glb.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const id = elementKey?.replace(/[^a-z0-9_-]/gi, "_") || randomUUID().slice(0, 8);
    const outDir = path.join(process.cwd(), "public", "models", "troo-world");
    await fs.mkdir(outDir, { recursive: true });

    const baseName = `${id}.glb`;
    const glbPath = path.join(outDir, baseName);
    await fs.writeFile(glbPath, Buffer.from(arrayBuffer));

    const glbUrl = `/models/troo-world/${baseName}`;

    return NextResponse.json({
      ok: true,
      glbUrl,
      elementKey: elementKey || id,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[admin troo-world upload]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
