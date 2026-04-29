/**
 * GET /api/avatars/me — List current user's avatars
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { avatarProfiles } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (userId === null) {
      return NextResponse.json({ avatars: [] });
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(avatarProfiles)
      .where(eq(avatarProfiles.userId, userId));

    return NextResponse.json({
      avatars: rows.map((r) => ({
        id: r.id,
        displayName: r.displayName,
        avatarModelUrl: r.avatarModelUrl,
        thumbnailUrl: r.thumbnailUrl,
        configJson: r.configJson ? JSON.parse(r.configJson) : null,
        sourceType: r.sourceType,
        version: r.version,
        isDefault: r.isDefault,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (e) {
    console.error("[avatars/me GET]", e);
    return NextResponse.json({ error: "Failed to load avatars" }, { status: 500 });
  }
}
