/**
 * Optional GrowthGuidance one-liners for Bentley policy deployment orchestration.
 */

import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";
import {
  getBentleyLatestPolicyDeployment,
  summarizeBentleyPolicyDeploymentHistory,
  describeRollbackLinkageForChangeSet,
} from "@/lib/revenue-os/policy-deployment-history";

export async function buildDeploymentGuidanceLines(input: { userId: string }): Promise<{
  bentleyDeploymentHistorySummaryLine?: string;
  bentleyLatestDeploymentOutcomeLine?: string;
  bentleyLinkedRollbackAvailabilityLine?: string;
}> {
  const uid = String(input.userId).trim();
  if (!uid) return {};

  const hist = await summarizeBentleyPolicyDeploymentHistory({ userId: uid, lookback: 20 });
  const bentleyDeploymentHistorySummaryLine =
    hist.lines[0]?.slice(0, 420) ??
    (hist.recentSuccessful + hist.recentFailures + hist.recentPartialApplies === 0
      ? undefined
      : `Deployments — ok ${hist.recentSuccessful}, failed ${hist.recentFailures}, partial ${hist.recentPartialApplies}.`.slice(
          0,
          420
        ));

  const latest = await getBentleyLatestPolicyDeployment({ userId: uid });
  let bentleyLatestDeploymentOutcomeLine: string | undefined;
  if (latest) {
    const st = latest.changeSet.status;
    const famHint = ` (${latest.changeSet.changeSetType})`;
    bentleyLatestDeploymentOutcomeLine =
      st === "completed"
        ? `Latest coordinated deployment completed${famHint}.`.slice(0, 420)
        : st === "partially_applied"
          ? `Latest deployment partially applied — review failed policy rows${famHint}.`.slice(0, 420)
          : st === "failed"
            ? `Latest coordinated deployment did not fully succeed${famHint}.`.slice(0, 420)
            : `Latest change set "${latest.changeSet.name.slice(0, 60)}" is ${st}.`.slice(0, 420);
  }

  let bentleyLinkedRollbackAvailabilityLine: string | undefined;
  if (latest?.changeSet.id) {
    const link = await describeRollbackLinkageForChangeSet({ userId: uid, changeSetId: latest.changeSet.id });
    bentleyLinkedRollbackAvailabilityLine = link.line.slice(0, 420);
  }

  return {
    bentleyDeploymentHistorySummaryLine,
    bentleyLatestDeploymentOutcomeLine,
    bentleyLinkedRollbackAvailabilityLine,
  };
}

export function mergeDeploymentGuidanceIntoGrowthGuidance(
  base: GrowthGuidance | null,
  lines: Awaited<ReturnType<typeof buildDeploymentGuidanceLines>>
): GrowthGuidance | null {
  const has =
    lines.bentleyDeploymentHistorySummaryLine ||
    lines.bentleyLatestDeploymentOutcomeLine ||
    lines.bentleyLinkedRollbackAvailabilityLine;
  if (!base && !has) return null;

  const next: GrowthGuidance = base
    ? { ...base }
    : {
        recommendedNextMove: "Review coordinated policy deployments before changing live policies.",
        why: "",
        risingTopics: [],
        weakAngles: [],
        bestHookDirection: "",
      };

  next.bentleyDeploymentHistorySummaryLine =
    lines.bentleyDeploymentHistorySummaryLine ?? next.bentleyDeploymentHistorySummaryLine;
  next.bentleyLatestDeploymentOutcomeLine =
    lines.bentleyLatestDeploymentOutcomeLine ?? next.bentleyLatestDeploymentOutcomeLine;
  next.bentleyLinkedRollbackAvailabilityLine =
    lines.bentleyLinkedRollbackAvailabilityLine ?? next.bentleyLinkedRollbackAvailabilityLine;

  return next;
}
