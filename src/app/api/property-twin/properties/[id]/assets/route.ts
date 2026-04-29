import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ptCreateAsset, ptGetProperty, ptListAssets, ptCanAccessProperty } from "@/lib/property-twin/queries";
import { propertyTwinRequireAuth } from "@/lib/property-twin/auth-guard";

export const runtime = "nodejs";

const KINDS = new Set(["exterior", "interior", "landscape", "video", "floor_plan"]);

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;

    const propertyId = Number((await ctx.params).id);
    if (!Number.isFinite(propertyId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const prop = await ptGetProperty(propertyId);
    if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ok = await ptCanAccessProperty(propertyId, auth.userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rows = await ptListAssets(propertyId);
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[property-twin/assets GET]", e);
    return NextResponse.json({ error: "Failed to list assets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;

    const propertyId = Number((await ctx.params).id);
    if (!Number.isFinite(propertyId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const prop = await ptGetProperty(propertyId);
    if (!prop) return NextResponse.json({ error: "Property not found" }, { status: 404 });
    const ok = await ptCanAccessProperty(propertyId, auth.userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const form = await req.formData();
    const file = form.get("file");
    const kindRaw = form.get("kind");
    if (!(file instanceof File) || typeof kindRaw !== "string") {
      return NextResponse.json({ error: "file and kind are required" }, { status: 400 });
    }
    if (!KINDS.has(kindRaw)) {
      return NextResponse.json({ error: "invalid kind" }, { status: 400 });
    }
    const kind = kindRaw as
      | "exterior"
      | "interior"
      | "landscape"
      | "video"
      | "floor_plan";

    const buf = Buffer.from(await file.arrayBuffer());
    const max = 25 * 1024 * 1024;
    if (buf.length > max) {
      return NextResponse.json({ error: "file too large (max 25MB)" }, { status: 400 });
    }

    const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "upload";
    const relDir = path.join("uploads", "property-twin", String(propertyId));
    const absDir = path.join(process.cwd(), "public", relDir);
    await mkdir(absDir, { recursive: true });
    const fname = `${randomUUID()}-${safe}`;
    const absPath = path.join(absDir, fname);
    await writeFile(absPath, buf);

    const publicUrl = `/${relDir.replace(/\\/g, "/")}/${fname}`;
    const row = await ptCreateAsset({
      propertyId,
      kind,
      url: publicUrl,
      mimeType: file.type || null,
      originalFilename: file.name,
      bytes: buf.length,
    });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[property-twin/assets POST]", e);
    return NextResponse.json({ error: "Failed to upload asset" }, { status: 500 });
  }
}
