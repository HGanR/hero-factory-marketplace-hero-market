import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { oasisPlacements, oasisWorldElements } from "@/lib/db/schema";
import { OASIS_HUB_SPACE_ID } from "@/lib/oasis/constants";
import { ensureOasisPlacementTables } from "@/lib/oasis/ensure";

function toDecimal(value: unknown, fallback = 0): string {
  const num = typeof value === "number" ? value : Number(value);
  return String(Number.isFinite(num) ? num : fallback);
}

const NEXUS_ASSET = "/models/nexus-tower/modern_building.glb";
const MERIDIAN_ASSET = "/models/meridian-tower/meridian_tower.glb";

async function ensureHubPlacements(db: Awaited<ReturnType<typeof getDb>>) {
  const existing = await db
    .select({ id: oasisPlacements.id })
    .from(oasisPlacements)
    .where(eq(oasisPlacements.spaceId, OASIS_HUB_SPACE_ID))
    .limit(1);
  if (existing.length > 0) return;

  const [nexus, meridian] = await Promise.all([
    db
      .select({ id: oasisWorldElements.id })
      .from(oasisWorldElements)
      .where(eq(oasisWorldElements.slug, "nexus-tower"))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ id: oasisWorldElements.id })
      .from(oasisWorldElements)
      .where(eq(oasisWorldElements.slug, "meridian-tower"))
      .limit(1)
      .then((r) => r[0]),
  ]);

  const toInsert: Array<{
    id: string;
    spaceId: string;
    kind: string;
    elementId: number | null;
    elementKey: string;
    name: string;
    modelUrl: string;
    x: string;
    y: string;
    z: string;
    ry: string;
    scale: string;
  }> = [
    {
      id: "nexus-tower-hub",
      spaceId: OASIS_HUB_SPACE_ID,
      kind: "db",
      elementId: nexus?.id ?? null,
      elementKey: "nexus-tower",
      name: "Nexus Tower",
      modelUrl: NEXUS_ASSET,
      x: "0",
      y: "0",
      z: "0",
      ry: "0",
      scale: "2",
    },
    {
      id: "meridian-tower-west",
      spaceId: OASIS_HUB_SPACE_ID,
      kind: "db",
      elementId: meridian?.id ?? null,
      elementKey: "meridian-tower",
      name: "Meridian Tower West",
      modelUrl: MERIDIAN_ASSET,
      x: "-12",
      y: "0",
      z: "0",
      ry: "0",
      scale: "2",
    },
    {
      id: "meridian-tower-east",
      spaceId: OASIS_HUB_SPACE_ID,
      kind: "db",
      elementId: meridian?.id ?? null,
      elementKey: "meridian-tower",
      name: "Meridian Tower East",
      modelUrl: MERIDIAN_ASSET,
      x: "12",
      y: "0",
      z: "0",
      ry: "0",
      scale: "2",
    },
  ];

  for (const row of toInsert) {
    await db.insert(oasisPlacements).values(row);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params;
  const db = await getDb();
  await ensureOasisPlacementTables(db);

  if (spaceId === OASIS_HUB_SPACE_ID) {
    try {
      await ensureHubPlacements(db);
    } catch (err) {
      console.error("oasis hub placement seed error:", err);
    }
  }

  let rows = await db
    .select()
    .from(oasisPlacements)
    .where(eq(oasisPlacements.spaceId, spaceId))
    .orderBy(desc(oasisPlacements.createdAt));

  // Migration: Meridian Tower now uses meridian_tower.glb (procedural export)
  rows = rows.map((r) => {
    const key = (r.elementKey ?? "").toLowerCase();
    const isMeridian = key === "meridian-tower" || (r.id ?? "").startsWith("meridian-tower-");
    const hasOldUrl = r.modelUrl?.includes("meridian-tower/modern_building");
    if (isMeridian && hasOldUrl) {
      return { ...r, modelUrl: MERIDIAN_ASSET };
    }
    return r;
  });

  return NextResponse.json({ placements: rows });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params;
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || `pl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

  const row = {
    id,
    spaceId,
    kind: body?.kind ? String(body.kind) : null,
    elementId: typeof body?.elementId === "number" ? body.elementId : null,
    elementKey: body?.elementKey ? String(body.elementKey) : null,
    name: body?.name ? String(body.name) : null,
    modelUrl: body?.modelUrl ? String(body.modelUrl) : null,
    metadata: body?.metadata ?? null,
    x: toDecimal(body?.x, 0),
    y: toDecimal(body?.y, 0),
    z: toDecimal(body?.z, 0),
    ry: toDecimal(body?.ry, 0),
    scale: toDecimal(body?.scale, 1),
  };

  const db = await getDb();
  await ensureOasisPlacementTables(db);
  await db.insert(oasisPlacements).values(row);

  return NextResponse.json({ placement: row });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params;
  const body = await req.json().catch(() => ({}));
  const list = Array.isArray(body?.placements) ? body.placements : [];

  const db = await getDb();
  await ensureOasisPlacementTables(db);
  await db.delete(oasisPlacements).where(eq(oasisPlacements.spaceId, spaceId));

  if (list.length) {
    const rows = list.map((p: any) => ({
      id: String(p?.id || `pl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`),
      spaceId,
      kind: p?.kind ? String(p.kind) : null,
      elementId: typeof p?.elementId === "number" ? p.elementId : null,
      elementKey: p?.elementKey ? String(p.elementKey) : null,
      name: p?.name ? String(p.name) : null,
      modelUrl: p?.modelUrl ? String(p.modelUrl) : null,
      metadata: p?.metadata ?? null,
      x: toDecimal(p?.x, 0),
      y: toDecimal(p?.y, 0),
      z: toDecimal(p?.z, 0),
      ry: toDecimal(p?.ry, 0),
      scale: toDecimal(p?.scale, 1),
    }));
    await db.insert(oasisPlacements).values(rows);
  }

  return NextResponse.json({ ok: true, count: list.length });
}
