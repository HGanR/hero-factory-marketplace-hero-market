import { evaluateBentleyAutonomousThresholds } from "@/lib/revenue-os/autonomous-thresholds";
import type { BentleyAutonomousCandidate } from "@/lib/revenue-os/autonomous-candidates";
import type { AutonomousPolicyRow } from "@/lib/revenue-os/autonomous-policies-db";
import {
  buildApprovalRequestPayload,
  requiresBentleyApproval,
  summarizeApprovalQueue,
} from "@/lib/revenue-os/autonomous-approvals";
import { runBentleyAutonomousActionEngine } from "@/lib/revenue-os/autonomous-action-engine";
import { buildEmptyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";

function basePolicy(partial: Partial<AutonomousPolicyRow> & Pick<AutonomousPolicyRow, "id" | "actionType">): AutonomousPolicyRow {
  return {
    userId: "u1",
    clientId: "",
    trustId: "",
    isEnabled: true,
    requiresApprovalAboveSeverity: "none",
    maxDailyExecutions: null,
    cooldownMinutes: null,
    policyConfigJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as AutonomousPolicyRow;
}

function baseCandidate(partial: Partial<BentleyAutonomousCandidate>): BentleyAutonomousCandidate {
  return {
    actionType: "auto_archive_stale_draft",
    scope: { clientId: "c1", trustId: "t1" },
    reason: "test",
    riskLevel: "low",
    confidence: 0.8,
    sourceSystem: "test",
    targetIds: ["q1"],
    queueId: "q1",
    estimatedImpact: "x",
    ...partial,
  };
}

describe("evaluateBentleyAutonomousThresholds", () => {
  it("returns auto_execute when policy allows low severity", () => {
    const pol = basePolicy({
      id: "p1",
      actionType: "auto_archive_stale_draft",
      requiresApprovalAboveSeverity: "critical",
    });
    const c = baseCandidate({ actionType: "auto_archive_stale_draft", riskLevel: "low" });
    const r = evaluateBentleyAutonomousThresholds({
      candidate: c,
      policy: pol,
      context: {
        hasOpenBlockingIssue: false,
        connectorReady: true,
        recentFailuresForTarget: 0,
        executionsToday: 0,
        policyCooldownActive: false,
      },
    });
    expect(r.outcome).toBe("auto_execute");
  });

  it("returns require_approval when severity meets threshold", () => {
    const pol = basePolicy({
      id: "p1",
      actionType: "auto_archive_stale_draft",
      requiresApprovalAboveSeverity: "warning",
    });
    const c = baseCandidate({ actionType: "auto_archive_stale_draft", riskLevel: "high" });
    const r = evaluateBentleyAutonomousThresholds({
      candidate: c,
      policy: pol,
      context: {
        hasOpenBlockingIssue: false,
        connectorReady: true,
        recentFailuresForTarget: 0,
        executionsToday: 0,
        policyCooldownActive: false,
      },
    });
    expect(r.outcome).toBe("require_approval");
  });

  it("returns skip when daily cap reached", () => {
    const pol = basePolicy({
      id: "p1",
      actionType: "auto_archive_stale_draft",
      maxDailyExecutions: 1,
    });
    const c = baseCandidate({ actionType: "auto_archive_stale_draft" });
    const r = evaluateBentleyAutonomousThresholds({
      candidate: c,
      policy: pol,
      context: {
        hasOpenBlockingIssue: false,
        connectorReady: true,
        recentFailuresForTarget: 0,
        executionsToday: 1,
        policyCooldownActive: false,
      },
    });
    expect(r.outcome).toBe("skip");
  });
});

describe("autonomous approvals", () => {
  it("requiresBentleyApproval detects require_approval outcome", () => {
    expect(
      requiresBentleyApproval({
        outcome: "require_approval",
        severity: "warning",
        rationale: [],
        confidenceScore: 0.5,
      })
    ).toBe(true);
    expect(
      requiresBentleyApproval({
        outcome: "auto_execute",
        severity: "info",
        rationale: [],
        confidenceScore: 0.5,
      })
    ).toBe(false);
  });

  it("summarizeApprovalQueue builds summary line", () => {
    const s = summarizeApprovalQueue({
      approvalRequests: [
        buildApprovalRequestPayload({
          candidate: baseCandidate({}),
          evaluation: {
            outcome: "require_approval",
            severity: "warning",
            rationale: ["r"],
            confidenceScore: 0.5,
          },
        }),
      ],
    });
    expect(s.pendingApprovalCount).toBe(1);
    expect(s.summaryLine).toMatch(/approval/i);
  });
});

jest.mock("@/lib/revenue-os/operator-intelligence", () => {
  const actual = jest.requireActual("@/lib/revenue-os/operator-intelligence") as typeof import("@/lib/revenue-os/operator-intelligence");
  return {
    ...actual,
    buildBentleyOperatorOverview: jest.fn(),
  };
});

jest.mock("@/lib/revenue-os/autonomous-candidates", () => {
  const actual = jest.requireActual("@/lib/revenue-os/autonomous-candidates") as typeof import("@/lib/revenue-os/autonomous-candidates");
  return {
    ...actual,
    collectBentleyAutonomousCandidates: jest.fn(),
  };
});

jest.mock("@/lib/revenue-os/autonomous-policies-db", () => {
  const actual = jest.requireActual("@/lib/revenue-os/autonomous-policies-db") as typeof import("@/lib/revenue-os/autonomous-policies-db");
  return {
    ...actual,
    listAutonomousPoliciesForUser: jest.fn(),
    countAutonomousRunsTodayForPolicy: jest.fn().mockResolvedValue(0),
    countAutonomousRunsSinceForPolicy: jest.fn().mockResolvedValue(0),
    insertAutonomousActionRun: jest.fn().mockResolvedValue({ id: "r1", ok: true }),
  };
});

jest.mock("@/lib/revenue-os/notification-db", () => {
  const actual = jest.requireActual("@/lib/revenue-os/notification-db") as typeof import("@/lib/revenue-os/notification-db");
  return {
    ...actual,
    insertNotificationEvent: jest.fn().mockResolvedValue({ ok: true, id: "e1" }),
  };
});

jest.mock("@/lib/revenue-os/autonomous-audit", () => ({
  writeBentleyAutonomousAuditEntry: jest.fn().mockResolvedValue({ id: "audit1", ok: true }),
  summarizeBentleyAutonomousAudit: jest.fn().mockResolvedValue({
    total: 0,
    byStatus: {},
    executedCount: 0,
    failedCount: 0,
    rejectedCount: 0,
    approvalRequiredCount: 0,
    summaryLine: "No audit data.",
  }),
  listBentleyAutonomousAuditEntries: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/revenue-os/autonomous-approval-queue", () => {
  const actual = jest.requireActual("@/lib/revenue-os/autonomous-approval-queue") as typeof import("@/lib/revenue-os/autonomous-approval-queue");
  return {
    ...actual,
    createApprovalRequestsFromDecisions: jest.fn().mockResolvedValue({ created: [], ids: [] }),
  };
});

import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { collectBentleyAutonomousCandidates as mockCollect } from "@/lib/revenue-os/autonomous-candidates";
import { listAutonomousPoliciesForUser as mockListPolicies } from "@/lib/revenue-os/autonomous-policies-db";

describe("runBentleyAutonomousActionEngine", () => {
  const mockOverview = buildBentleyOperatorOverview as jest.MockedFunction<typeof buildBentleyOperatorOverview>;
  const mockCollectFn = mockCollect as jest.MockedFunction<typeof mockCollect>;
  const mockPolicies = mockListPolicies as jest.MockedFunction<typeof mockListPolicies>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOverview.mockResolvedValue(buildEmptyOperatorOverview("u1"));
    mockCollectFn.mockResolvedValue([]);
    mockPolicies.mockResolvedValue([]);
  });

  it("no-ops without user id", async () => {
    const s = await runBentleyAutonomousActionEngine({ userId: "" });
    expect(s.noOp).toBe(true);
  });

  it("no-ops when no enabled policies", async () => {
    mockPolicies.mockResolvedValue([basePolicy({ id: "p1", actionType: "auto_archive_stale_draft", isEnabled: false })]);
    const s = await runBentleyAutonomousActionEngine({ userId: "u1" });
    expect(s.noOp).toBe(true);
  });

  it("dryRun with candidates does not throw", async () => {
    mockPolicies.mockResolvedValue([
      basePolicy({ id: "p1", actionType: "auto_archive_stale_draft", isEnabled: true, requiresApprovalAboveSeverity: "none" }),
    ]);
    mockCollectFn.mockResolvedValue([
      baseCandidate({ actionType: "auto_archive_stale_draft", queueId: "q1" }),
    ]);
    const s = await runBentleyAutonomousActionEngine({ userId: "u1", dryRun: true, maxCandidates: 5 });
    expect(s.ok).toBe(true);
    expect(s.candidatesFound).toBeGreaterThan(0);
  });
});

describe("collectBentleyAutonomousCandidates resilience", () => {
  it("returns empty for blank user", async () => {
    const { collectBentleyAutonomousCandidates: realCollect } = jest.requireActual<
      typeof import("@/lib/revenue-os/autonomous-candidates")
    >("@/lib/revenue-os/autonomous-candidates");
    const c = await realCollect({ userId: "" });
    expect(c).toEqual([]);
  });
});
