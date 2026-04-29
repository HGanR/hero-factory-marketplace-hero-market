import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { retryRun } from "@/lib/automations/runner";

function getCurrentUser(req: NextRequest): { userId: number } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ? { userId: decoded.userId as number } : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: automationId, runId } = await params;
  if (!automationId || !runId) return NextResponse.json({ error: "Missing id or runId" }, { status: 400 });

  let body: { stepId?: string };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  try {
    await ensureCrmTables();
    const db = await getDb();

    const [runRow] = (await db.execute(sql`
      SELECT r.id FROM crm_automation_runs r
      JOIN crm_automations a ON a.id = r.automationId AND a.userId = ${user.userId}
      WHERE r.id = ${runId} AND r.automationId = ${automationId}
    `)) as any;
    const run = Array.isArray(runRow) ? runRow[0] : runRow?.rows?.[0] ?? runRow;
    if (!run?.id) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const result = await retryRun(db, runId, user.userId, body.stepId);

    return NextResponse.json({ success: result.success, runId: result.runId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Retry failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
