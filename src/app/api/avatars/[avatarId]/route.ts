/**
 * GET /api/avatars/[avatarId] — Get single avatar
 * PATCH /api/avatars/[avatarId] — Update avatar
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { avatarProfiles } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ avatarId: string }> }
) {
  try {
    const userId = await getAuthedUserId();
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { avatarId } = await params;
    const db = await getDb();

    const [row] = await db
      .select()
      .from(avatarProfiles)
      .where(and(eq(avatarProfiles.id, avatarId), eq(avatarProfiles.userId, userId)))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      userId: row.userId,
      displayName: row.displayName,
      avatarModelUrl: row.avatarModelUrl,
      thumbnailUrl: row.thumbnailUrl,
      configJson: row.configJson ? JSON.parse(row.configJson) : null,
      sourceType: row.sourceType,
      version: row.version,
      isDefault: row.isDefault,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  } catch (e) {
    console.error("[avatars GET avatarId]", e);
    return NextResponse.json({ error: "Failed to load avatar" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ avatarId: string }> }
) {
  try {
    const userId = await getAuthedUserId();
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { avatarId } = await params;
    const db = await getDb();
    const body = await request.json().catch(() => ({}));

    const [existing] = await db
      .select()
      .from(avatarProfiles)
      .where(and(eq(avatarProfiles.id, avatarId), eq(avatarProfiles.userId, userId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    }

    const patch: Record<string, unknown> = {};
    if (body.displayName !== undefined) patch.displayName = body.displayName?.trim().slice(0, 120) ?? null;
    if (body.avatarModelUrl !== undefined) patch.avatarModelUrl = String(body.avatarModelUrl).trim().slice(0, 512);
    if (body.thumbnailUrl !== undefined) patch.thumbnailUrl = body.thumbnailUrl?.trim().slice(0, 512) ?? null;
    if (body.configJson !== undefined) patch.configJson = body.configJson ? JSON.stringify(body.configJson) : null;
    if (body.status !== undefined && ["draft", "ready"].includes(body.status)) patch.status = body.status;
    if (body.isDefault === true) {
      await db
        .update(avatarProfiles)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(avatarProfiles.userId, userId));
      patch.isDefault = true;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: true, message: "No changes" });
    }

    await db
      .update(avatarProfiles)
      .set({ ...patch, updatedAt: new Date() } as Record<string, unknown>)
      .where(eq(avatarProfiles.id, avatarId));

    return NextResponse.json({ success: true, message: "Avatar updated" });
  } catch (e) {
    console.error("[avatars PATCH avatarId]", e);
    return NextResponse.json({ error: "Failed to update avatar" }, { status: 500 });
  }
}
