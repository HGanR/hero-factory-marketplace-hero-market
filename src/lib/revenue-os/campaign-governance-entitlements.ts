/**
 * Plan / account feature gates for Revenue OS campaign governance (Part 28).
 * Swap `resolveCampaignGovernanceEntitlements` internals for billing when ready.
 */

import { NextResponse } from "next/server";
import { isMultiStepPublishApprovalChain, type PublishApprovalChain } from "@/lib/revenue-os/publish-approval-chain";

/** Internal product marker: shipped governance stack (operators, API, jobs, gating). Part 29 closeout. */
export const REVENUE_OS_CAMPAIGN_GOVERNANCE_VERSION = "v1" as const;

export type CampaignGovernanceEntitlements = {
  reviewerAssignmentsEnabled: boolean;
  multiStepApprovalChainsEnabled: boolean;
  approvalAnalyticsEnabled: boolean;
  scheduledReportDeliveryEnabled: boolean;
  complianceReportExportEnabled: boolean;
};

export const GOVERNANCE_FEATURE_NOT_AVAILABLE_BODY = {
  error: "FEATURE_NOT_AVAILABLE" as const,
  message: "This feature is not available for the current plan.",
};

export type GovernanceCommercialTier = "starter" | "standard" | "enterprise";

const ALL_ENABLED: CampaignGovernanceEntitlements = {
  reviewerAssignmentsEnabled: true,
  multiStepApprovalChainsEnabled: true,
  approvalAnalyticsEnabled: true,
  scheduledReportDeliveryEnabled: true,
  complianceReportExportEnabled: true,
};

const TIER_ENTITLEMENTS: Record<GovernanceCommercialTier, CampaignGovernanceEntitlements> = {
  starter: {
    reviewerAssignmentsEnabled: false,
    multiStepApprovalChainsEnabled: false,
    approvalAnalyticsEnabled: false,
    scheduledReportDeliveryEnabled: false,
    complianceReportExportEnabled: false,
  },
  standard: {
    reviewerAssignmentsEnabled: true,
    multiStepApprovalChainsEnabled: false,
    approvalAnalyticsEnabled: true,
    scheduledReportDeliveryEnabled: true,
    complianceReportExportEnabled: true,
  },
  enterprise: ALL_ENABLED,
};

function normalizeTier(raw: string | null | undefined): GovernanceCommercialTier {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (t === "starter" || t === "standard" || t === "enterprise") return t;
  return "enterprise";
}

/**
 * Resolved commercial tier label for debug / UI (not a billing id).
 */
export function getResolvedGovernanceCommercialTierLabel(args: { adminSession: boolean }): string {
  if (args.adminSession) return "admin_override";
  return normalizeTier(process.env.REVENUE_OS_GOVERNANCE_TIER);
}

/**
 * Central resolver: admin session → all features on; else map `REVENUE_OS_GOVERNANCE_TIER` (default `enterprise`).
 * Optional `clientId` reserved for future plan lookup.
 */
export function resolveCampaignGovernanceEntitlements(args: {
  adminSession: boolean;
  clientId?: string | null;
  /** Tests or future billing inject */
  tierOverride?: string | null;
}): CampaignGovernanceEntitlements {
  if (args.adminSession) {
    return { ...ALL_ENABLED };
  }
  void args.clientId;
  const tier = normalizeTier(args.tierOverride ?? process.env.REVENUE_OS_GOVERNANCE_TIER);
  return { ...TIER_ENTITLEMENTS[tier] };
}

export function governanceFeatureNotAvailableResponse(): NextResponse {
  return NextResponse.json(GOVERNANCE_FEATURE_NOT_AVAILABLE_BODY, { status: 403 });
}

export function governanceEntitlementBlocked(
  entitlements: CampaignGovernanceEntitlements,
  key: keyof CampaignGovernanceEntitlements
): boolean {
  return !entitlements[key];
}

/** True when persisted chain would be multi-step but entitlements forbid it. */
export function publishApprovalChainViolatesMultiStepEntitlement(
  chain: PublishApprovalChain | null,
  entitlements: CampaignGovernanceEntitlements
): boolean {
  if (entitlements.multiStepApprovalChainsEnabled) return false;
  return isMultiStepPublishApprovalChain(chain);
}
