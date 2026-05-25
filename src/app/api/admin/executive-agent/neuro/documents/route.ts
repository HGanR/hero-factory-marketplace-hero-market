import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { listNeuroDocuments } from "@/lib/executive-agent/neuro/neuro-store";
import { isNeuroAssignedAgent, isNeuroSubjectArea } from "@/lib/executive-agent/neuro/neuro-types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const subjectRaw = sp.get("subjectArea");
  const agentRaw = sp.get("assignedAgent");
  const subjectArea = subjectRaw && isNeuroSubjectArea(subjectRaw) ? subjectRaw : undefined;
  const assignedAgent = agentRaw && isNeuroAssignedAgent(agentRaw) ? agentRaw : undefined;

  const db = await getDb();
  const documents = await listNeuroDocuments(db, adminUserId, { subjectArea, assignedAgent });
  return NextResponse.json({ ok: true, documents });
}
