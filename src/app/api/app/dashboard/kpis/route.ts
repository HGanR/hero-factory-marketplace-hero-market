import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";

function getCurrentUser(req: NextRequest): { userId?: number } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ? { userId: decoded.userId } : null;
}

export async function GET(req: NextRequest) {
  const user = getCurrentUser(req);
  if (!user?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureCrmTables();
    const db = await getDb();
    const uid = user.userId;

    const [contacts7d] = (await db.execute(sql`
      SELECT COUNT(*) as c FROM crm_contacts
      WHERE userId = ${uid} AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `)) as any;
    const contactCount = Array.isArray(contacts7d) ? contacts7d[0]?.c ?? 0 : (contacts7d as any)?.c ?? 0;

    const [oppCount] = (await db.execute(sql`
      SELECT COUNT(*) as c FROM crm_opportunities o
      JOIN crm_pipelines p ON o.pipelineId = p.id
      WHERE p.userId = ${uid}
    `)) as any;
    const openOpps = Array.isArray(oppCount) ? oppCount[0]?.c ?? 0 : (oppCount as any)?.c ?? 0;

    const [pipeValue] = (await db.execute(sql`
      SELECT COALESCE(SUM(o.value), 0) as v FROM crm_opportunities o
      JOIN crm_pipelines p ON o.pipelineId = p.id
      WHERE p.userId = ${uid}
    `)) as any;
    const value = Array.isArray(pipeValue) ? Number(pipeValue[0]?.v ?? 0) : Number((pipeValue as any)?.v ?? 0);

    const kpis = [
      { label: "New Leads (7d)", value: String(contactCount), hint: "Contacts created" },
      { label: "Appointments (7d)", value: "0", hint: "Booked + completed" },
      { label: "Open Opportunities", value: String(openOpps), hint: "Pipeline items" },
      { label: "Pipeline Value", value: `$${Math.round(value).toLocaleString()}`, hint: "Open amount" },
    ];
    return NextResponse.json({ kpis });
  } catch (err) {
    console.error("dashboard kpis error:", err);
    return NextResponse.json(
      { kpis: [
        { label: "New Leads (7d)", value: "0", hint: "Contacts created" },
        { label: "Appointments (7d)", value: "0", hint: "Booked + completed" },
        { label: "Open Opportunities", value: "0", hint: "Pipeline items" },
        { label: "Pipeline Value", value: "$0", hint: "Open amount" },
      ] },
    );
  }
}
