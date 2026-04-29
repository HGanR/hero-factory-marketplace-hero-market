/**
 * GET /api/apps/[slug] — Get app by slug (public if published)
 * PUT /api/apps/[slug] — Update app (creator only)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformApps } from "@/lib/db/schema.apps";
import { getAuthedUserId } from "@/lib/api/auth";
import { emitPlatformEvent } from "@/lib/workflow-engine/emit-platform-event";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const db = await getDb();
    const userId = await getAuthedUserId();

    const [app] = await db
      .select()
      .from(platformApps)
      .where(eq(platformApps.slug, slug))
      .limit(1);

    if (!app) return NextResponse.json({ error: "App not found" }, { status: 404 });

    const isCreator = userId !== null && app.creatorId === userId;
    if (!isCreator && app.status !== "published") {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    return NextResponse.json({
      app: {
        id: app.id,
        canEdit: isCreator,
        slug: app.slug,
        name: app.name,
        description: app.description,
        category: app.category,
        creatorId: app.creatorId,
        version: app.version,
        priceToken: app.priceToken,
        priceUSD: app.priceUSD,
        revenueShare: app.revenueShare,
        installCount: app.installCount,
        status: app.status,
        manifestJson: app.manifestJson,
        capabilitiesJson: app.capabilitiesJson,
        createdAt: app.createdAt?.toISOString(),
        updatedAt: app.updatedAt?.toISOString(),
      },
    });
  } catch (e) {
    console.error("[api/apps/[slug] GET]", e);
    return NextResponse.json({ error: "Failed to load app" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();
    const [app] = await db
      .select()
      .from(platformApps)
      .where(eq(platformApps.slug, slug))
      .limit(1);

    if (!app) return NextResponse.json({ error: "App not found" }, { status: 404 });
    if (app.creatorId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: {
      name?: string;
      description?: string;
      category?: string;
      priceToken?: number;
      priceUSD?: number;
      revenueShare?: number;
      status?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).slice(0, 120);
    if (body.description !== undefined) updates.description = body.description;
    if (body.category !== undefined) updates.category = String(body.category).slice(0, 60);
    if (body.priceToken !== undefined) updates.priceToken = body.priceToken;
    if (body.priceUSD !== undefined) updates.priceUSD = body.priceUSD;
    if (body.revenueShare !== undefined) updates.revenueShare = body.revenueShare;
    if (body.status !== undefined) {
      if (["draft", "published", "archived"].includes(body.status)) updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, app });
    }

    const wasDraft = app.status === "draft";
    const nowPublished = updates.status === "published";

    await db
      .update(platformApps)
      .set(updates as Record<string, string | number | null>)
      .where(eq(platformApps.id, app.id));

    if (wasDraft && nowPublished) {
      try {
        await emitPlatformEvent(
          "app_published",
          { appId: app.id, appSlug: app.slug, appName: app.name, creatorId: userId },
          userId
        );
      } catch {
        // Don't fail update if event fails
      }
    }

    const [updated] = await db
      .select()
      .from(platformApps)
      .where(eq(platformApps.id, app.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      app: updated
        ? {
            id: updated.id,
            slug: updated.slug,
            name: updated.name,
            status: updated.status,
          }
        : null,
    });
  } catch (e) {
    console.error("[api/apps/[slug] PUT]", e);
    return NextResponse.json({ error: "Failed to update app" }, { status: 500 });
  }
}
