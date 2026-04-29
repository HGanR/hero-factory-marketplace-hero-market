import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { upsertAgentSiteWidgetBindingFromHttpBody } from "@/lib/widget/upsert-agent-site-widget-binding";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id: agentId } = await params;
    if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const db = await getDb();
    await ensureAgentTables();

    const { widgetKey } = await upsertAgentSiteWidgetBindingFromHttpBody(db, userId, agentId, body);

    return NextResponse.json({ widgetKey });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "Agent not found") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "Site not found or access denied") return NextResponse.json({ error: msg }, { status: 403 });
    if (msg === "siteId required") return NextResponse.json({ error: msg }, { status: 400 });
    console.error("agents bind-site POST error:", err);
    return NextResponse.json({ error: "Failed to bind agent to site" }, { status: 500 });
  }
}
