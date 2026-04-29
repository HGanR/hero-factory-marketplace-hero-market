/**
 * POST /api/apps/install — Install app for user (scope: world | entity | dashboard | agent)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformApps, userInstalledApps } from "@/lib/db/schema.apps";
import { getAuthedUserId } from "@/lib/api/auth";
import { emitPlatformEvent } from "@/lib/workflow-engine/emit-platform-event";
import crypto from "crypto";

function generateId(): string {
  return crypto.randomUUID();
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: {
      appId?: string;
      slug?: string;
      scope: string;
      worldId?: string;
      entityId?: string;
      agentId?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const scope = body.scope ?? "dashboard";
    const validScopes = ["world", "entity", "dashboard", "agent"];
    if (!validScopes.includes(scope)) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const db = await getDb();

    let appId = body.appId;
    if (!appId && body.slug) {
      const [app] = await db
        .select({ id: platformApps.id })
        .from(platformApps)
        .where(eq(platformApps.slug, body.slug))
        .limit(1);
      appId = app?.id;
    }
    if (!appId) return NextResponse.json({ error: "App ID or slug required" }, { status: 400 });

    const [app] = await db
      .select()
      .from(platformApps)
      .where(and(eq(platformApps.id, appId), eq(platformApps.status, "published")))
      .limit(1);
    if (!app) return NextResponse.json({ error: "App not found or not published" }, { status: 404 });

    if (app.creatorId === userId) {
      return NextResponse.json({ error: "Cannot install your own app" }, { status: 400 });
    }

    const existingConditions = [
      eq(userInstalledApps.userId, userId),
      eq(userInstalledApps.appId, appId),
      eq(userInstalledApps.scope, scope),
    ];
    if (scope === "world" && body.worldId) {
      existingConditions.push(eq(userInstalledApps.worldId, body.worldId));
    }
    if (scope === "entity" && body.entityId) {
      existingConditions.push(eq(userInstalledApps.entityId, body.entityId));
    }

    const [existing] = await db
      .select()
      .from(userInstalledApps)
      .where(and(...existingConditions))
      .limit(1);

    if (existing) {
      return NextResponse.json({
        success: true,
        installed: existing.id,
        message: "Already installed",
      });
    }

    const id = generateId();
    await db.insert(userInstalledApps).values({
      id,
      userId,
      appId,
      scope: scope as "world" | "entity" | "dashboard" | "agent",
      worldId: scope === "world" ? body.worldId ?? null : null,
      entityId: scope === "entity" ? body.entityId ?? null : null,
      agentId: scope === "agent" ? body.agentId ?? null : null,
    });

    await db
      .update(platformApps)
      .set({ installCount: (app.installCount ?? 0) + 1 })
      .where(eq(platformApps.id, appId));

    try {
      await emitPlatformEvent(
        "app_installed",
        {
          appId,
          appSlug: app.slug,
          appName: app.name,
          userId,
          scope,
          worldId: body.worldId,
          entityId: body.entityId,
        },
        userId
      );
    } catch {
      // Don't fail install if event fails
    }

    return NextResponse.json({
      success: true,
      installed: id,
      app: { id: app.id, slug: app.slug, name: app.name },
    });
  } catch (e) {
    console.error("[api/apps/install POST]", e);
    return NextResponse.json({ error: "Failed to install app" }, { status: 500 });
  }
}
