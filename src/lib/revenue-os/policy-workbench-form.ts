/**
 * Form state ↔ proposed policy snapshot JSON for the policy workbench UI (client-safe).
 */

export type PolicyWorkbenchFormState = {
  /** Cadence */
  staleDaysCurrent: string;
  staleDaysProposed: string;
  promotedWinnersSkippingApproval: boolean;
  /** Notifications */
  minSeverityProposed: "info" | "warning" | "critical";
  /** Autonomous patch (optional) */
  autonomousPolicyId: string;
  includeAutonomousPatch: boolean;
  patchIsEnabled: boolean;
  patchRequiresApprovalAboveSeverity: "none" | "info" | "warning" | "critical";
  patchMaxDailyExecutions: string;
  patchCooldownMinutes: string;
  /** Reviewed apply — automation (cadence-related) */
  includeCadenceAutomationApply: boolean;
  cadenceAutomationPolicyId: string;
  /** Merged into automation policyConfigJson (intent for stale / cadence automations). */
  staleDraftDaysForAutomation: string;
  /** Reviewed apply — notification routing */
  includeNotificationApply: boolean;
  notificationPolicyId: string;
  notificationMinSeverityApply: "info" | "warning" | "critical";
};

export function defaultPolicyWorkbenchFormState(): PolicyWorkbenchFormState {
  return {
    staleDaysCurrent: "",
    staleDaysProposed: "",
    promotedWinnersSkippingApproval: false,
    minSeverityProposed: "warning",
    autonomousPolicyId: "",
    includeAutonomousPatch: false,
    patchIsEnabled: true,
    patchRequiresApprovalAboveSeverity: "none",
    patchMaxDailyExecutions: "",
    patchCooldownMinutes: "",
    includeCadenceAutomationApply: false,
    cadenceAutomationPolicyId: "",
    staleDraftDaysForAutomation: "",
    includeNotificationApply: false,
    notificationPolicyId: "",
    notificationMinSeverityApply: "warning",
  };
}

function numOrUndef(s: string): number | undefined {
  const t = s.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Builds `proposedPolicySnapshotJson` for `runBentleyPolicyScenario` / simulate API.
 */
export function buildProposedPolicySnapshotFromForm(state: PolicyWorkbenchFormState): Record<string, unknown> {
  const cadence: Record<string, unknown> = {
    staleDaysCurrent: numOrUndef(state.staleDaysCurrent),
    staleDaysProposed: numOrUndef(state.staleDaysProposed),
    promotedWinnersSkippingApproval: state.promotedWinnersSkippingApproval,
  };

  const notifications = {
    minSeverityProposed: state.minSeverityProposed,
  };

  const out: Record<string, unknown> = {
    cadence,
    notifications,
  };

  if (state.includeAutonomousPatch && state.autonomousPolicyId.trim()) {
    const patch: Record<string, unknown> = {
      isEnabled: state.patchIsEnabled,
      requiresApprovalAboveSeverity: state.patchRequiresApprovalAboveSeverity,
    };
    const maxD = numOrUndef(state.patchMaxDailyExecutions);
    const cool = numOrUndef(state.patchCooldownMinutes);
    if (maxD !== undefined) patch.maxDailyExecutions = maxD;
    if (cool !== undefined) patch.cooldownMinutes = cool;
    out.autonomous = {
      policyPatchesById: {
        [state.autonomousPolicyId.trim()]: patch,
      },
    };
  }

  return out;
}

/** Partial patch for `buildAutonomousUpsertPayloadFromPatch` — only when autonomous section is enabled. */
export function buildAutonomousPatchFromForm(state: PolicyWorkbenchFormState): {
  isEnabled: boolean;
  requiresApprovalAboveSeverity: "none" | "info" | "warning" | "critical";
  maxDailyExecutions: number | null;
  cooldownMinutes: number | null;
} | null {
  if (!state.includeAutonomousPatch || !state.autonomousPolicyId.trim()) return null;
  return {
    isEnabled: state.patchIsEnabled,
    requiresApprovalAboveSeverity: state.patchRequiresApprovalAboveSeverity,
    maxDailyExecutions: numOrUndef(state.patchMaxDailyExecutions) ?? null,
    cooldownMinutes: numOrUndef(state.patchCooldownMinutes) ?? null,
  };
}
