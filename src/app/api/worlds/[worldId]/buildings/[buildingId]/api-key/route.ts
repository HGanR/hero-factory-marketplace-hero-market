/**
 * POST /api/worlds/[worldId]/buildings/[buildingId]/api-key
 * Generate an API key for a building. Used to link an AI agent to this building.
 * The key is shown once; store it securely and paste it in the AI Agency to link your agent.
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { getAuthedUserId } from "@/lib/api/auth";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { aiAgentBuildingBindings } from "@/lib/db/schema";
import { worlds } from "@/lib/db/schema.worlds";
function generateApiKey(): string {
  return `bld_${crypto.randomBytes(24).toString("base64url")}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string; buildingId: string }> }
) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { worldId, buildingId } = await params;
    if (!worldId || !buildingId) {
      return NextResponse.json({ error: "worldId and buildingId required" }, { status: 400 });
    }

    const db = await getDb();
    await ensureAgentTables();

    // For user worlds, verify ownership. For platform worlds (green-terrain), allow any authenticated user.
    if (worldId !== "green-terrain") {
      const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
      if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });
      if (world.ownerId !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const existing = await db
      .select()
      .from(aiAgentBuildingBindings)
      .where(
        and(
          eq(aiAgentBuildingBindings.worldId, worldId),
          eq(aiAgentBuildingBindings.buildingId, buildingId),
          eq(aiAgentBuildingBindings.userId, userId)
        )
      )
      .limit(1);

    let apiKey: string;

    if (existing.length > 0) {
      apiKey = existing[0].apiKey;
    } else {
      apiKey = generateApiKey();
      const id = crypto.randomUUID();
      await db.insert(aiAgentBuildingBindings).values({
        id,
        worldId,
        buildingId,
        apiKey,
        userId,
      });
    }

    return NextResponse.json({
      success: true,
      apiKey,
      worldId,
      buildingId,
      message: "Copy this API key and paste it in the AI Agency to link your agent to this building.",
    });
  } catch (e) {
    console.error("[api/worlds/.../api-key POST]", e);
    return NextResponse.json({ error: "Failed to generate API key" }, { status: 500 });
  }
}
