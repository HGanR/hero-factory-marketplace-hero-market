import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { governanceUnauthorizedResponse } from "@/lib/revenue-os/campaign-governance-http-response";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";
import { resolvePublishApprovalActor } from "@/lib/revenue-os/resolve-publish-approval-actor";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * GET /api/revenue-os/publish-approval-settings
 * Read-only: worker gate + current approval actor (for governance UI/debug).
 */
export async function GET() {
  const __rosGate = await enforceRevenueOsApiAccess();
  if (__rosGate) return __rosGate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return governanceUnauthorizedResponse();
  }

  const actor = await resolvePublishApprovalActor({ campaignOwnerUserId: null });

  return NextResponse.json({
    workerRequiresApproval: readScheduledPublishRequireApprovalEnv(),
    approvalActor: {
      userId: actor.userId,
      label: actor.label,
      role: actor.role,
      identityBacked: actor.identityBacked,
    },
  });
}
