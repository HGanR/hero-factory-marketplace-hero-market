import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { entityMaps } from "@/lib/db/schema";
import { ensureEntityMapsTable } from "@/lib/entity-maps/db";
import { EntityMapUpsertSchema } from "@/lib/entity-maps/schema";

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = await getDb();
    await ensureEntityMapsTable(db);
    const [map] = await db
      .select()
      .from(entityMaps)
      .where(and(eq(entityMaps.id, id), eq(entityMaps.userId, userId)))
      .limit(1);
    if (!map) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      id: map.id,
      title: map.title,
      nodes: safeJsonParse(map.nodesJson) ?? [],
      edges: safeJsonParse(map.edgesJson) ?? [],
      updatedAt: map.updatedAt,
    });
  } catch (error) {
    console.error("entity-maps/[id] GET failed", error);
    return NextResponse.json({ error: "Failed to load entity map" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = EntityMapUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const db = await getDb();
    await ensureEntityMapsTable(db);
    const [existing] = await db
      .select({ id: entityMaps.id })
      .from(entityMaps)
      .where(and(eq(entityMaps.id, id), eq(entityMaps.userId, userId)))
      .limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db
      .update(entityMaps)
      .set({
        title: parsed.data.title.trim(),
        nodesJson: JSON.stringify(parsed.data.nodes),
        edgesJson: JSON.stringify(parsed.data.edges),
      })
      .where(and(eq(entityMaps.id, id), eq(entityMaps.userId, userId)));

    return NextResponse.json({ id, ok: true });
  } catch (error) {
    console.error("entity-maps/[id] PUT failed", error);
    return NextResponse.json({ error: "Failed to update entity map" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = await getDb();
    await ensureEntityMapsTable(db);
    await db
      .delete(entityMaps)
      .where(and(eq(entityMaps.id, id), eq(entityMaps.userId, userId)));
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("entity-maps/[id] DELETE failed", error);
    return NextResponse.json({ error: "Failed to delete entity map" }, { status: 500 });
  }
}
