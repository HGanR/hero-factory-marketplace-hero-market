import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { executeGovernedAutomationForAdmin } from "@/lib/executive-agent/executive-automation-service";

export const dynamic = "force-dynamic";

const ExecuteBodySchema = z.object({
  approvalId: z.string().uuid(),
  approvalSource: z.enum([
    "executive_dashboard",
    "automation_panel",
    "approval_api",
    "voice_command",
  ]),
  humanConfirmed: z.literal(true),
});

/**
 * POST /api/admin/executive-agent/automation/execute
 * Approval-gated governed operational automation — requires humanConfirmed.
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

  const parsed = ExecuteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = await getDb();
  const result = await executeGovernedAutomationForAdmin(db, {
    adminUserId,
    ...parsed.data,
  });

  if ("httpStatus" in result && !("executionId" in result)) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code, policyValidation: result.policyValidation },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json(result);
}
