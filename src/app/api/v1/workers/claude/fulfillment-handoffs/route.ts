import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { submitClaudeFulfillmentHandoff } from "@/lib/fulfillment/claude-handoff-service";
import { authenticateClaudeWorkerRequest } from "@/lib/workers/claude-worker-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/workers/claude/fulfillment-handoffs
 * Claude worker submits paid WEBSITE handoff after admin_manual payment confirmation.
 * No paywall, no PayPal webhook, no auto-fulfillment.
 */
export async function POST(req: NextRequest) {
  const worker = await authenticateClaudeWorkerRequest(req);
  if (!worker) {
    return NextResponse.json({ error: "invalid_worker_key", code: "invalid_worker_key" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "invalid_payload" }, { status: 400 });
  }

  const idempotencyKey = req.headers.get("idempotency-key")?.trim() || null;
  const db = await getDb();
  const result = await submitClaudeFulfillmentHandoff(db, {
    worker,
    body,
    idempotencyKey,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      handoffId: result.handoffId,
      fulfillmentOrderId: result.handoffId,
      stage: result.stage,
      assignedDepartment: result.assignedDepartment,
      payment: {
        confirmationId: result.paymentConfirmationId,
        consumed: true,
      },
      deliverable: {
        id: result.deliverableId,
        status: "pending_department_draft",
      },
      executive: {
        ownerAdminUserId: worker.ownerAdminUserId,
        nextStep: "awaiting_owner_routing",
      },
    },
    { status: 201 }
  );
}
