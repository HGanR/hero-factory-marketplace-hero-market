/**
 * POST /api/avatars/[avatarId]/set-default — Set avatar as default
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { avatarProfiles } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function POST(
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

    const [existing] = await db
      .select({ id: avatarProfiles.id })
      .from(avatarProfiles)
      .where(and(eq(avatarProfiles.id, avatarId), eq(avatarProfiles.userId, userId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    }

    await db
      .update(avatarProfiles)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(avatarProfiles.userId, userId));

    await db
      .update(avatarProfiles)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(avatarProfiles.id, avatarId));

    return NextResponse.json({ success: true, message: "Default avatar set" });
  } catch (e) {
    console.error("[avatars set-default]", e);
    return NextResponse.json({ error: "Failed to set default avatar" }, { status: 500 });
  }
}
