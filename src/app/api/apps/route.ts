/**
 * GET /api/apps — List published apps (marketplace)
 * POST /api/apps — Create app (creator, authenticated)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformApps } from "@/lib/db/schema.apps";
import { getAuthedUserId } from "@/lib/api/auth";
import { emitPlatformEvent } from "@/lib/workflow-engine/emit-platform-event";
import crypto from "crypto";

function generateId(): string {
  return crypto.randomUUID();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get("category");
    const scope = searchParams.get("scope"); // "public" | "my"

    const db = await getDb();
    const userId = await getAuthedUserId();

    if (scope === "my") {
      if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      let query = db
        .select()
        .from(platformApps)
        .where(eq(platformApps.creatorId, userId))
        .orderBy(desc(platformApps.updatedAt));
      const rows = await query;
      return NextResponse.json({
        apps: rows.map((a) => ({
          id: a.id,
          slug: a.slug,
          name: a.name,
          description: a.description,
          category: a.category,
          creatorId: a.creatorId,
          version: a.version,
          priceToken: a.priceToken,
          priceUSD: a.priceUSD,
          revenueShare: a.revenueShare,
          installCount: a.installCount,
          status: a.status,
          createdAt: a.createdAt?.toISOString(),
          updatedAt: a.updatedAt?.toISOString(),
        })),
      });
    }

    // Public: published apps only
    const conditions = [eq(platformApps.status, "published")];
    if (category) conditions.push(eq(platformApps.category, category));

    const rows = await db
      .select()
      .from(platformApps)
      .where(and(...conditions))
      .orderBy(desc(platformApps.installCount), desc(platformApps.updatedAt))
      .limit(50);

    return NextResponse.json({
      apps: rows.map((a) => ({
        id: a.id,
        slug: a.slug,
        name: a.name,
        description: a.description,
        category: a.category,
        creatorId: a.creatorId,
        version: a.version,
        priceToken: a.priceToken,
        priceUSD: a.priceUSD,
        revenueShare: a.revenueShare,
        installCount: a.installCount,
        status: a.status,
        createdAt: a.createdAt?.toISOString(),
        updatedAt: a.updatedAt?.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[api/apps GET]", e);
    return NextResponse.json({ error: "Failed to load apps" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { name?: string; description?: string; category?: string; slug?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = String(body.name ?? "My App").slice(0, 120);
    const slug = body.slug ? slugify(body.slug) : slugify(name) + "-" + Date.now().toString(36);
    const category = String(body.category ?? "Business").slice(0, 60);
    const description = body.description ?? null;

    const db = await getDb();

    const [existing] = await db
      .select()
      .from(platformApps)
      .where(eq(platformApps.slug, slug))
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 400 });
    }

    const id = generateId();
    await db.insert(platformApps).values({
      id,
      slug,
      name,
      description,
      category,
      creatorId: userId,
      version: 1,
      priceToken: null,
      priceUSD: null,
      revenueShare: null,
      installCount: 0,
      status: "draft",
    });

    return NextResponse.json({
      success: true,
      app: {
        id,
        slug,
        name,
        description,
        category,
        creatorId: userId,
        version: 1,
        status: "draft",
        createdAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[api/apps POST]", e);
    return NextResponse.json({ error: "Failed to create app" }, { status: 500 });
  }
}
