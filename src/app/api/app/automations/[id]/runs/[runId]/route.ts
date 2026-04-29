import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";

function getCurrentUser(req: NextRequest): { userId: number } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ? { userId: decoded.userId as number } : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: automationId, runId } = await params;
  if (!automationId || !runId) return NextResponse.json({ error: "Missing id or runId" }, { status: 400 });

  try {
    await ensureCrmTables();
    const db = await getDb();

    const [runRow] = (await db.execute(sql`
      SELECT r.id, r.automationId, r.contactId, r.status, r.triggeredAt, r.completedAt, r.metadata
      FROM crm_automation_runs r
      JOIN crm_automations a ON a.id = r.automationId AND a.userId = ${user.userId}
      WHERE r.id = ${runId} AND r.automationId = ${automationId}
    `)) as any;
    const run = Array.isArray(runRow) ? runRow[0] : runRow?.rows?.[0] ?? runRow;
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const runSteps = (await db.execute(sql`
      SELECT rs.stepId, rs.status, rs.result, rs.executedAt, s.sortOrder, s.type, s.config
      FROM crm_automation_run_steps rs
      JOIN crm_automation_steps s ON s.id = rs.stepId
      WHERE rs.runId = ${runId}
      ORDER BY s.sortOrder ASC
    `)) as any;
    const stepsArr = Array.isArray(runSteps) ? runSteps : runSteps?.rows ?? runSteps;

    const steps = (stepsArr ?? []).map((row: any) => ({
      stepId: row.stepId,
      type: row.type,
      config: typeof row.config === "string" ? (() => { try { return JSON.parse(row.config); } catch { return {}; } })() : (row.config ?? {}),
      status: row.status,
      result: typeof row.result === "string" ? (() => { try { return JSON.parse(row.result); } catch { return null; } })() : (row.result ?? null),
      executedAt: row.executedAt ?? null,
    }));

    return NextResponse.json({
      run: {
        id: run.id,
        automationId: run.automationId,
        contactId: run.contactId,
        status: run.status,
        triggeredAt: run.triggeredAt,
        completedAt: run.completedAt,
        metadata: typeof run.metadata === "string" ? (() => { try { return JSON.parse(run.metadata); } catch { return {}; } })() : (run.metadata ?? {}),
      },
      steps,
    });
  } catch (err) {
    console.error("automations run GET error:", err);
    return NextResponse.json({ error: "Failed to fetch run" }, { status: 500 });
  }
}
