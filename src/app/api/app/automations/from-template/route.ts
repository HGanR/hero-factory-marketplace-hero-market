import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { ensureCrmTables } from "@/lib/db/crm-ensure";

function getCurrentUser(req: NextRequest): { userId: number } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ? { userId: decoded.userId as number } : null;
}

/** Templates for one-click automations */
const AUTOMATION_TEMPLATES: Record<
  string,
  { name: string; triggerType: string; steps: Array<{ type: string; config?: Record<string, unknown> }> }
> = {
  launch_high_ticket_offer: {
    name: "Launch High-Ticket Offer",
    triggerType: "offer_created",
    steps: [
      {
        type: "create_task",
        config: {
          titleTemplate: "Review new offer: {{payload.offerName}}",
          description: "New offer created. Review and generate assets.",
          priority: "high",
        },
      },
    ],
  },
};

/** Create an automation from a template. */
export async function POST(req: NextRequest) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { templateId?: string };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const templateId = String(body?.templateId ?? "").trim();
  const template = templateId ? AUTOMATION_TEMPLATES[templateId] : null;
  if (!template) {
    return NextResponse.json(
      { error: "Unknown template. Available: launch_high_ticket_offer" },
      { status: 400 }
    );
  }

  try {
    await ensureCrmTables();
    const db = await getDb();
    const id = randomUUID();

    await db.execute(sql`INSERT INTO crm_automations (id, userId, name) VALUES (${id}, ${user.userId}, ${template.name})`);
    await db.execute(sql`
      INSERT INTO crm_automation_triggers (id, automationId, type) VALUES (${randomUUID()}, ${id}, ${template.triggerType})
    `);

    for (let i = 0; i < template.steps.length; i++) {
      const s = template.steps[i];
      const stepId = randomUUID();
      const config = s?.config ? JSON.stringify(s.config) : null;
      await db.execute(sql`
        INSERT INTO crm_automation_steps (id, automationId, sortOrder, type, config)
        VALUES (${stepId}, ${id}, ${i}, ${String(s?.type ?? "create_task")}, ${config})
      `);
    }

    return NextResponse.json({
      automation: {
        id,
        name: template.name,
        isActive: true,
        triggerType: template.triggerType,
        stepCount: template.steps.length,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("automations from-template POST error:", err);
    return NextResponse.json({ error: "Failed to create automation" }, { status: 500 });
  }
}
