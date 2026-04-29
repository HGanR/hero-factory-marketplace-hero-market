import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import {
  computeBentleyAutonomyReadiness,
  type BentleyAutonomyReadinessInput,
} from "@/lib/revenue-os/bentley-autonomy-readiness";
import { fetchBentleyAutonomyServerFacts } from "@/lib/revenue-os/bentley-autonomy-readiness-server";
import { evaluateBentleyOperationalIssues } from "@/lib/revenue-os/bentley-operational-blockers";
import { fetchBentleyOperationalRawFacts } from "@/lib/revenue-os/bentley-operational-readiness-server";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";
import { defaultWorkflowState, type BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

export async function POST(req: NextRequest) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;

  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { clientId?: string; workflow?: BentleyWorkflowState };
  try {
    body = (await req.json()) as { clientId?: string; workflow?: BentleyWorkflowState };
  } catch {
    body = {};
  }

  const clientId = body.clientId?.trim() ?? "";
  const workflow = body.workflow ?? defaultWorkflowState();

  let server: BentleyAutonomyReadinessInput["server"];
  try {
    const facts = await fetchBentleyAutonomyServerFacts({
      userId: String(userId),
      clientId,
    });
    server = {
      campaignCount: facts.campaignCount,
      postsForLatestCampaign: facts.postsForLatestCampaign,
      deploymentFeedbackRows: facts.deploymentFeedbackRows,
      optimizationRunsCount: facts.optimizationRunsCount,
      governanceAuditRows: facts.governanceAuditRows,
    };
    if (clientId) {
      const raw = await fetchBentleyOperationalRawFacts({
        userId: String(userId),
        clientId,
        campaignId: workflow.artifacts.bentleyDbCampaignId?.trim() ?? null,
      });
      if (raw) {
        const ev = evaluateBentleyOperationalIssues({
          posts: raw.posts,
          socialPlatformsConnected: raw.socialPlatformsConnected,
          ambiguousSocialPlatforms: raw.ambiguousSocialPlatforms,
          workerRequiresApproval: readScheduledPublishRequireApprovalEnv(),
          deploymentFeedbackRows: facts.deploymentFeedbackRows,
          publishedPostCount: raw.campaignPublishedPostCount,
          earliestPostedAtIso: raw.earliestPostedAtIso,
          launchSyncedInSession: Boolean(workflow.artifacts.bentleyLaunchSyncedAt?.trim()),
        });
        server = {
          ...server,
          operational: {
            issueCodes: ev.codes,
            analyticsStatus: ev.analyticsDetail.status,
            analyticsReasonCode: ev.analyticsDetail.reasonCode,
            analyticsDetail: ev.analyticsDetail.detail,
            connectedPlatforms: raw.socialPlatformsConnected,
          },
        };
      }
    }
  } catch (e) {
    console.warn("[autonomy-readiness] server facts failed", e);
    server = undefined;
  }

  const report = computeBentleyAutonomyReadiness({
    signedIn: true,
    workflow,
    server,
  });

  return NextResponse.json({ ok: true, report, server });
}
