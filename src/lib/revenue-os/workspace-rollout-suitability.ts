/**
 * Per-workspace suitability for Bentley policy rollout pilots vs defer.
 */

import type { OperatorWorkspaceSummary } from "@/lib/revenue-os/operator-types";

export type BentleyRolloutSuitabilityBand = "strong_pilot" | "acceptable_pilot" | "risky_for_rollout" | "avoid_for_now";

export type WorkspaceRolloutSuitability = {
  clientId: string;
  trustId: string;
  band: BentleyRolloutSuitabilityBand;
  score: number;
  rationale: string;
  factors: string[];
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Score a single workspace for staged policy rollout. Pure — uses operator summary fields only.
 */
export function scoreWorkspaceForBentleyRollout(ws: OperatorWorkspaceSummary): WorkspaceRolloutSuitability {
  const { workspace } = ws;
  const clientId = workspace.clientId ?? "";
  const trustId = workspace.trustId ?? "";

  let score = 50;
  const factors: string[] = [];

  const connectorReady = ws.connectorAutoPublishReady > 0 && ws.blockedConnectorTargets === 0;
  if (connectorReady) {
    score += 18;
    factors.push("Connector auto-publish ready with no blocked targets.");
  } else if (ws.blockedConnectorTargets > 0) {
    score -= 22;
    factors.push(`${ws.blockedConnectorTargets} blocked connector target(s) — rollout friction.`);
  }

  if (ws.failedCount > 0) {
    const pen = Math.min(28, ws.failedCount * 9);
    score -= pen;
    factors.push(`${ws.failedCount} recent publish failure(s) — stabilize before policy experiments.`);
  }

  const queuePressure = ws.draftCount + ws.staleBacklogCount;
  if (queuePressure > 15) {
    score -= 12;
    factors.push(`High queue pressure (${queuePressure} draft/stale items).`);
  } else if (queuePressure <= 5) {
    score += 6;
    factors.push("Queue depth is manageable for observing policy deltas.");
  }

  const approvalPressure = ws.approvedOrScheduledCount > 40 ? 1 : 0;
  if (ws.openHandoffs > 6 || ws.handoffReadyLeads > 8) {
    score -= 14;
    factors.push(
      `Lead handoff load (open ${ws.openHandoffs}, ready ${ws.handoffReadyLeads}) — avoid adding autonomy noise.`
    );
  } else if (approvalPressure === 0 && ws.openHandoffs <= 2) {
    score += 4;
    factors.push("Approval and handoff queues are relatively light.");
  }

  if (ws.healthScore < 45) {
    score -= 16;
    factors.push(`Workspace health ${ws.healthScore} — remediate before rollout.`);
  } else if (ws.healthScore >= 72) {
    score += 10;
    factors.push(`Healthy workspace score (${ws.healthScore}).`);
  }

  if (ws.lastCadenceRunAt) {
    score += 4;
    factors.push("Recent cadence activity present.");
  } else if (!ws.cadenceSummary) {
    factors.push("Limited cadence signal — monitor scheduler after changes.");
  }

  score = clamp(Math.round(score), 0, 100);

  let band: BentleyRolloutSuitabilityBand;
  if (score >= 78) band = "strong_pilot";
  else if (score >= 58) band = "acceptable_pilot";
  else if (score >= 38) band = "risky_for_rollout";
  else band = "avoid_for_now";

  const rationale =
    band === "strong_pilot"
      ? "Strong candidate — connectors and queue health support a controlled pilot."
      : band === "acceptable_pilot"
        ? "Acceptable pilot — watch failures and handoffs during the observation window."
        : band === "risky_for_rollout"
          ? "Risky — only use with extra guardrails or after stabilizing publishing and routing."
          : "Defer — stabilize execution and routing before introducing policy changes here.";

  return {
    clientId,
    trustId,
    band,
    score,
    rationale,
    factors: factors.length ? factors : ["Insufficient negative signals — default cautious pilot."],
  };
}
