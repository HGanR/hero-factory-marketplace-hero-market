import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { canAccessAgent } from "@/lib/agents/agent-access";
import { getAgentRuntimeDiagnostics } from "@/lib/agents/agent-runtime-diagnostics";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/** Owner-scoped runtime diagnostics for AI Agency Test Chat / capability strip. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id: agentId } = await params;
    if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

    const ok = await canAccessAgent(agentId, userId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const diagnostics = await getAgentRuntimeDiagnostics(agentId, userId);
    if (!diagnostics) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(diagnostics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("runtime-diagnostics GET error:", err);
    return NextResponse.json({ error: "Failed to load diagnostics" }, { status: 500 });
  }
}
