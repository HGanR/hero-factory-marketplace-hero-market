import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { insertExecutiveApproval } from "@/lib/executive-agent/executive-agent-approvals-store";
import { isWriteAction } from "@/lib/executive-agent/executive-agent-policy";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  clientId: z.string().uuid(),
  note: z.string().trim().min(1).max(50_000),
  recommendationId: z.string().trim().max(128).optional(),
  proposedAction: z.literal("createTodo").default("createTodo"),
});

/**
 * Queues a `createTodo` approval only — no CRM writes until an explicit approve endpoint runs.
 */
export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { clientId, note, recommendationId, proposedAction } = parsed.data;
  if (!isWriteAction(proposedAction)) {
    return NextResponse.json({ error: "UNSUPPORTED_ACTION" }, { status: 400 });
  }
  const payload = { clientId, note };
  const approvalId = randomUUID();
  try {
    const db = await getDb();
    await insertExecutiveApproval(db, {
      id: approvalId,
      adminUserId,
      proposedAction,
      targetType: "client",
      targetId: clientId,
      payloadJson: JSON.stringify({ ...payload, recommendationId: recommendationId ?? null }).slice(0, 100_000),
    });
    await insertExecutiveAgentAuditLog(db, {
      id: randomUUID(),
      adminUserId,
      prompt: recommendationId ? `follow_up_recommendation:${recommendationId}` : "follow_up_recommendation",
      toolName: "follow_up_recommendations.queue",
      actionType: "write_proposal",
      targetType: "approval_queue",
      targetId: approvalId,
      inputJson: JSON.stringify({ clientId, recommendationId: recommendationId ?? null }).slice(0, 50_000),
      outputJson: null,
      approvalStatus: "pending",
    });
    return NextResponse.json({ ok: true, approvalId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "QUEUE_FAILED", message: msg }, { status: 500 });
  }
}
