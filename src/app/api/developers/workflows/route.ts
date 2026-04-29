/**
 * Workflow Automations
 * GET: List workflows for current user
 * POST: Create workflow
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workflowAutomations } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { v4 as uuidv4 } from "uuid";

const VALID_TRIGGERS = [
  "certificate_issued",
  "instrument_issued",
  "collateral_pledged",
  "proceeds_received",
  "entity_created",
  "accounting_event_processed",
];

const VALID_ACTIONS = [
  "create_accounting_entry",
  "send_notification",
  "generate_resolution",
  "publish_to_inbox",
];

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const workflows = await db
    .select()
    .from(workflowAutomations)
    .where(eq(workflowAutomations.userId, userId));

  return NextResponse.json({
    ok: true,
    workflows: workflows.map((w) => ({
      id: w.id,
      name: w.name,
      triggerEvent: w.triggerEvent,
      triggerFilter: w.triggerFilter,
      actions: w.actions,
      isActive: w.isActive,
      lastRunAt: w.lastRunAt?.toISOString(),
      runCount: w.runCount,
      createdAt: w.createdAt?.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name: string; triggerEvent: string; triggerFilter?: Record<string, unknown>; actions: Array<{ type: string; config?: Record<string, unknown> }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const triggerEvent = (body.triggerEvent ?? "").trim();
  if (!VALID_TRIGGERS.includes(triggerEvent)) {
    return NextResponse.json({ error: `triggerEvent must be one of: ${VALID_TRIGGERS.join(", ")}` }, { status: 400 });
  }

  const actions = Array.isArray(body.actions) ? body.actions : [];
  if (actions.length === 0) return NextResponse.json({ error: "actions array is required" }, { status: 400 });

  const invalidActions = actions.filter((a) => !VALID_ACTIONS.includes(a?.type));
  if (invalidActions.length) {
    return NextResponse.json({ error: `Invalid action types: ${invalidActions.map((a) => a?.type).join(", ")}` }, { status: 400 });
  }

  const id = uuidv4();

  const db = await getDb();
  await db.insert(workflowAutomations).values({
    id,
    userId,
    name,
    triggerEvent,
    triggerFilter: body.triggerFilter ?? null,
    actions: JSON.stringify(actions),
    isActive: true,
  });

  return NextResponse.json({
    ok: true,
    workflow: {
      id,
      name,
      triggerEvent,
      actions,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  });
}
