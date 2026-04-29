/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  getResolvedGovernanceCommercialTierLabel,
  GOVERNANCE_FEATURE_NOT_AVAILABLE_BODY,
  resolveCampaignGovernanceEntitlements,
  REVENUE_OS_CAMPAIGN_GOVERNANCE_VERSION,
} from "@/lib/revenue-os/campaign-governance-entitlements";

describe("resolveCampaignGovernanceEntitlements", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.REVENUE_OS_GOVERNANCE_TIER;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.REVENUE_OS_GOVERNANCE_TIER;
    else process.env.REVENUE_OS_GOVERNANCE_TIER = saved;
  });

  it("admin session enables all flags regardless of tier env", () => {
    process.env.REVENUE_OS_GOVERNANCE_TIER = "starter";
    const e = resolveCampaignGovernanceEntitlements({ adminSession: true });
    expect(e.reviewerAssignmentsEnabled).toBe(true);
    expect(e.multiStepApprovalChainsEnabled).toBe(true);
    expect(e.approvalAnalyticsEnabled).toBe(true);
    expect(e.scheduledReportDeliveryEnabled).toBe(true);
    expect(e.complianceReportExportEnabled).toBe(true);
  });

  it("starter tier disables governance add-ons", () => {
    const e = resolveCampaignGovernanceEntitlements({
      adminSession: false,
      tierOverride: "starter",
    });
    expect(e.reviewerAssignmentsEnabled).toBe(false);
    expect(e.approvalAnalyticsEnabled).toBe(false);
  });

  it("standard tier allows reviewers and analytics but not multi-step chains", () => {
    const e = resolveCampaignGovernanceEntitlements({
      adminSession: false,
      tierOverride: "standard",
    });
    expect(e.reviewerAssignmentsEnabled).toBe(true);
    expect(e.multiStepApprovalChainsEnabled).toBe(false);
    expect(e.approvalAnalyticsEnabled).toBe(true);
  });

  it("tierOverride wins over process.env", () => {
    saved = process.env.REVENUE_OS_GOVERNANCE_TIER;
    process.env.REVENUE_OS_GOVERNANCE_TIER = "enterprise";
    const e = resolveCampaignGovernanceEntitlements({
      adminSession: false,
      tierOverride: "starter",
    });
    expect(e.reviewerAssignmentsEnabled).toBe(false);
  });

  it("getResolvedGovernanceCommercialTierLabel reflects admin vs env", () => {
    saved = process.env.REVENUE_OS_GOVERNANCE_TIER;
    process.env.REVENUE_OS_GOVERNANCE_TIER = "standard";
    expect(getResolvedGovernanceCommercialTierLabel({ adminSession: false })).toBe("standard");
    expect(getResolvedGovernanceCommercialTierLabel({ adminSession: true })).toBe("admin_override");
  });
});

describe("GOVERNANCE_FEATURE_NOT_AVAILABLE_BODY", () => {
  it("is stable for API responses", () => {
    expect(GOVERNANCE_FEATURE_NOT_AVAILABLE_BODY).toEqual({
      error: "FEATURE_NOT_AVAILABLE",
      message: "This feature is not available for the current plan.",
    });
  });
});

describe("REVENUE_OS_CAMPAIGN_GOVERNANCE_VERSION", () => {
  it("marks shipped governance v1", () => {
    expect(REVENUE_OS_CAMPAIGN_GOVERNANCE_VERSION).toBe("v1");
  });
});
