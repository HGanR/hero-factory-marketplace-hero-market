/**
 * GET /api/avatars/default — Get current user's default avatar (for room entry)
 * Returns null if not authenticated or no default avatar.
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { avatarProfiles } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (userId === null) {
      return NextResponse.json({ avatar: null });
    }

    const db = await getDb();
    const [row] = await db
      .select()
      .from(avatarProfiles)
      .where(and(eq(avatarProfiles.userId, userId), eq(avatarProfiles.isDefault, true)))
      .limit(1);

    if (!row) {
      return NextResponse.json({ avatar: null });
    }

    return NextResponse.json({
      avatar: {
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
      },
    });
  } catch (e) {
    console.error("[avatars/default GET]", e);
    return NextResponse.json({ error: "Failed to load default avatar" }, { status: 500 });
  }
}
