/**
 * Shared Bentley cadence execution (used by cadence API + operator command surface).
 */

import { fetchDistributionQueueState, fetchDistributionQueueTargetsForQueues } from "@/lib/revenue-os/distribution-queue-actions";
import { getConnectedPublishingProfiles, getPublishingCapabilityMatrix } from "@/lib/revenue-os/platform-connectors";
import { routeDistributionTargets } from "@/lib/revenue-os/distribution-routing";
import { analyzeExperimentPerformance } from "@/lib/revenue-os/experiment-analysis";
import { getExperimentPerformanceSummary } from "@/lib/revenue-os/experiment-results";
import { runBentleyCadenceEngine } from "@/lib/revenue-os/cadence-engine";
import { persistCadenceRun, persistCadenceQueueUpdates } from "@/lib/revenue-os/persist-cadence-actions";
import { getLeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";

export type BentleyCadenceRunType =
  | "daily_refresh"
  | "winner_promotion"
  | "retry_failed"
  | "stale_cleanup"
  | "retest_planning";

export async function executeBentleyCadenceRun(input: {
  userId: string;
  clientId: string;
  trustId: string;
  runType: BentleyCadenceRunType;
  dryRun: boolean;
}) {
  const uid = String(input.userId);
  const { clientId, trustId } = input;

  const queueItems = await fetchDistributionQueueState({
    userId: uid,
    clientId,
    trustId,
    limit: 120,
  });

  const leadSignalSummary = await getLeadSignalSummary({
    userId: uid,
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

  const run = await persistCadenceRun({
    userId: uid,
    clientId,
    trustId,
    runType: input.runType,
    plan,
    runStatus: "completed",
  });

  const updates = await persistCadenceQueueUpdates({
    userId: uid,
    clientId,
    trustId,
    plan,
    applyQueueMutations: !input.dryRun,
  });

  return {
    cadenceRunId: run.id,
    runPersisted: run.ok,
    queueUpdates: updates,
    plan,
  };
}
