import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { runWorkflow } from "@/lib/agent-maps/workflow-runner";

/** POST: Run workflow from a trigger node. Auth required. */
export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const body = await req.json().catch(() => ({}));
    const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId.trim() : null;
    const triggerNodeId = typeof body?.triggerNodeId === "string" ? body.triggerNodeId.trim() : null;
    const payload = (typeof body?.payload === "object" && body.payload !== null ? body.payload : {}) as Record<string, unknown>;

    if (!workspaceId || !triggerNodeId) {
      return NextResponse.json({ error: "workspaceId and triggerNodeId required" }, { status: 400 });
    }

    const result = await runWorkflow(userId, workspaceId, triggerNodeId, payload);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agent-maps run error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
