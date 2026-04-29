/**
 * POST /api/admin/troo-world/elements/seed
 * Seeds default scenery (trees, lights, benches, crosswalks) matching WorldTerrain.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trooWorldElements } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

const DEFAULT_WORLD_ID = "default";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) throw new Error("Unauthorized");
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) throw new Error("Forbidden");
}

const DEFAULT_SEED = [
  // Trees (x, z) - rotY in degrees
  ...([[-70, 9], [-50, 9], [-30, 9], [-10, 9], [10, 9], [30, 9], [50, 9], [70, 9],
    [-70, -9], [-50, -9], [-30, -9], [-10, -9], [10, -9], [30, -9], [50, -9], [70, -9],
    [-65, -35], [-60, -55], [-50, -60], [-40, -55], [-45, -38],
    [60, 40], [70, -40], [-60, 40], [80, 20], [-80, -20],
    [40, 60], [-40, 60], [40, -60], [-40, -60],
    [0, 70], [0, -70]] as [number, number][]).map(([x, z]) => ({ type: "tree" as const, posX: x, posY: 0, posZ: z, rotY: 0, scale: 1 })),
  // Street lights
  ...([[-60, 8], [-40, 8], [-20, 8], [0, 8], [20, 8], [40, 8], [60, 8],
    [-60, -8], [-40, -8], [-20, -8], [0, -8], [20, -8], [40, -8], [60, -8]] as [number, number][]).map(([x, z]) => ({ type: "street_light" as const, posX: x, posY: 0, posZ: z, rotY: 0, scale: 1 })),
  // Benches (x, z, rotY degrees)
  { type: "bench" as const, posX: -45, posY: 0, posZ: 12, rotY: 0, scale: 1 },
  { type: "bench" as const, posX: 45, posY: 0, posZ: 12, rotY: 0, scale: 1 },
  { type: "bench" as const, posX: -45, posY: 0, posZ: -12, rotY: 0, scale: 1 },
  { type: "bench" as const, posX: 45, posY: 0, posZ: -12, rotY: 0, scale: 1 },
  { type: "bench" as const, posX: -55, posY: 0, posZ: -40, rotY: 45, scale: 1 },
  { type: "bench" as const, posX: -45, posY: 0, posZ: -55, rotY: -45, scale: 1 },
  // Crosswalks (cx, cz, rotY degrees)
  { type: "crosswalk" as const, posX: -8, posY: 0, posZ: 0, rotY: 90, scale: 1 },
  { type: "crosswalk" as const, posX: 8, posY: 0, posZ: 0, rotY: 90, scale: 1 },
  { type: "crosswalk" as const, posX: 0, posY: 0, posZ: -8, rotY: 0, scale: 1 },
  { type: "crosswalk" as const, posX: 0, posY: 0, posZ: 8, rotY: 0, scale: 1 },
];

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const worldId = request.nextUrl.searchParams.get("worldId") ?? DEFAULT_WORLD_ID;

    const existing = await db.select({ id: trooWorldElements.id }).from(trooWorldElements).where(eq(trooWorldElements.worldId, worldId));
    if (existing.length > 0) {
      return NextResponse.json({ error: "Elements already exist. Delete all first to re-seed.", count: existing.length }, { status: 400 });
    }

    await db.insert(trooWorldElements).values(
      DEFAULT_SEED.map((el) => ({
        worldId,
        type: el.type,
        posX: String(el.posX),
        posY: String(el.posY),
        posZ: String(el.posZ),
        rotY: String(el.rotY),
        scale: String(el.scale),
        isDefault: true,
      }))
    );

    const inserted = await db.select().from(trooWorldElements).where(eq(trooWorldElements.worldId, worldId));
    return NextResponse.json({
      success: true,
      count: inserted.length,
      elements: inserted.map((e) => ({
        id: e.id,
        type: e.type,
        posX: Number(e.posX),
        posY: Number(e.posY),
        posZ: Number(e.posZ),
        rotY: Number(e.rotY),
        scale: Number(e.scale),
        isDefault: e.isDefault,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("[admin troo-world elements seed]", e);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
