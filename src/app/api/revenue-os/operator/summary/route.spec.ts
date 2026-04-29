/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import {
  buildPolicyWorkbenchGuidanceLines,
  mergePolicyWorkbenchGuidanceIntoGrowthGuidance,
} from "@/lib/revenue-os/policy-workbench-guidance";
import {
  mergeRolloutGuidanceIntoGrowthGuidance,
  mergeRolloutMonitoringGuidanceIntoGrowthGuidance,
} from "@/lib/revenue-os/rollout-guidance";
import { mergeRollbackPackageGuidanceIntoGrowthGuidance } from "@/lib/revenue-os/rollback-guidance";
import * as operatorIntel from "@/lib/revenue-os/operator-intelligence";

jest.mock("@/lib/api/auth");
jest.mock("@/lib/revenue-os/bentley-correlation-server", () => ({
  logBentleyCorrelationEvent: jest.fn(),
}));

jest.mock("@/lib/revenue-os/operator-intelligence", () => {
  const actual = jest.requireActual("@/lib/revenue-os/operator-intelligence") as typeof operatorIntel;
  return {
    ...actual,
    buildBentleyOperatorOverview: jest.fn(),
  };
});

jest.mock("@/lib/revenue-os/operator-dashboard-ui", () => ({
  buildOperatorDashboardUiPayload: jest.fn(() => ({ ui: "dashboard" })),
}));

jest.mock("@/lib/revenue-os/operator-digest", () => ({
  buildBentleyOperatorDigest: jest.fn(() => ({ digest: true })),
}));

jest.mock("@/lib/revenue-os/operator-action-planner", () => ({
  planBentleyOperatorActions: jest.fn(() => ({ immediateActions: [], todayActions: [] })),
}));

jest.mock("@/lib/revenue-os/proactive-automation-guidance", () => ({
  buildProactiveAutomationGuidance: jest.fn(async () => ({})),
}));

jest.mock("@/lib/revenue-os/automation-policies-db", () => ({
  listAutomationPoliciesForUser: jest.fn(async () => []),
  listAutomationRunsForUser: jest.fn(async () => []),
}));

jest.mock("@/lib/revenue-os/automation-dashboard-ui", () => ({
  buildAutomationDashboardUiPayload: jest.fn(() => ({ automation: true })),
}));

jest.mock("@/lib/revenue-os/exception-detection", () => ({
  detectBentleyExceptions: jest.fn(() => ({
    criticalExceptions: [],
    warningExceptions: [],
    exceptionSummary: "ok",
    recommendedEscalations: [],
  })),
}));

jest.mock("@/lib/revenue-os/notification-dashboard-ui", () => ({
  buildNotificationDashboardUiPayload: jest.fn(async () => ({ notifications: true })),
  buildNotificationEscalationGuidance: jest.fn(async () => ({})),
}));

jest.mock("@/lib/revenue-os/autonomous-dashboard-ui", () => ({
  buildAutonomousDashboardUiPayload: jest.fn(async () => ({})),
  buildAutonomousGuidanceFromDashboard: jest.fn(async () => ({})),
}));

jest.mock("@/lib/revenue-os/autonomous-approval-ui", () => ({
  buildAutonomousApprovalUiPayload: jest.fn(async () => ({
    pendingApprovals: [],
    bySeverity: {},
    byActionType: {},
    expiringSoon: [],
    recentlyApproved: [],
    recentlyRejected: [],
    actionPreviewCards: [],
    generatedAt: new Date().toISOString(),
  })),
}));

jest.mock("@/lib/revenue-os/autonomous-audit-ui", () => ({
  buildAutonomousAuditUiPayload: jest.fn(async () => ({})),
}));

jest.mock("@/lib/revenue-os/autonomous-audit", () => ({
  summarizeBentleyAutonomousAudit: jest.fn(async () => ({})),
}));

jest.mock("@/lib/revenue-os/policy-workbench-guidance", () => {
  const actual = jest.requireActual("@/lib/revenue-os/policy-workbench-guidance") as typeof import("@/lib/revenue-os/policy-workbench-guidance");
  return {
    ...actual,
    buildPolicyWorkbenchGuidanceLines: jest.fn(),
  };
});

