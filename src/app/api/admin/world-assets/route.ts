/**
 * Admin API for World Library Assets
 * POST: Create asset | GET: List all assets (including draft)
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { worldLibraryAssets } from "@/lib/db/schema.worlds";
import {engineRouteActor,requireSameOrigin} from '@/lib/security/engine-route-access';
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

async function requireAdmin(req:NextRequest):Promise<boolean>{
  try{return (await engineRouteActor(req)).admin}catch{return false}
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "asset";
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    const rows = await db.select().from(worldLibraryAssets).orderBy(desc(worldLibraryAssets.createdAt));
    return NextResponse.json({ assets: rows });
  } catch (e) {
    console.error("[admin world-assets GET]", e);
    return NextResponse.json({ error: "Failed to load assets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try{requireSameOrigin(req)}catch{return NextResponse.json({error:"Same-origin request required"},{status:403})}
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const slug = slugify(String(body?.slug ?? name) || "asset");
    const category = String(body?.category ?? "props").trim() || "props";
    const description = String(body?.description ?? "").trim() || null;
    const modelUrl = String(body?.modelUrl ?? "").trim();
    const previewImageUrl = String(body?.previewImageUrl ?? "").trim() || null;
    const manifestUrl = String(body?.manifestUrl ?? "").trim() || null;
    const tokenPrice = Math.max(0, Number(body?.tokenPrice ?? 0) || 0);
    const supplyLimit = body?.supplyLimit != null ? Number(body.supplyLimit) : null;
    const status = ["draft", "published", "archived"].includes(String(body?.status ?? "draft"))
      ? (body.status as "draft" | "published" | "archived")
      : "draft";

    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!modelUrl) return NextResponse.json({ error: "modelUrl is required" }, { status: 400 });

    const db = await getDb();

    // Check slug uniqueness
    const [existing] = await db
      .select()
      .from(worldLibraryAssets)
      .where(eq(worldLibraryAssets.slug, slug))
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: `Slug "${slug}" already exists` }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await db.insert(worldLibraryAssets).values({
      id,
      slug,
      name,
      category,
      description,
      status,
      modelUrl,
      previewImageUrl,
      manifestUrl,
      tokenPrice,
      supplyLimit,
      isPlatformOnly: false,
      isActive: true,
    });

    return NextResponse.json({ success: true, id, slug }, { status: 201 });
  } catch (e) {
    console.error("[admin world-assets POST]", e);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}

