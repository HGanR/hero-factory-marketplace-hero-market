import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { aiAgentKnowledgeItems } from "@/lib/db/schema";
import { canAccessAgent } from "@/lib/agents/agent-access";

type Params = { params: Promise<{ id: string; kid: string }> };

/** DELETE: Remove a knowledge item */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id: agentId, kid } = await params;
    if (!agentId || !kid) return NextResponse.json({ error: "agentId and kid required" }, { status: 400 });

    const canAccess = await canAccessAgent(agentId, userId);
    if (!canAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const db = await getDb();

    await db
      .delete(aiAgentKnowledgeItems)
      .where(
        and(
          eq(aiAgentKnowledgeItems.agentId, agentId),
          eq(aiAgentKnowledgeItems.id, kid)
      ));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agents knowledge DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
