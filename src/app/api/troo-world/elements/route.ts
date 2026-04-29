/**
 * GET /api/troo-world/elements
 * Returns world elements for the default/active Troo World.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trooWorldElements } from "@/lib/db/schema";

const DEFAULT_WORLD_ID = "default";

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const worldId = request.nextUrl.searchParams.get("worldId") ?? DEFAULT_WORLD_ID;

    const elements = await db
      .select()
      .from(trooWorldElements)
      .where(eq(trooWorldElements.worldId, worldId));

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
    const err = e as { errno?: number; message?: string };
    if (err?.errno === 1146 || err?.message?.includes("doesn't exist")) {
      return NextResponse.json({ elements: [] });
    }
    console.error("[troo-world elements]", e);
    return NextResponse.json({ error: "Failed to load elements" }, { status: 500 });
  }
}
