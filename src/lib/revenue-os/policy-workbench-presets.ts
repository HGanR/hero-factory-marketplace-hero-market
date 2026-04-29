/**
 * Workbench recommendation presets → form-shaped proposals (dry-run only until apply).
 */

import type { PolicyWorkbenchFormState } from "@/lib/revenue-os/policy-workbench-form";
import { buildProposedPolicySnapshotFromForm, defaultPolicyWorkbenchFormState } from "@/lib/revenue-os/policy-workbench-form";

export type WorkbenchRecommendationPreset =
  | "safer"
  | "balanced"
  | "higher_upside"
  | "lower_noise"
  | "faster_cleanup";

const LABELS: Record<WorkbenchRecommendationPreset, { label: string; rationale: string }> = {
  safer: {
    label: "Safer",
    rationale: "Bias toward more approvals, fewer auto moves, and critical-only notifications.",
  },
  balanced: {
    label: "Balanced",
    rationale: "Moderate automation with warning-level notifications and measured cadence tweaks.",
  },
  higher_upside: {
    label: "Higher upside",
    rationale: "More auto-execution headroom, faster retries, and broader notification visibility.",
  },
  lower_noise: {
    label: "Lower noise",
    rationale: "Stricter notification floor to reduce inbox volume.",
  },
  faster_cleanup: {
    label: "Faster cleanup",
    rationale: "More aggressive stale-draft eligibility and cleanup-oriented cadence.",
  },
};

export function describeWorkbenchPreset(preset: WorkbenchRecommendationPreset): { label: string; rationale: string } {
  return LABELS[preset];
}

/**
 * Maps a preset onto a copy of `base` (merge with current editor state).
 */
export function applyWorkbenchPresetToForm(
  preset: WorkbenchRecommendationPreset,
  base: PolicyWorkbenchFormState
): PolicyWorkbenchFormState {
  const f: PolicyWorkbenchFormState = { ...base };
  switch (preset) {
    case "safer":
      f.patchRequiresApprovalAboveSeverity = "warning";
      f.patchIsEnabled = true;
      f.minSeverityProposed = "critical";
      f.staleDaysProposed = f.staleDaysProposed || "28";
      f.promotedWinnersSkippingApproval = false;
      break;
    case "balanced":
      f.patchRequiresApprovalAboveSeverity = "info";
      f.minSeverityProposed = "warning";
      f.staleDaysProposed = f.staleDaysProposed || "21";
      f.promotedWinnersSkippingApproval = false;
      break;
    case "higher_upside":
      f.patchRequiresApprovalAboveSeverity = "none";
      f.minSeverityProposed = "info";
      f.staleDaysProposed = f.staleDaysProposed || "14";
      f.promotedWinnersSkippingApproval = true;
      break;
    case "lower_noise":
      f.minSeverityProposed = "critical";
      break;
    case "faster_cleanup":
      f.staleDaysProposed = f.staleDaysProposed || "14";
      f.promotedWinnersSkippingApproval = false;
      break;
    default:
      break;
  }
  return f;
}

export function buildProposedSnapshotFromPreset(
  preset: WorkbenchRecommendationPreset,
  base?: PolicyWorkbenchFormState
): Record<string, unknown> {
  const merged = applyWorkbenchPresetToForm(preset, base ?? defaultPolicyWorkbenchFormState());
  return buildProposedPolicySnapshotFromForm(merged);
}

export function isWorkbenchRecommendationPreset(s: string | null | undefined): s is WorkbenchRecommendationPreset {
  return (
    s === "safer" ||
    s === "balanced" ||
    s === "higher_upside" ||
    s === "lower_noise" ||
    s === "faster_cleanup"
  );
}

export const WORKBENCH_PRESET_IDS: WorkbenchRecommendationPreset[] = [
  "safer",
  "balanced",
  "higher_upside",
  "lower_noise",
  "faster_cleanup",
];
