/**
 * @jest-environment node
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "@jest/globals";
import { buildCampaignGovernanceSettingsViewModel } from "@/lib/revenue-os/campaign-governance-settings-view-model";

const ALL_ENTITLEMENTS_ON = {
  reviewerAssignmentsEnabled: true,
  multiStepApprovalChainsEnabled: true,
  approvalAnalyticsEnabled: true,
  scheduledReportDeliveryEnabled: true,
  complianceReportExportEnabled: true,
} as const;

function vm(
  overrides?: Partial<Parameters<typeof buildCampaignGovernanceSettingsViewModel>[0]>
) {
  return buildCampaignGovernanceSettingsViewModel({
    workerEnvRequiresApproval: true,
    uiSessionRequiresApproval: false,
    publishApprovalChain: null,
    publishApprovalReportSchedule: null,
    reviewerRoleCounts: { approver: 1, editor: 0, reviewer: 0 },
    rows: [],
    canManageReviewerAssignments: true,
    canViewApprovalAnalytics: true,
    mayFinalizePublishApproval: true,
    viewerCampaignReviewerRole: "owner",
    entitlements: { ...ALL_ENTITLEMENTS_ON },
    governancePlanTierLabel: "enterprise",
    ...overrides,
  });
}

describe("buildCampaignGovernanceSettingsViewModel", () => {
  it("classifies default single-step chain when approval on and no chain JSON", () => {
    const v = vm();
    expect(v.chain.mode).toBe("default_single");
    expect(v.chain.explicitChainConfigured).toBe(false);
    expect(v.approvalMode.effectiveRequiresApproval).toBe(true);
    expect(v.displaySummary.approvalRequiredLabel).toBe("On");
  });

  it("classifies multi-step chain", () => {
    const v = vm({
      publishApprovalChain: {
        steps: [
          { stepIndex: 0, requiredReviewerRole: "editor" },
          { stepIndex: 1, requiredReviewerRole: "owner" },
        ],
      },
    });
    expect(v.chain.mode).toBe("multi");
    expect(v.chain.stepCount).toBe(2);
    expect(v.chain.explicitChainConfigured).toBe(true);
  });

  it("merges governance warnings from computeCampaignGovernanceHealth", () => {
    const v = vm({
      publishApprovalChain: {
        steps: [{ stepIndex: 0, requiredReviewerRole: "approver" }],
      },
      reviewerRoleCounts: { approver: 0, editor: 0, reviewer: 0 },
    });
    expect(v.warnings.some((w) => w.code === "CHAIN_STEP_NO_ASSIGNEE")).toBe(true);
  });

  it("surfaces report schedule slice", () => {
    const v = vm({
      publishApprovalReportSchedule: {
        enabled: true,
        frequency: "daily",
        format: "json",
        recipientMode: "owner_only",
      },
    });
    expect(v.reportSchedule.enabled).toBe(true);
    expect(v.reportSchedule.frequency).toBe("daily");
    expect(v.reportSchedule.label).toContain("daily");
  });

  it("includes capability flags", () => {
    const v = vm({
      canManageReviewerAssignments: false,
      mayFinalizePublishApproval: false,
      viewerCampaignReviewerRole: "reviewer",
    });
    expect(v.capabilities.canManageReviewerAssignments).toBe(false);
    expect(v.capabilities.mayFinalizePublishApproval).toBe(false);
    expect(v.capabilities.viewerCampaignReviewerRole).toBe("reviewer");
  });

  it("includes entitlements and anyEntitlementGated when a flag is off", () => {
    const v = vm({
      entitlements: {
        ...ALL_ENTITLEMENTS_ON,
        scheduledReportDeliveryEnabled: false,
      },
      governancePlanTierLabel: "standard",
    });
    expect(v.entitlements.scheduledReportDeliveryEnabled).toBe(false);
    expect(v.anyEntitlementGated).toBe(true);
    expect(v.governancePlanTierLabel).toBe("standard");
  });
});

describe("campaign governance operator doc", () => {
  it("exists and mentions key migrations and cron paths", () => {
    const docPath = join(__dirname, "../../../docs/internal/campaign-governance-operators.md");
    expect(existsSync(docPath)).toBe(true);
    const text = readFileSync(docPath, "utf8");
    expect(text).toContain("publish-approval-sla-scan-all");
    expect(text).toContain("publish-approval-report-delivery-run");
    expect(text).toContain("internal_job_runs");
    expect(text).toContain("add_internal_job_runs.sql");
    expect(text).toContain("REVENUE_OS_GOVERNANCE_TIER");
    expect(text).toContain("campaign-governance-inventory.md");
  });

  it("links Part 29 internal artifacts", () => {
    const base = join(__dirname, "../../../docs/internal");
    expect(existsSync(join(base, "campaign-governance-inventory.md"))).toBe(true);
    expect(existsSync(join(base, "campaign-governance-launch-checklist.md"))).toBe(true);
    expect(existsSync(join(base, "campaign-governance-v1-closeout.md"))).toBe(true);
  });
});