jest.mock("@/lib/revenue-os/rollout-guidance", () => {
  const actual = jest.requireActual("@/lib/revenue-os/rollout-guidance") as typeof import("@/lib/revenue-os/rollout-guidance");
  return {
    ...actual,
    buildRolloutGuidanceLines: jest.fn(() => ({})),
  };
});

jest.mock("@/lib/revenue-os/rollout-monitoring", () => {
  const actual = jest.requireActual("@/lib/revenue-os/rollout-monitoring") as typeof import("@/lib/revenue-os/rollout-monitoring");
  return {
    ...actual,
    getBentleyRolloutMonitoringSnapshot: jest.fn(async () => null),
  };
});

jest.mock("@/lib/revenue-os/policy-rollback-db", () => {
  const actual = jest.requireActual("@/lib/revenue-os/policy-rollback-db") as typeof import("@/lib/revenue-os/policy-rollback-db");
  return {
    ...actual,
    getLatestSavedRollbackPackageForUser: jest.fn(async () => null),
  };
});

const getAuthedUserIdMock = getAuthedUserId as jest.MockedFunction<typeof getAuthedUserId>;
const buildPolicyWorkbenchGuidanceLinesMock = buildPolicyWorkbenchGuidanceLines as jest.MockedFunction<
  typeof buildPolicyWorkbenchGuidanceLines
>;
const buildBentleyOperatorOverviewMock = operatorIntel.buildBentleyOperatorOverview as jest.MockedFunction<
  typeof operatorIntel.buildBentleyOperatorOverview
>;

function req() {
  return new NextRequest("http://localhost/api/revenue-os/operator/summary");
}

beforeEach(() => {
  jest.clearAllMocks();
  buildBentleyOperatorOverviewMock.mockImplementation(async () =>
    operatorIntel.buildEmptyOperatorOverview("test-user")
  );
});

describe("GET /api/revenue-os/operator/summary", () => {
  it("signed-out: growthGuidance and policyWorkbenchGuidance are null", async () => {
    getAuthedUserIdMock.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      signedOut: boolean;
      policyWorkbenchGuidance: unknown;
      growthGuidance: unknown;
    };
    expect(data.signedOut).toBe(true);
    expect(data.policyWorkbenchGuidance).toBeNull();
    expect(data.growthGuidance).toBeNull();
  });

  it("authenticated with workbench guidance lines: growthGuidance matches merge(null, pw)", async () => {
    getAuthedUserIdMock.mockResolvedValue("user-1");
    const pw = {
      bentleyPolicyWorkbenchSummaryLine: "Policy workbench: 2 saved scenario(s)",
      bentleyScenarioCompareSummaryLine: "A is safest; B shows higher upside.",
      bentleyScenarioPresetRecommendationLine: "Try Balanced preset.",
      bentleyApplyReviewSummaryLine: "Confirm payload before POST.",
    };
    buildPolicyWorkbenchGuidanceLinesMock.mockResolvedValue(pw);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      signedOut: boolean;
      policyWorkbenchGuidance: typeof pw;
      growthGuidance: ReturnType<typeof mergePolicyWorkbenchGuidanceIntoGrowthGuidance>;
    };
    expect(data.signedOut).toBe(false);
    expect(data.policyWorkbenchGuidance).toEqual(pw);
    expect(data.growthGuidance).toEqual(
      mergeRollbackPackageGuidanceIntoGrowthGuidance(
        mergeRolloutMonitoringGuidanceIntoGrowthGuidance(
          mergeRolloutGuidanceIntoGrowthGuidance(mergePolicyWorkbenchGuidanceIntoGrowthGuidance(null, pw), {}),
          null
        ),
        null
      )
    );
    expect(buildPolicyWorkbenchGuidanceLinesMock).toHaveBeenCalledWith({
      userId: "user-1",
      clientId: undefined,
      trustId: undefined,
    });
  });

  it("authenticated with no workbench lines: growthGuidance is null, policyWorkbenchGuidance is empty object", async () => {
    getAuthedUserIdMock.mockResolvedValue("user-1");
    buildPolicyWorkbenchGuidanceLinesMock.mockResolvedValue({});

    const res = await GET(req());
    const data = (await res.json()) as {
      policyWorkbenchGuidance: Record<string, unknown>;
      growthGuidance: null;
    };
    expect(data.policyWorkbenchGuidance).toEqual({});
    expect(data.growthGuidance).toBeNull();
  });
});
