import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { oasisPlacements } from "@/lib/db/schema";
import { ensureOasisPlacementTables } from "@/lib/oasis/ensure";

function toDecimal(value: unknown, fallback = 0): string {
  const num = typeof value === "number" ? value : Number(value);
  return String(Number.isFinite(num) ? num : fallback);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ spaceId: string; placementId: string }> }
) {
  const { spaceId, placementId } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, any> = {};
  if (body?.kind !== undefined) patch.kind = body.kind ? String(body.kind) : null;
  if (body?.elementId !== undefined) patch.elementId = typeof body.elementId === "number" ? body.elementId : null;
  if (body?.elementKey !== undefined) patch.elementKey = body.elementKey ? String(body.elementKey) : null;
  if (body?.name !== undefined) patch.name = body.name ? String(body.name) : null;
  if (body?.modelUrl !== undefined) patch.modelUrl = body.modelUrl ? String(body.modelUrl) : null;
  if (body?.metadata !== undefined) patch.metadata = body.metadata ?? null;
  if (body?.x !== undefined) patch.x = toDecimal(body.x, 0);
  if (body?.y !== undefined) patch.y = toDecimal(body.y, 0);
  if (body?.z !== undefined) patch.z = toDecimal(body.z, 0);
  if (body?.ry !== undefined) patch.ry = toDecimal(body.ry, 0);
  if (body?.scale !== undefined) patch.scale = toDecimal(body.scale, 1);

  const db = await getDb();
  await ensureOasisPlacementTables(db);

  await db
    .update(oasisPlacements)
    .set(patch)
    .where(and(eq(oasisPlacements.id, placementId), eq(oasisPlacements.spaceId, spaceId)));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ spaceId: string; placementId: string }> }
) {
  const { spaceId, placementId } = await params;
  const db = await getDb();
  await ensureOasisPlacementTables(db);

  await db
    .delete(oasisPlacements)
    .where(and(eq(oasisPlacements.id, placementId), eq(oasisPlacements.spaceId, spaceId)));

  return NextResponse.json({ ok: true });
}
