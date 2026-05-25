import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { searchNeuroSources } from "@/lib/executive-agent/neuro/neuro-search-service";
import { isNeuroAssignedAgent, isNeuroSubjectArea } from "@/lib/executive-agent/neuro/neuro-types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const subjectRaw = sp.get("subject") ?? sp.get("subjectArea");
  const agentRaw = sp.get("agent") ?? sp.get("assignedAgent");
  const subjectArea = subjectRaw && isNeuroSubjectArea(subjectRaw) ? subjectRaw : null;
  const assignedAgent = agentRaw && isNeuroAssignedAgent(agentRaw) ? agentRaw : null;

  const db = await getDb();
  const result = await searchNeuroSources(db, {
    adminUserId,
    query: q,
    subjectArea,
    assignedAgent,
  });
  return NextResponse.json({ ok: true, ...result });
}
