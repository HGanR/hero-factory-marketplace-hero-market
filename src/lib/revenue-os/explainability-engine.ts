/**
 * Structured explanations for Bentley decisions — wraps existing evaluation logic without duplicating rules.
 */

import type { ConnectorRoutingStatus, RoutedTargetPlan } from "@/lib/revenue-os/distribution-routing";
import type { DistributionQueueRow } from "@/lib/revenue-os/distribution-queue-actions";
import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";
import type { AutonomousPolicyRow } from "@/lib/revenue-os/autonomous-policies-db";
import type { BentleyAutonomousCandidate } from "@/lib/revenue-os/autonomous-candidates";
import {
  evaluateBentleyAutonomousThresholds,
  type EvaluateBentleyAutonomousThresholdsResult,
} from "@/lib/revenue-os/autonomous-thresholds";
import type { WorkspacePriorityRow } from "@/lib/revenue-os/workspace-prioritization";
import { plannerColumnKeyForItem, type PlannerColumnKey } from "@/lib/revenue-os/planner-column-keys";

export type BentleyExplanation = {
  subject: string;
  decisionSummary: string;
  keyInputs: Array<{ label: string; value: string }>;
  weightsAndSignals: Array<{ signal: string; weight: number; note?: string }>;
  policyConstraints: string[];
  blockers: string[];
  whyChosen: string[];
  whyNotChosen: string[];
  confidenceNote: string;
  recommendedHumanReview: boolean;
  generatedAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function worstRouting(targets: RoutedTargetPlan[]): ConnectorRoutingStatus | null {
  if (!targets.length) return null;
  const st = targets.map((t) => t.routingStatus);
  if (st.includes("requires_manual_export")) return "requires_manual_export";
  if (st.includes("blocked_capability_mismatch")) return "blocked_capability_mismatch";
  if (st.includes("blocked_no_connector")) return "blocked_no_connector";
  if (st.includes("ready")) return "ready";
  return targets[0]?.routingStatus ?? null;
}

/** Generic explanation from structured hints (simulation / audit). */
export function explainBentleyDecision(input: {
  subject: string;
  summary: string;
  keyInputs?: Array<{ label: string; value: string }>;
  weightsAndSignals?: BentleyExplanation["weightsAndSignals"];
  policyConstraints?: string[];
  blockers?: string[];
  whyChosen?: string[];
  whyNotChosen?: string[];
  confidenceNote?: string;
  recommendedHumanReview?: boolean;
}): BentleyExplanation {
  return {
    subject: input.subject,
    decisionSummary: input.summary,
    keyInputs: input.keyInputs ?? [],
    weightsAndSignals: input.weightsAndSignals ?? [],
    policyConstraints: input.policyConstraints ?? [],
    blockers: input.blockers ?? [],
    whyChosen: input.whyChosen ?? [],
    whyNotChosen: input.whyNotChosen ?? [],
    confidenceNote: input.confidenceNote ?? "Derived from current workspace signals and policy configuration.",
    recommendedHumanReview: input.recommendedHumanReview ?? false,
    generatedAt: nowIso(),
  };
}

export function explainBentleyGrowthGuidance(input: {
  guidance: GrowthGuidance | null | undefined;
  marketSweepTopicsCount?: number;
}): BentleyExplanation {
  const g = input.guidance;
  if (!g) {
    return explainBentleyDecision({
      subject: "Growth guidance",
      summary: "No growth guidance object — run market sweep or connect workspace data.",
      whyChosen: [],
      whyNotChosen: ["Insufficient merged sweep + feedback + diff to form guidance."],
      recommendedHumanReview: true,
      confidenceNote: "Sparse guidance state.",
    });
  }

  const keyInputs: BentleyExplanation["keyInputs"] = [
    { label: "Recommended next move", value: g.recommendedNextMove.slice(0, 500) },
    { label: "Rising topics (count)", value: String(g.risingTopics?.length ?? 0) },
    { label: "Weak angles (count)", value: String(g.weakAngles?.length ?? 0) },
  ];
  if (g.systemHealthScore != null) {
    keyInputs.push({ label: "System health score", value: String(g.systemHealthScore) });
  }

  const weights: BentleyExplanation["weightsAndSignals"] = [];
  if (g.risingTopics?.length) {
    weights.push({ signal: "rising_topics", weight: Math.min(1, g.risingTopics.length / 8), note: "Topics from diff + feedback + sweep." });
  }
  if (g.weakAngles?.length) {
    weights.push({ signal: "weak_angles", weight: Math.min(1, g.weakAngles.length / 8), note: "Deprioritized angles from drift and feedback." });
  }

  const policyConstraints: string[] = [];
  if (g.bentleyPendingApprovalCount && g.bentleyPendingApprovalCount > 0) {
    policyConstraints.push(`Autonomous pending approvals: ${g.bentleyPendingApprovalCount} — governance gates active.`);
  }
  if (g.connectorGapSummary) policyConstraints.push(`Connector: ${g.connectorGapSummary.slice(0, 200)}`);

  const blockers: string[] = [];
  if ((g.bentleyCriticalExceptionCount ?? 0) > 0) blockers.push("Critical exceptions present — review operator digest before scaling.");

  return explainBentleyDecision({
    subject: "Growth guidance",
    summary: `Bentley recommends: ${g.recommendedNextMove.slice(0, 280)}`.slice(0, 500),
    keyInputs,
    weightsAndSignals: weights,
    policyConstraints,
    blockers,
    whyChosen: [g.why.slice(0, 1200)],
    whyNotChosen: [
      ...(g.weakAngles?.slice(0, 3).map((w) => `Not prioritizing weak angle: ${w.slice(0, 120)}`) ?? []),
    ],
    confidenceNote:
      g.bentleyExplainabilitySummaryLine
        ? g.bentleyExplainabilitySummaryLine
        : "Guidance merges sweep, feedback, intelligence diff, and operational workflow lines.",
    recommendedHumanReview: blockers.length > 0 || (g.bentleyApprovalRequiredCount ?? 0) > 0,
  });
}

export function explainBentleyQueueAction(input: {
  queue: DistributionQueueRow;
  routedTargets: RoutedTargetPlan[];
  /** When omitted, derived from routedTargets. */
  plannerColumn?: PlannerColumnKey;
}): BentleyExplanation {
  const q = input.queue;
  const wr = worstRouting(input.routedTargets);
  const column = input.plannerColumn ?? plannerColumnKeyForItem({ queue: q, worstRouting: wr });

  const keyInputs: BentleyExplanation["keyInputs"] = [
    { label: "Queue status", value: q.queueStatus },
    { label: "Approval status", value: q.approvalStatus },
    { label: "Platform", value: q.platform },
    { label: "Planner column", value: column },
  ];
  if (q.scheduledFor) keyInputs.push({ label: "Scheduled for", value: q.scheduledFor.toISOString?.() ?? String(q.scheduledFor) });
  if (q.suppressionReason) keyInputs.push({ label: "Suppression", value: q.suppressionReason.slice(0, 300) });

  const blockers: string[] = [];
  if (wr === "blocked_no_connector" || wr === "blocked_capability_mismatch") {
    blockers.push("Connector routing blocks automatic publish — OAuth or capability mismatch.");
  }
  if (wr === "requires_manual_export") blockers.push("Routing requires manual export — Bentley cannot auto-post this target.");

  const whyChosen: string[] = [];
  const whyNot: string[] = [];

  switch (column) {
    case "suppressed":
      whyChosen.push(`Cadence optimization suppressed this asset: ${q.suppressionReason?.slice(0, 200) || "policy or experiment outcome."}`);
      whyNot.push("Not in publish-ready lane until suppression clears.");
      break;
    case "manual_export":
      whyChosen.push("Connector routing selected manual export — content may still be valid but not auto-publishable.");
      whyNot.push("Auto-publish path not chosen for this target format/platform.");
      break;
    case "approval_needed":
      whyChosen.push("Publishing workflow requires human approval before schedule/publish.");
      whyNot.push("Skipping auto-schedule until approval status is approved.");
      break;
    case "scheduled":
      whyChosen.push("Queued for scheduled publish with approved workflow state.");
      break;
    case "published":
      whyChosen.push("Already published — metrics sync and performance follow-up apply.");
      break;
    case "failed":
      whyChosen.push("Last publish failed — review error, connector, or creative before retry.");
      break;
    case "retry":
      whyChosen.push("Failure with retry attempts recorded — cadence may still recommend retry if within limits.");
      break;
    case "draft":
      whyChosen.push("Draft state — not yet approved or scheduled for distribution.");
      whyNot.push("Not published until workflow advances.");
      break;
    default:
      whyChosen.push("Queued for distribution pipeline.");
  }

  if (q.promotionReason?.trim()) whyChosen.push(`Promotion: ${q.promotionReason.slice(0, 200)}`);
  if (q.winningSignalSource?.trim()) {
    whyChosen.push(`Winner signal: ${q.winningSignalSource.slice(0, 160)}`);
  }

  const weights: BentleyExplanation["weightsAndSignals"] = [];
  if (q.experimentId) weights.push({ signal: "experiment_variant", weight: 0.7, note: "Experiment-linked — retest/promote uses performance analysis." });
  weights.push({ signal: "routing_status", weight: wr === "ready" ? 0.85 : 0.35, note: wr ?? "unknown" });

  return explainBentleyDecision({
    subject: `Queue item ${q.id.slice(0, 8)}…`,
    summary: `This asset sits in “${column}” because of queue status (${q.queueStatus}), approval (${q.approvalStatus}), and connector routing (${wr ?? "unknown"}).`,
    keyInputs,
    weightsAndSignals: weights,
    policyConstraints: q.approvalStatus === "pending" ? ["Publishing approval policy may block schedule until reviewed."] : [],
    blockers,
    whyChosen,
    whyNotChosen: whyNot,
    confidenceNote:
      wr === "ready"
        ? "Connector-ready routing increases confidence for automated execution."
        : "Connector or approval constraints reduce confidence for unattended execution.",
    recommendedHumanReview: column === "approval_needed" || column === "manual_export" || blockers.length > 0,
  });
}

export function explainBentleyAutonomousAction(input: {
  candidate: BentleyAutonomousCandidate;
  policy: AutonomousPolicyRow | null;
  evaluation: EvaluateBentleyAutonomousThresholdsResult;
}): BentleyExplanation {
  const { candidate, policy, evaluation } = input;
  const keyInputs: BentleyExplanation["keyInputs"] = [
    { label: "Action type", value: candidate.actionType },
    { label: "Risk level", value: candidate.riskLevel },
    { label: "Confidence", value: evaluation.confidenceScore.toFixed(3) },
    { label: "Outcome", value: evaluation.outcome },
    { label: "Policy enabled", value: policy?.isEnabled ? "yes" : "no" },
  ];
  if (policy?.requiresApprovalAboveSeverity) {
    keyInputs.push({ label: "Approval above severity", value: policy.requiresApprovalAboveSeverity });
  }
  if (policy?.maxDailyExecutions != null) {
    keyInputs.push({ label: "Daily cap", value: String(policy.maxDailyExecutions) });
  }

  const policyConstraints: string[] = [];
  if (policy) {
    policyConstraints.push(`Policy ${policy.id.slice(0, 8)}… requires approval above ${policy.requiresApprovalAboveSeverity}).`);
  } else {
    policyConstraints.push("No matching policy for this action type / scope.");
  }

  const whyNot: string[] = [];
  if (evaluation.outcome === "auto_execute") whyNot.push("Alternatives skipped: approval not required at this severity.");
  if (evaluation.outcome === "require_approval") whyNot.push("Auto-execute was not taken — severity meets approval threshold.");
  if (evaluation.outcome === "skip") whyNot.push("Execution skipped per policy limits, cooldown, or confidence.");

  return explainBentleyDecision({
    subject: `Autonomous action: ${candidate.actionType}`,
    summary: `Bentley evaluated ${candidate.actionType} as “${evaluation.outcome}” (${evaluation.severity}). ${evaluation.rationale.join(" ")}`.slice(
      0,
      900
    ),
    keyInputs,
    weightsAndSignals: [
      { signal: "candidate_confidence", weight: evaluation.confidenceScore, note: "From candidate model." },
      { signal: "severity", weight: evaluation.severity === "critical" ? 1 : evaluation.severity === "warning" ? 0.65 : 0.35 },
    ],
    policyConstraints,
    blockers: evaluation.outcome === "escalate_only" ? ["Escalation-only — no autonomous execution."] : [],
    whyChosen: evaluation.rationale,
    whyNotChosen: whyNot,
    confidenceNote:
      evaluation.outcome === "require_approval"
        ? "Human approval is required before production execution — aligns with governance threshold."
        : confidenceNoteForOutcome(evaluation.outcome),
    recommendedHumanReview: evaluation.outcome !== "auto_execute",
  });
}

function confidenceNoteForOutcome(o: EvaluateBentleyAutonomousThresholdsResult["outcome"]): string {
  switch (o) {
    case "auto_execute":
      return "Within policy thresholds — still monitor audit trail.";
    case "require_approval":
      return "Approval gate triggered by severity vs policy.";
    case "escalate_only":
      return "Operator escalation recommended before automation.";
    case "skip":
      return "Skipped — check policy caps, cooldown, or confidence floor.";
    default:
      return "Evaluation complete.";
  }
}

export function explainLeadInboxRow(input: {
  commercialIntentScore: number;
  handoffReadiness: number;
  signalClass: string | null;
  handoffStatus: string | null;
}): Pick<BentleyExplanation, "decisionSummary" | "confidenceNote" | "keyInputs" | "blockers"> {
  const handoffReady = input.handoffReadiness >= 0.62 || input.handoffStatus === "new";
  const highIntent = input.commercialIntentScore >= 0.65;
  const summary = handoffReady
    ? "Handoff-ready: combined readiness score and/or open handoff indicate sales follow-up."
    : highIntent
      ? "High commercial intent — prioritize capture and CTA-forward follow-up."
      : input.signalClass === "objection"
        ? "Objection-class signal — educate and address concerns before hard sell."
        : "Engagement signal — nurture before aggressive conversion.";

  return {
    decisionSummary: summary,
    confidenceNote: `Intent ${(input.commercialIntentScore * 100).toFixed(0)}%, readiness ${(input.handoffReadiness * 100).toFixed(0)}%.`,
    keyInputs: [
      { label: "signal_class", value: input.signalClass ?? "unknown" },
      { label: "handoff_status", value: input.handoffStatus ?? "none" },
    ],
    blockers: [],
  };
}

export function explainWorkspacePriority(input: { row: WorkspacePriorityRow }): BentleyExplanation {
  const r = input.row;
  return explainBentleyDecision({
    subject: `Workspace ${r.workspace.clientId}/${r.workspace.trustId}`,
    summary: `Priority score ${r.combinedScore.toFixed(1)} — urgency ${r.urgencyScore.toFixed(1)}, opportunity ${r.opportunityScore.toFixed(1)}.`,
    keyInputs: [
      { label: "Urgency score", value: r.urgencyScore.toFixed(1) },
      { label: "Opportunity score", value: r.opportunityScore.toFixed(1) },
      { label: "Combined", value: r.combinedScore.toFixed(1) },
    ],
    weightsAndSignals: [
      { signal: "failed_publishes", weight: Math.min(1, r.urgencyScore / 40), note: "Weighted in urgency." },
      { signal: "promotion_ready", weight: Math.min(1, r.opportunityScore / 40), note: "Weighted in opportunity." },
    ],
    whyChosen: [r.rationale || "Derived from queue health, connectors, leads, and handoffs."],
    whyNotChosen: ["Lower-scoped workspaces deprioritized until urgent backlog clears."],
    confidenceNote: "Heuristic prioritization — tune weights when operators disagree with ranking.",
    recommendedHumanReview: r.urgencyScore > 25,
  });
}

/** Re-export threshold evaluation for callers building explanations from live context. */
export { evaluateBentleyAutonomousThresholds };
