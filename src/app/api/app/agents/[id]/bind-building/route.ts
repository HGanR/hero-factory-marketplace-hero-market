/**
 * POST /api/app/agents/[id]/bind-building
 * Link an AI agent to a building using the building's API key.
 * Body: { apiKey: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { aiAgentBuildingBindings } from "@/lib/db/schema";
import { canAccessAgent } from "@/lib/agents/agent-access";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id: agentId } = await params;
    if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) return NextResponse.json({ error: "apiKey required" }, { status: 400 });

    const db = await getDb();
    await ensureAgentTables();

    const canAccess = await canAccessAgent(agentId, userId);
    if (!canAccess) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const [binding] = await db
      .select()
      .from(aiAgentBuildingBindings)
      .where(eq(aiAgentBuildingBindings.apiKey, apiKey))
      .limit(1);

    if (!binding) return NextResponse.json({ error: "Invalid API key" }, { status: 404 });
    if (binding.userId !== userId) {
      return NextResponse.json({ error: "API key belongs to another user" }, { status: 403 });
    }

    await db
      .update(aiAgentBuildingBindings)
      .set({ agentId, updatedAt: new Date() })
      .where(eq(aiAgentBuildingBindings.id, binding.id));

    return NextResponse.json({
      success: true,
      worldId: binding.worldId,
      buildingId: binding.buildingId,
      message: "Agent linked to building successfully.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agents bind-building POST error:", err);
    return NextResponse.json({ error: "Failed to link agent to building" }, { status: 500 });
  }
}
