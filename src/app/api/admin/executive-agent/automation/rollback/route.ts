import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { rollbackGovernedAutomationForAdmin } from "@/lib/executive-agent/executive-automation-service";

export const dynamic = "force-dynamic";

const RollbackBodySchema = z.object({
  executionAuditId: z.string().uuid(),
  rationale: z.string().trim().min(1).max(2000),
});

/**
 * POST /api/admin/executive-agent/automation/rollback
 * Reversible operational rollback for prior governed automation executions.
 */
export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = RollbackBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = await getDb();
  const result = await rollbackGovernedAutomationForAdmin(db, {
    adminUserId,
    ...parsed.data,
  });

  if ("httpStatus" in result && !("rollbackId" in result)) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json(result);
}
