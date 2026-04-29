/**
 * GET /api/app/building-agent/[apiKey]
 * Resolve the AI agent linked to a building by its API key.
 * Used by the building chat widget to fetch agent config.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { aiAgents, aiAgentBuildingBindings } from "@/lib/db/schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ apiKey: string }> }
) {
  try {
    const { apiKey } = await params;
    if (!apiKey) return NextResponse.json({ error: "apiKey required" }, { status: 400 });

    const db = await getDb();
    await ensureAgentTables();

    const [binding] = await db
      .select()
      .from(aiAgentBuildingBindings)
      .where(eq(aiAgentBuildingBindings.apiKey, apiKey))
      .limit(1);

    if (!binding || !binding.agentId) {
      return NextResponse.json({ error: "No agent linked to this building" }, { status: 404 });
    }

    const [agent] = await db
      .select({
        id: aiAgents.id,
        name: aiAgents.name,
        description: aiAgents.description,
        systemPrompt: aiAgents.systemPrompt,
        model: aiAgents.model,
        voiceProvider: aiAgents.voiceProvider,
        voiceId: aiAgents.voiceId,
      })
      .from(aiAgents)
      .where(and(eq(aiAgents.id, binding.agentId), eq(aiAgents.status, "active")))
      .limit(1);

    if (!agent) return NextResponse.json({ error: "Agent not found or inactive" }, { status: 404 });

    return NextResponse.json({
      agentId: agent.id,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      voiceProvider: agent.voiceProvider,
      voiceId: agent.voiceId,
      worldId: binding.worldId,
      buildingId: binding.buildingId,
    });
  } catch (e) {
    console.error("[api/app/building-agent GET]", e);
    return NextResponse.json({ error: "Failed to resolve agent" }, { status: 500 });
  }
}
