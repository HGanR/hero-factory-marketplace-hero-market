/**
 * Policy + context evaluation for autonomous actions.
 */

import type { AutonomousPolicyRow } from "@/lib/revenue-os/autonomous-policies-db";
import type { BentleyAutonomousCandidate } from "@/lib/revenue-os/autonomous-candidates";

export type BentleyAutonomousDecisionOutcome = "auto_execute" | "require_approval" | "escalate_only" | "skip";

export type EvaluateBentleyAutonomousThresholdsResult = {
  outcome: BentleyAutonomousDecisionOutcome;
  severity: "info" | "warning" | "critical";
  rationale: string[];
  confidenceScore: number;
};

function candidateSeverity(c: BentleyAutonomousCandidate): "info" | "warning" | "critical" {
  if (c.riskLevel === "critical") return "critical";
  if (c.riskLevel === "high" || c.riskLevel === "medium") return "warning";
  return "info";
}

function severityRank(s: "info" | "warning" | "critical"): number {
  return s === "critical" ? 2 : s === "warning" ? 1 : 0;
}

function policyApprovalThresholdRank(policy: AutonomousPolicyRow | null): number {
  const t = (policy?.requiresApprovalAboveSeverity ?? "none").toLowerCase();
  if (t === "none" || t === "") return -1;
  if (t === "info") return 0;
  if (t === "warning") return 1;
  if (t === "critical") return 2;
  return -1;
}

function scopeMatchesPolicy(
  candidate: BentleyAutonomousCandidate,
  policy: AutonomousPolicyRow | null
): boolean {
  if (!policy) return false;
  const pc = policy.clientId ?? "";
  const pt = policy.trustId ?? "";
  if (pc === "" && pt === "") return true;
  return candidate.scope.clientId === pc && candidate.scope.trustId === pt;
}

export type EvaluateBentleyAutonomousThresholdsInput = {
  candidate: BentleyAutonomousCandidate;
  policy: AutonomousPolicyRow | null;
  context: {
    hasOpenBlockingIssue: boolean;
    connectorReady: boolean;
    recentFailuresForTarget: number;
    executionsToday: number;
    policyCooldownActive: boolean;
    workspacePriorityRank?: number;
  };
};

export function evaluateBentleyAutonomousThresholds(
  input: EvaluateBentleyAutonomousThresholdsInput
): EvaluateBentleyAutonomousThresholdsResult {
  const { candidate, policy, context } = input;
  const rationale: string[] = [];
  const severity = candidateSeverity(candidate);
  const confidenceScore = Math.max(0, Math.min(1, candidate.confidence));

  const minConf =
    typeof policy?.policyConfigJson === "object" &&
    policy.policyConfigJson &&
    "minConfidence" in policy.policyConfigJson
      ? Number((policy.policyConfigJson as Record<string, unknown>).minConfidence)
      : Number.NaN;
  if (Number.isFinite(minConf) && confidenceScore < minConf) {
    rationale.push(`Confidence ${confidenceScore.toFixed(2)} below policy minimum ${minConf}.`);
    return { outcome: "skip", severity, rationale, confidenceScore };
  }

  if (!policy || !policy.isEnabled) {
    rationale.push("No enabled autonomous policy for this action type and scope.");
    return { outcome: "skip", severity, rationale, confidenceScore };
  }

  if (!scopeMatchesPolicy(candidate, policy)) {
    rationale.push("Policy scope does not match candidate workspace.");
    return { outcome: "skip", severity, rationale, confidenceScore };
  }

  if (policy.actionType !== candidate.actionType) {
    rationale.push("Policy action type mismatch.");
    return { outcome: "skip", severity, rationale, confidenceScore };
  }

  if (context.policyCooldownActive) {
    rationale.push("Policy cooldown window active — skip autonomous execution.");
    return { outcome: "skip", severity, rationale, confidenceScore };
  }

  if (policy.maxDailyExecutions != null && policy.maxDailyExecutions >= 0) {
    if (context.executionsToday >= policy.maxDailyExecutions) {
      rationale.push(`Daily execution cap (${policy.maxDailyExecutions}) reached.`);
      return { outcome: "skip", severity, rationale, confidenceScore };
    }
  }

  if (
    candidate.actionType === "auto_retry_failed_publish" &&
    !context.connectorReady &&
    context.recentFailuresForTarget >= 2
  ) {
    rationale.push("Connector not ready and repeated failures — escalate instead of blind retry.");
    return { outcome: "escalate_only", severity, rationale, confidenceScore };
  }

  if (context.hasOpenBlockingIssue && candidate.actionType === "auto_create_lead_handoff") {
    rationale.push("Blocking operational issue present — hold automatic handoff creation.");
    return { outcome: "escalate_only", severity: "critical", rationale, confidenceScore };
  }

  const appr = policyApprovalThresholdRank(policy);
  const candR = severityRank(severity);
  if (appr >= 0 && candR >= appr) {
    rationale.push(
      `Candidate severity ${severity} meets or exceeds approval threshold (${policy.requiresApprovalAboveSeverity}).`
    );
    return { outcome: "require_approval", severity, rationale, confidenceScore };
  }

  rationale.push("Within policy thresholds for autonomous execution.");
  return { outcome: "auto_execute", severity, rationale, confidenceScore };
}
