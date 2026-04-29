import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { randomUUID } from "crypto";

function getCurrentUser(req: NextRequest): { userId: number } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ? { userId: decoded.userId as number } : null;
}

export async function GET(req: NextRequest) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureCrmTables();
    const db = await getDb();

    const rows = (await db.execute(sql`
      SELECT a.id, a.name, a.isActive, a.createdAt,
        (SELECT type FROM crm_automation_triggers t WHERE t.automationId = a.id LIMIT 1) as triggerType,
        (SELECT COUNT(*) FROM crm_automation_steps s WHERE s.automationId = a.id) as stepCount
      FROM crm_automations a
      WHERE a.userId = ${user.userId}
      ORDER BY a.createdAt DESC
    `)) as any;

    const arr = Array.isArray(rows) ? rows : rows?.rows ?? rows;
    const automations = (Array.isArray(arr) ? arr : []).map((r: any) => ({
      id: r.id,
      name: r.name ?? "Automation",
      isActive: !!r.isActive,
      triggerType: r.triggerType ?? null,
      stepCount: Number(r.stepCount ?? 0),
      createdAt: r.createdAt ?? null,
    }));

    return NextResponse.json({ automations });
  } catch (err) {
    console.error("automations GET error:", err);
    return NextResponse.json({ error: "Failed to list automations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name: string; triggerType?: string; steps?: Array<{ type: string; config?: Record<string, unknown> }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const triggerType = body.triggerType ? String(body.triggerType).trim() : "contact_created";
  const steps = Array.isArray(body?.steps) ? body.steps : [{ type: "create_task", config: { title: "Follow up" } }];

  try {
    await ensureCrmTables();
    const db = await getDb();
    const id = randomUUID();

    await db.execute(sql`INSERT INTO crm_automations (id, userId, name) VALUES (${id}, ${user.userId}, ${name})`);
    await db.execute(sql`
      INSERT INTO crm_automation_triggers (id, automationId, type) VALUES (${randomUUID()}, ${id}, ${triggerType})
    `);

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const stepId = randomUUID();
      const config = s?.config ? JSON.stringify(s.config) : null;
      await db.execute(sql`
        INSERT INTO crm_automation_steps (id, automationId, sortOrder, type, config)
        VALUES (${stepId}, ${id}, ${i}, ${String(s?.type ?? "create_task")}, ${config})
      `);
    }

    return NextResponse.json({
      automation: { id, name, isActive: true, triggerType, stepCount: steps.length },
    }, { status: 201 });
  } catch (err) {
    console.error("automations POST error:", err);
    return NextResponse.json({ error: "Failed to create automation" }, { status: 500 });
  }
}
