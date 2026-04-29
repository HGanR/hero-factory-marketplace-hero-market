/**
 * Guided paired simulations — steer operators toward meaningful comparisons.
 */

import type { PolicyWorkbenchFormState } from "@/lib/revenue-os/policy-workbench-form";
import { buildProposedPolicySnapshotFromForm, defaultPolicyWorkbenchFormState } from "@/lib/revenue-os/policy-workbench-form";
import { buildProposedSnapshotFromPreset, type WorkbenchRecommendationPreset } from "@/lib/revenue-os/policy-workbench-presets";

export type GuidedScenarioPair = {
  id: string;
  label: string;
  rationale: string;
  /** Left = baseline-ish, right = contrast */
  left: { name: string; proposedPolicySnapshotJson: Record<string, unknown> };
  right: { name: string; proposedPolicySnapshotJson: Record<string, unknown> };
};

export type BuildGuidedScenarioPairsInput = {
  /** Current editor form (optional). */
  form?: PolicyWorkbenchFormState;
  /** Client scope for labels only. */
  clientId?: string;
  trustId?: string;
};

export function buildGuidedScenarioPairs(input: BuildGuidedScenarioPairsInput = {}): GuidedScenarioPair[] {
  const base = input.form ?? defaultPolicyWorkbenchFormState();
  const scope = [input.clientId, input.trustId].filter(Boolean).join("/") || "global";

  const currentVsStricter: GuidedScenarioPair = {
    id: "current_vs_stricter",
    label: "Current vs stricter notifications",
    rationale: "Contrasts baseline severity routing with critical-only to show noise reduction tradeoffs.",
    left: {
      name: `Baseline (${scope})`,
      proposedPolicySnapshotJson: buildProposedPolicySnapshotFromForm(base),
    },
    right: {
      name: "Stricter (critical notifications)",
      proposedPolicySnapshotJson: buildProposedSnapshotFromPreset("lower_noise", { ...base, minSeverityProposed: "critical" }),
    },
  };

  const currentVsBalanced: GuidedScenarioPair = {
    id: "current_vs_balanced",
    label: "Current vs balanced automation",
    rationale: "Pairs moderate approval thresholds with measured cadence — typical production default.",
    left: {
      name: `Baseline (${scope})`,
      proposedPolicySnapshotJson: buildProposedPolicySnapshotFromForm(base),
    },
    right: {
      name: "Balanced preset",
      proposedPolicySnapshotJson: buildProposedSnapshotFromPreset("balanced", base),
    },
  };

  const currentVsAggressive: GuidedScenarioPair = {
    id: "current_vs_aggressive",
    label: "Current vs higher-upside automation",
    rationale: "Shows more auto-execution path and broader notifications — review risk flags carefully.",
    left: {
      name: `Baseline (${scope})`,
      proposedPolicySnapshotJson: buildProposedPolicySnapshotFromForm(base),
    },
    right: {
      name: "Higher-upside preset",
      proposedPolicySnapshotJson: buildProposedSnapshotFromPreset("higher_upside", base),
    },
  };

  const currentVsFasterCleanup: GuidedScenarioPair = {
    id: "current_vs_faster_cleanup",
    label: "Current vs faster archive",
    rationale: "Compares stale-draft eligibility when lowering day threshold — good for backlog hygiene.",
    left: {
      name: `Baseline (${scope})`,
      proposedPolicySnapshotJson: buildProposedPolicySnapshotFromForm(base),
    },
    right: {
      name: "Faster cleanup",
      proposedPolicySnapshotJson: buildProposedSnapshotFromPreset("faster_cleanup", {
        ...base,
        staleDaysProposed: "14",
      }),
    },
  };

  return [currentVsStricter, currentVsBalanced, currentVsAggressive, currentVsFasterCleanup];
}

export type RecommendMeaningfulScenarioPairInput = {
  lastRunSummary?: string | null;
  comparisonHadMaterialDelta?: boolean;
  /** e.g. risk flag count */
  riskFlagsCount?: number;
};

export function recommendMeaningfulScenarioPair(
  input: RecommendMeaningfulScenarioPairInput
): { pairId: string; message: string } | null {
  if (input.comparisonHadMaterialDelta === false) {
    return {
      pairId: "current_vs_balanced",
      message: "Last run was flat — try “Current vs balanced automation” to surface a clearer tradeoff.",
    };
  }
  if ((input.riskFlagsCount ?? 0) > 2) {
    return {
      pairId: "current_vs_stricter",
      message: "Several risk flags — compare against stricter notifications to validate operator load vs safety.",
    };
  }
  return {
    pairId: "current_vs_faster_cleanup",
    message: "Consider a cadence-focused pair to quantify archive backlog impact.",
  };
}

export type ValidateScenarioPairUsefulnessInput = {
  leftComparison?: Record<string, unknown> | null;
  rightComparison?: Record<string, unknown> | null;
};

function deltaSig(c: Record<string, unknown> | null | undefined): string {
  if (!c) return "";
  return [
    c.addedAutoActions,
    c.removedAutoActions,
    c.addedApprovals,
    c.removedApprovals,
    c.changedNotifications,
    c.changedQueueStates,
    c.summaryDelta,
  ]
    .map((x) => String(x ?? ""))
    .join("|");
}

export function validateScenarioPairUsefulness(input: ValidateScenarioPairUsefulnessInput): {
  meaningful: boolean;
  reason: string;
} {
  const a = deltaSig(input.leftComparison);
  const b = deltaSig(input.rightComparison);
  if (!a && !b) {
    return { meaningful: false, reason: "Both sides lack comparison data — run simulations or add scope." };
  }
  if (a === b) {
    return { meaningful: false, reason: "Both scenarios produced identical comparison signatures — adjust proposals." };
  }
  return { meaningful: true, reason: "Comparison signatures differ — deltas are distinguishable." };
}

export function presetForPairId(pairId: string): WorkbenchRecommendationPreset | null {
  if (pairId.includes("stricter")) return "lower_noise";
  if (pairId.includes("balanced")) return "balanced";
  if (pairId.includes("aggressive")) return "higher_upside";
  if (pairId.includes("cleanup")) return "faster_cleanup";
  return null;
}
