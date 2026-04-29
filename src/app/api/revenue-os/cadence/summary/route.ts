import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { fetchDistributionQueueState, fetchDistributionQueueTargetsForQueues } from "@/lib/revenue-os/distribution-queue-actions";
import { getConnectedPublishingProfiles, getPublishingCapabilityMatrix } from "@/lib/revenue-os/platform-connectors";
import { routeDistributionTargets } from "@/lib/revenue-os/distribution-routing";
import { analyzeExperimentPerformance } from "@/lib/revenue-os/experiment-analysis";
import { getExperimentPerformanceSummary } from "@/lib/revenue-os/experiment-results";
import { runBentleyCadenceEngine } from "@/lib/revenue-os/cadence-engine";
import { fetchLatestCadenceRun } from "@/lib/revenue-os/persist-cadence-actions";
import { getLeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId")?.trim() ?? "";
    const trustId = searchParams.get("trustId")?.trim() ?? "";

    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({
        ok: true,
        authenticated: false,
        plan: null,
        latestRun: null,
        message: "Sign in to load cadence summary for this workspace.",
      });
    }

    const uid = String(userId);
    const queueItems = await fetchDistributionQueueState({
      userId: uid,
      clientId,
      trustId,
      limit: 120,
    });

    const leadSignalSummary = await getLeadSignalSummary({
      userId,
      clientId,
      trustId,
    });

    let connectorCoverageSummary = null;
    const routingBlockedQueueIds = new Set<string>();
    try {
      const profiles = await getConnectedPublishingProfiles({ userId: uid, clientId });
      const matrix = getPublishingCapabilityMatrix(profiles);
      const targets = await fetchDistributionQueueTargetsForQueues({
        queueIds: queueItems.map((q) => q.id),
      });
      const routing = routeDistributionTargets({
        distributionPlan: null,
        connectedProfiles: profiles,
        capabilityMatrix: matrix,
        queueItems,
        targets,
        publishingObjective: null,
      });
      connectorCoverageSummary = routing.connectorCoverageSummary;
      for (const rt of routing.routedTargets) {
        if (
          rt.routingStatus === "blocked_no_connector" ||
          rt.routingStatus === "blocked_capability_mismatch"
        ) {
          routingBlockedQueueIds.add(rt.queueId);
        }
      }
    } catch {
      /* optional */
    }

    let experimentAnalysis = null;
    const expIds = [...new Set(queueItems.map((q) => q.experimentId).filter(Boolean))] as string[];
    if (expIds.length) {
      const summary = await getExperimentPerformanceSummary(expIds[0]);
      if (summary?.variants.length) {
        experimentAnalysis = analyzeExperimentPerformance({
          variants: summary.variants.map((v) => ({
            variantKey: v.variantKey,
            hookType: v.hookType,
            angle: v.angle,
            ctaType: v.ctaType,
            score: v.score,
            views: v.views,
            leads: v.leads,
          })),
          experimentTheme: summary.experimentTheme,
        });
      }
    }

    const plan = runBentleyCadenceEngine({
      queueItems,
      experimentAnalysis,
      connectorCoverage: connectorCoverageSummary,
      leadSignalSummary: leadSignalSummary.totalSignals > 0 ? leadSignalSummary : null,
      intelligenceDiff: undefined,
      growthGuidance: undefined,
      platformsHint: [],
      routingBlockedQueueIds,
    });

    const latestRun = await fetchLatestCadenceRun({ userId: uid, clientId, trustId });

    return NextResponse.json({
      ok: true,
      authenticated: true,
      plan,
      latestRun,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
