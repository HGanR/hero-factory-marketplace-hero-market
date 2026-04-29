/**
 * Action Flow Enforcement for Complex Trusts
 * 
 * Blocks actions that require resolutions until proper governance is in place.
 */

import { ComplexTrustAction, requiresResolutionForComplexTrust } from "./complex-trust-requirements";

export interface ActionEnforcementResult {
  allowed: boolean;
  reason?: string;
  requiredResolutionId?: string;
  createResolutionUrl?: string;
}

/**
 * Check if an action is allowed for a trust-owned entity
 */
export async function enforceActionRequirement(
  action: ComplexTrustAction,
  trustId: string | null,
  trustMode: string | null,
  complexTrustMode: boolean
): Promise<ActionEnforcementResult> {
  // If not trust-owned, allow (no enforcement)
  if (!trustId) {
    return { allowed: true };
  }

  // Check if resolution is required
  const requirement = requiresResolutionForComplexTrust(action, trustMode, complexTrustMode);

  if (!requirement.required) {
    return { allowed: true };
  }

  // TODO: Check for existing approved resolution
  // This would query the database for approved resolutions covering this action

  // For now, return blocked with guidance
  return {
    allowed: false,
    reason: requirement.reason,
    createResolutionUrl: `/trust-records/${trustId}/governance/minutes/new?action=${action}`,
  };
}

/**
 * Get the resolution type needed for an action
 */
export function getResolutionTypeForAction(action: ComplexTrustAction): string {
  const mapping: Partial<Record<ComplexTrustAction, string>> = {
    DISCRETIONARY_DISTRIBUTION: "DISCRETIONARY_DISTRIBUTION",
    ACCUMULATE_INCOME: "INCOME_ACCUMULATION",
    APPOINT_LLC_MANAGER: "LLC_MANAGER_APPOINTMENT",
    REMOVE_LLC_MANAGER: "LLC_MANAGER_APPOINTMENT",
    CAPITAL_CONTRIBUTION_TO_LLC: "CAPITAL_CONTRIBUTION",
  };

  return mapping[action] || "OTHER";
}
