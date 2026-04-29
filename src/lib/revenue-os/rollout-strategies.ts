/**
 * Preset rollout strategies — JSON-friendly for `rolloutStrategyJson` on saved plans.
 */

export type RolloutStrategyPreset = "conservative" | "balanced" | "aggressive" | "pilot_first";

export type BentleyRolloutStrategyJson = {
  preset: RolloutStrategyPreset;
  scopeProgression: string[];
  maxWorkspacesPerStage: number[];
  observationWindowHours: number;
  requiredSuccessSignals: string[];
  rollbackThresholds: {
    failedPublishSpike?: number;
    approvalBacklogDelta?: number;
    criticalExceptionCount?: number;
  };
  notes?: string;
};

export function buildConservativeRolloutStrategy(): BentleyRolloutStrategyJson {
  return {
    preset: "conservative",
    scopeProgression: ["single_workspace_pilot", "paired_workspace", "regional_slice", "all_in_scope"],
    maxWorkspacesPerStage: [1, 2, 4, 999],
    observationWindowHours: 72,
    requiredSuccessSignals: [
      "No spike in failed publishes vs baseline window",
      "Autonomous approval queue stable or decreasing",
      "No new critical exceptions tied to policy actions",
    ],
    rollbackThresholds: {
      failedPublishSpike: 2,
      approvalBacklogDelta: 5,
      criticalExceptionCount: 2,
    },
    notes: "Longer observation, smallest blast radius.",
  };
}

export function buildBalancedRolloutStrategy(): BentleyRolloutStrategyJson {
  return {
    preset: "balanced",
    scopeProgression: ["pilot_two", "expand_half", "full_scope"],
    maxWorkspacesPerStage: [2, 6, 999],
    observationWindowHours: 48,
    requiredSuccessSignals: [
      "Cadence + queue metrics within tolerance",
      "Handoff backlog not worsening materially",
      "Operator warnings cleared or acknowledged",
    ],
    rollbackThresholds: {
      failedPublishSpike: 3,
      approvalBacklogDelta: 8,
      criticalExceptionCount: 3,
    },
    notes: "Default production pacing.",
  };
}

export function buildAggressiveRolloutStrategy(): BentleyRolloutStrategyJson {
  return {
    preset: "aggressive",
    scopeProgression: ["fast_pilot", "broaden", "full_scope"],
    maxWorkspacesPerStage: [4, 12, 999],
    observationWindowHours: 24,
    requiredSuccessSignals: [
      "Health score remains ≥ prior baseline",
      "No sustained publish failure burst",
    ],
    rollbackThresholds: {
      failedPublishSpike: 5,
      approvalBacklogDelta: 12,
      criticalExceptionCount: 4,
    },
    notes: "Shorter windows — requires healthy baselines.",
  };
}

export function buildPilotFirstRolloutStrategy(): BentleyRolloutStrategyJson {
  return {
    preset: "pilot_first",
    scopeProgression: ["single_best_workspace", "add_one", "expand_cautiously", "full_scope"],
    maxWorkspacesPerStage: [1, 2, 5, 999],
    observationWindowHours: 96,
    requiredSuccessSignals: [
      "Pilot workspace shows expected simulation deltas",
      "Rollback drill acknowledged by operator",
      "Success metrics checklist green for one full window",
    ],
    rollbackThresholds: {
      failedPublishSpike: 1,
      approvalBacklogDelta: 4,
      criticalExceptionCount: 1,
    },
    notes: "Explicit pilot-first with stricter rollback gates.",
  };
}

export function rolloutStrategyByPreset(preset: RolloutStrategyPreset): BentleyRolloutStrategyJson {
  switch (preset) {
    case "conservative":
      return buildConservativeRolloutStrategy();
    case "aggressive":
      return buildAggressiveRolloutStrategy();
    case "pilot_first":
      return buildPilotFirstRolloutStrategy();
    case "balanced":
    default:
      return buildBalancedRolloutStrategy();
  }
}
