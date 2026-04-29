/**
 * DELETE /api/worlds/[worldId]/links/[linkId] — Remove world link (owner only)
 */
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds, worldLinks } from "@/lib/db/schema.worlds";
import { getAuthedUserId } from "@/lib/api/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ worldId: string; linkId: string }> }
) {
  try {
    const { worldId, linkId } = await params;
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();
    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });
    if (world.ownerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [link] = await db
      .select()
      .from(worldLinks)
      .where(and(eq(worldLinks.id, linkId), eq(worldLinks.fromWorldId, worldId)))
      .limit(1);
    if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });

    await db.delete(worldLinks).where(eq(worldLinks.id, linkId));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[api/worlds/[worldId]/links/[linkId] DELETE]", e);
    return NextResponse.json({ error: "Failed to delete link" }, { status: 500 });
  }
}
