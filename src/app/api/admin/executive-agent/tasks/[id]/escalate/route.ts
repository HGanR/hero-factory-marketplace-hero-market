import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { proposeOperationalTaskEscalation } from "@/lib/executive-agent/operator-coordination-service";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  targetOperatorId: z.string().trim().min(1).max(64).optional().nullable(),
  rationale: z.string().trim().min(1).max(2000),
  priority: z.enum(["normal", "high", "urgent"]).optional(),
});

/**
 * POST /api/admin/executive-agent/tasks/:id/escalate
 * Proposes escalateOperationalTask approval — no autonomous escalation execution.
 */
export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId } = await ctx.params;
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const db = await getDb();
  const result = await proposeOperationalTaskEscalation(db, {
    adminUserId,
    taskId,
    targetOperatorId: parsed.data.targetOperatorId,
    rationale: parsed.data.rationale,
    priority: parsed.data.priority,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        message: result.message,
        ...(result.approvalId ? { approvalId: result.approvalId } : {}),
      },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json({
    ok: true,
    approvalId: result.approvalId,
    taskId,
    targetOperatorId: result.targetOperatorId,
    proposedAction: "escalateOperationalTask",
    message: result.message,
  });
}
