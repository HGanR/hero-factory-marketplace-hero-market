/**
 * Admin API for Troo World elements.
 * GET: list elements
 * POST: add element
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

const VALID_TYPES = [
  "plain", "tree", "tree_cluster", "bush", "flower_bed", "grass_patch",
  "street_light", "bench", "trash_bin", "bollard",
  "road_segment", "road_cross", "road_arm", "crosswalk", "sidewalk_tile", "curb_strip",
  "fountain", "plaza_pad", "planter_box", "steps", "wall_segment", "fence_segment",
  "lake", "pond", "river_segment", "roundabout",
  "ground_patch", "gravel_patch", "glb_import",
] as const;

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const worldId = request.nextUrl.searchParams.get("worldId") ?? DEFAULT_WORLD_ID;

    const elements = await db.select().from(trooWorldElements).where(eq(trooWorldElements.worldId, worldId));

    return NextResponse.json({
      elements: elements.map((e) => ({
        id: e.id,
        type: e.type,
        posX: Number(e.posX),
        posY: Number(e.posY),
        posZ: Number(e.posZ),
        rotY: Number(e.rotY),
        scale: Number(e.scale),
        colorHex: e.colorHex,
        color2Hex: e.color2Hex,
        label: e.label,
        isDefault: e.isDefault,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[admin troo-world elements GET]", e);
    return NextResponse.json({ error: "Failed to load elements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const body = await request.json();
    const { worldId = DEFAULT_WORLD_ID, type, posX = 0, posY = 0, posZ = 0, rotY = 0, scale = 1, colorHex, color2Hex, label } = body as {
      worldId?: string;
      type: string;
      posX?: number;
      posY?: number;
      posZ?: number;
      rotY?: number;
      scale?: number;
      colorHex?: number | null;
      color2Hex?: number | null;
      label?: string | null;
    };

    if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
    }

    await db.insert(trooWorldElements).values({
      worldId,
      type: type as (typeof VALID_TYPES)[number],
      posX: String(Number(posX) || 0),
      posY: String(Number(posY) || 0),
      posZ: String(Number(posZ) || 0),
      rotY: String(Number(rotY) || 0),
      scale: String(Number(scale) ?? 1),
      colorHex: colorHex ?? null,
      color2Hex: color2Hex ?? null,
      label: label ?? null,
      isDefault: false,
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[admin troo-world elements POST]", e);
    return NextResponse.json({ error: "Failed to add element" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const body = await request.json();
    const { worldId = DEFAULT_WORLD_ID, elements } = body as {
      worldId?: string;
      elements: Array<{
        type: string;
        posX?: number;
        posY?: number;
        posZ?: number;
        rotY?: number;
        scale?: number;
        colorHex?: number | null;
        color2Hex?: number | null;
        label?: string | null;
      }>;
    };

    if (!Array.isArray(elements)) {
      return NextResponse.json({ error: "elements must be an array" }, { status: 400 });
    }

    // Delete all existing elements for this world
    await db.delete(trooWorldElements).where(eq(trooWorldElements.worldId, worldId));

    // Insert all new elements
    for (const el of elements) {
      if (!VALID_TYPES.includes(el.type as (typeof VALID_TYPES)[number])) {
        continue;
      }
      await db.insert(trooWorldElements).values({
        worldId,
        type: el.type as (typeof VALID_TYPES)[number],
        posX: String(Number(el.posX) || 0),
        posY: String(Number(el.posY) || 0),
        posZ: String(Number(el.posZ) || 0),
        rotY: String(Number(el.rotY) || 0),
        scale: String(Number(el.scale) ?? 1),
        colorHex: el.colorHex ?? null,
        color2Hex: el.color2Hex ?? null,
        label: el.label ?? null,
        isDefault: false,
      });
    }

    return NextResponse.json({ success: true, message: "Elements saved" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[admin troo-world elements PUT]", e);
    return NextResponse.json({ error: "Failed to save elements" }, { status: 500 });
  }
}
