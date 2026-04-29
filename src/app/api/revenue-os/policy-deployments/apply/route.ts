import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { applyBentleyPolicyChangeSet } from "@/lib/revenue-os/policy-deployment";
import { writePolicyChangeSetAudit } from "@/lib/revenue-os/policy-deployment-audit";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  changeSetId: z.string().min(1),
  confirm: z.literal(true),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-deployments/apply", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const uid = String(userId);
    const body = BodySchema.parse(await req.json().catch(() => ({})));

    const res = await applyBentleyPolicyChangeSet({
      userId: uid,
      changeSetId: body.changeSetId.trim(),
      confirm: body.confirm,
    });

    const auditType =
      res.changeSetStatus === "partially_applied"
        ? "policy_change_set_partial_failure"
        : res.ok
          ? "policy_change_set_applied"
          : "policy_change_set_failed";
    await writePolicyChangeSetAudit({
      userId: uid,
      actionType: auditType,
      changeSetId: body.changeSetId.trim(),
      runId: res.runId,
      result: {
        applied: res.applied,
        failed: res.failed,
        skipped: res.skipped,
        errors: res.errors,
      },
    });

    return NextResponse.json(res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
