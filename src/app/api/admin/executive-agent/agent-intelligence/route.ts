import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import {
  buildAgentIntelligenceResponse,
  filterAgentsByKeys,
  parseAgentKeysQuery,
} from "@/lib/executive-agent/agent-intelligence-bus";
import { loadAgentIntelligenceFromDatabase } from "@/lib/executive-agent/agent-intelligence-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const keys = parseAgentKeysQuery(searchParams.get("agents"));
  try {
    const db = await getDb();
    const loaded = await loadAgentIntelligenceFromDatabase(db);
    const agents = filterAgentsByKeys(loaded, keys);
    return NextResponse.json(buildAgentIntelligenceResponse(agents));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "AGENT_INTELLIGENCE_FAILED", message: msg }, { status: 500 });
  }
}
