import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { runAgentTest } from "@/lib/agents/run-agent-test";

type Params = { params: Promise<{ id: string }> };

/** Test chat: owner sends message, gets LLM reply. Requires auth. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id: agentId } = await params;
    if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });
    const debugRetrieval = body?.debugRetrieval === true;

    const priorMessages = body?.history;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : null;

    const result = await runAgentTest(userId, agentId, message, debugRetrieval, priorMessages, sessionId);

    const json: {
      reply: string;
      debug?: { selectedChunks: { id: string; score: number; preview: string }[] };
      telemetry?: unknown;
    } = { reply: result.reply };
    if (debugRetrieval && result.debug?.selectedChunks) {
      json.debug = { selectedChunks: result.debug.selectedChunks };
    }
    if (result.telemetry) json.telemetry = result.telemetry;

    return NextResponse.json(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agents test POST error:", err);
    return NextResponse.json({ error: "Failed to test agent" }, { status: 500 });
  }
}
