import crypto from "crypto";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
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

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    await ensureEntityMapsTable(db);
    const maps = await db
      .select({
        id: entityMaps.id,
        title: entityMaps.title,
        updatedAt: entityMaps.updatedAt,
      })
      .from(entityMaps)
      .where(eq(entityMaps.userId, userId))
      .orderBy(desc(entityMaps.updatedAt));
    return NextResponse.json({ maps });
  } catch (error) {
    console.error("entity-maps GET failed", error);
    return NextResponse.json({ error: "Failed to list entity maps" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = EntityMapUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const db = await getDb();
    await ensureEntityMapsTable(db);
    await db.insert(entityMaps).values({
      id,
      userId,
      title: parsed.data.title.trim(),
      nodesJson: JSON.stringify(parsed.data.nodes),
      edgesJson: JSON.stringify(parsed.data.edges),
    });

    const [created] = await db
      .select()
      .from(entityMaps)
      .where(eq(entityMaps.id, id))
      .limit(1);

    return NextResponse.json({
      id,
      title: created?.title ?? parsed.data.title,
      nodes: safeJsonParse(created?.nodesJson ?? "[]") ?? [],
      edges: safeJsonParse(created?.edgesJson ?? "[]") ?? [],
      updatedAt: created?.updatedAt ?? null,
    });
  } catch (error) {
    console.error("entity-maps POST failed", error);
    return NextResponse.json({ error: "Failed to create entity map" }, { status: 500 });
  }
}
