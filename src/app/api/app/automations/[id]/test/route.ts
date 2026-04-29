import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { fireAutomation } from "@/lib/automations/runner";

function getCurrentUser(req: NextRequest): { userId: number } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ? { userId: decoded.userId as number } : null;
}

/** Manually trigger an automation for testing. Requires contactId for context. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: { contactId?: string; opportunityId?: string; metadata?: Record<string, unknown> };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const metadata = { ...(body.metadata ?? {}), manualTest: true };

  try {
    await ensureCrmTables();
    const db = await getDb();

    const [aRow] = (await db.execute(sql`
      SELECT id FROM crm_automations WHERE id = ${id} AND userId = ${user.userId}
    `)) as any;
    const a = Array.isArray(aRow) ? aRow[0] : aRow?.rows?.[0] ?? aRow;
    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [tRow] = (await db.execute(sql`
      SELECT type FROM crm_automation_triggers WHERE automationId = ${id} LIMIT 1
    `)) as any;
    const triggerType = Array.isArray(tRow) ? tRow[0]?.type : tRow?.rows?.[0]?.type ?? tRow?.type ?? "contact_created";

    const runIds = await fireAutomation(
      triggerType,
      {
        contactId: body.contactId ?? undefined,
        opportunityId: body.opportunityId ?? undefined,
        metadata,
      },
      { automationId: id, forceRun: true }
    );

    return NextResponse.json({ runIds, message: "Automation triggered" });
  } catch (err) {
    console.error("automations test error:", err);
    return NextResponse.json({ error: "Failed to run" }, { status: 500 });
  }
}
