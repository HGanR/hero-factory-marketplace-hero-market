import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { routeAgentTaskForAdmin } from "@/lib/executive-agent/executive-agent-coordination-service";

export const dynamic = "force-dynamic";

const RouteTaskBodySchema = z.object({
  taskId: z.string().uuid(),
  targetAgentId: z.enum(["skipper", "bentley", "jarva", "eleanor", "reality"]),
  rationale: z.string().trim().min(1).max(2000),
  humanConfirmed: z.boolean().optional(),
});

/**
 * POST /api/admin/executive-agent/agents/route-task
 * Approval-aware agent task routing — queues delegation/escalation approval when humanConfirmed.
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

  const parsed = RouteTaskBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = await getDb();
  const result = await routeAgentTaskForAdmin(db, {
    adminUserId,
    ...parsed.data,
  });

  if ("httpStatus" in result && !("routingId" in result)) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json(result);
}
