import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { resumeExecutiveWorkflowForAdmin } from "@/lib/executive-agent/executive-workflow-service";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  workflowId: z.string().min(1).max(200),
  rationale: z.string().trim().min(1).max(2000),
  humanConfirmed: z.literal(true),
});

/** POST /api/admin/executive-agent/workflows/resume */
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const result = await resumeExecutiveWorkflowForAdmin(db, { adminUserId, ...parsed.data });

  if ("httpStatus" in result && !("auditId" in result)) {
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status: result.httpStatus });
  }

  return NextResponse.json(result);
}
