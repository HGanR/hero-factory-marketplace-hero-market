import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { rejectBentleyApprovalRequest } from "@/lib/revenue-os/autonomous-approval-queue";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  approvalRequestId: z.string().min(1).max(36),
  reviewNote: z.string().max(2000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/autonomous/approval-requests/reject", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const uid = String(userId);
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const r = await rejectBentleyApprovalRequest({
      userId: uid,
      approvalRequestId: parsed.approvalRequestId,
      reviewedByUserId: uid,
      reviewNote: parsed.reviewNote ?? null,
    });
    return NextResponse.json({ ok: r.ok, result: r });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
