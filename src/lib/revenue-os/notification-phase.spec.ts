import type { DetectBentleyExceptionsResult } from "@/lib/revenue-os/exception-detection";
import { routeBentleyEscalations } from "@/lib/revenue-os/escalation-routing";
import type { NotificationChannelRow, NotificationPolicyRow } from "@/lib/revenue-os/notification-db";
import {
  buildBentleyOperatorOverview,
  buildEmptyOperatorOverview,
} from "@/lib/revenue-os/operator-intelligence";
import {
  buildNotificationDashboardUiPayload,
  buildNotificationEscalationGuidance,
} from "@/lib/revenue-os/notification-dashboard-ui";
import { deliverBentleyNotification, deliverBentleyNotificationsBatch } from "@/lib/revenue-os/notification-delivery";
import {
  buildBentleyNotificationEvents,
  buildReportReadyHintsFromFlags,
  dedupeBentleyNotificationEvents,
} from "@/lib/revenue-os/notification-events";
import { runBentleyNotificationEngine } from "@/lib/revenue-os/notification-engine";
import type { OperatorWorkspaceSummary } from "@/lib/revenue-os/operator-types";
import { prioritizeBentleyWorkspaces } from "@/lib/revenue-os/workspace-prioritization";

jest.mock("@/lib/revenue-os/operator-intelligence", () => {
  const actual = jest.requireActual("@/lib/revenue-os/operator-intelligence") as typeof import("@/lib/revenue-os/operator-intelligence");
  return {
    ...actual,
    buildBentleyOperatorOverview: jest.fn(),
  };
});

jest.mock("@/lib/revenue-os/proactive-automation-guidance", () => ({
  buildProactiveAutomationGuidance: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/revenue-os/automation-policies-db", () => ({
  listAutomationPoliciesForUser: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/revenue-os/notification-db", () => {
  const actual = jest.requireActual("@/lib/revenue-os/notification-db") as typeof import("@/lib/revenue-os/notification-db");
  return {
    ...actual,
    fetchRecentDedupeKeysForUser: jest.fn().mockResolvedValue(new Set<string>()),
    listNotificationChannelsForUser: jest.fn().mockResolvedValue([]),
    listNotificationPoliciesForUser: jest.fn().mockResolvedValue([]),
    insertNotificationEvent: jest.fn().mockResolvedValue({ ok: true, id: "event-id-1" }),
  };
});

function sampleSummary(
  partial: Partial<OperatorWorkspaceSummary> & { workspace: OperatorWorkspaceSummary["workspace"] }
): OperatorWorkspaceSummary {
  return {
    queueTotal: 0,
    draftCount: 0,
    failedCount: 0,
    approvedOrScheduledCount: 0,
    publishedUnsyncedCount: 0,
    archivedCount: 0,
    blockedConnectorTargets: 0,
    promotionReadyCount: 0,
    suppressedAssetCount: 0,
    staleBacklogCount: 0,
    activeExperimentIds: [],
    openHandoffs: 0,
    handoffReadyLeads: 0,
    leadSignalTotal: 0,
    connectorPlatformsConnected: 0,
    connectorAutoPublishReady: 0,
    cadenceSummary: null,
    cadencePlan: null,
    lastCadenceRunAt: null,
    healthScore: 70,
    ...partial,
  };
}

function emptyExceptions(): DetectBentleyExceptionsResult {
  return {
    criticalExceptions: [],
    warningExceptions: [],
    exceptionSummary: "none",
    recommendedEscalations: [],
  };
}

function channelRow(partial: Partial<NotificationChannelRow> & Pick<NotificationChannelRow, "id" | "userId">): NotificationChannelRow {
  return {
    channelType: "in_app",
    channelLabel: "In-app",
    channelConfigJson: null,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as NotificationChannelRow;
}

function policyRow(
  partial: Partial<NotificationPolicyRow> & Pick<NotificationPolicyRow, "id" | "userId" | "channelId" | "eventType">
): NotificationPolicyRow {
  return {
    clientId: "",
    trustId: "",
    minimumSeverity: "info",
    isEnabled: true,
    policyConfigJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as NotificationPolicyRow;
}

describe("buildBentleyNotificationEvents", () => {
  it("emits report-ready events from hints without regenerating reports", () => {
    const o = buildEmptyOperatorOverview("u1");
    const events = buildBentleyNotificationEvents({
      userId: "u1",
      overview: o,
      exceptions: emptyExceptions(),
      reportHints: buildReportReadyHintsFromFlags({
        dailyOperatorReportReady: true,
        weeklyExecutiveReportReady: true,
      }),
    });
    const types = events.map((e) => e.eventType);
    expect(types).toContain("daily_operator_report_ready");
    expect(types).toContain("weekly_executive_report_ready");
    expect(events.find((e) => e.eventType === "daily_operator_report_ready")?.severity).toBe("info");
  });

  it("emits handoff backlog and publish failure events from global summary", () => {
    const base = buildEmptyOperatorOverview("u1");
    base.globalSummary.totalHandoffReadyLeads = 5;
    base.globalSummary.totalFailedPublishes = 2;
    const events = buildBentleyNotificationEvents({
      userId: "u1",
      overview: base,
      exceptions: emptyExceptions(),
    });
    expect(events.some((e) => e.eventType === "handoff_backlog_threshold")).toBe(true);
    expect(events.some((e) => e.eventType === "repeated_publish_failures")).toBe(true);
  });

  it("emits critical_exception_detected from exception list", () => {
    const o = buildEmptyOperatorOverview("u1");
    const ex: DetectBentleyExceptionsResult = {
      criticalExceptions: [{ code: "unit_test", severity: "critical", message: "boom" }],
      warningExceptions: [],
      exceptionSummary: "1 critical",
      recommendedEscalations: ["fix it"],
    };
    const events = buildBentleyNotificationEvents({ userId: "u1", overview: o, exceptions: ex });
    const c = events.find((e) => e.eventType === "critical_exception_detected");
    expect(c?.title).toContain("unit_test");
    expect(c?.recommendedAction).toBe("fix it");
  });

  it("emits connector gap on top workspace when blocked targets threshold met", () => {
    const ws = sampleSummary({
      workspace: { clientId: "c1", trustId: "t1" },
      promotionReadyCount: 2,
      blockedConnectorTargets: 3,
    });
    const prio = prioritizeBentleyWorkspaces({ workspaceSummaries: [ws] });
    const base = buildEmptyOperatorOverview("u1");
    const overview = { ...base, workspaceSummaries: [ws], prioritization: prio };
    const events = buildBentleyNotificationEvents({
      userId: "u1",
      overview,
      exceptions: emptyExceptions(),
    });
    expect(events.some((e) => e.eventType === "severe_connector_gap_top_workspace")).toBe(true);
    expect(events.some((e) => e.eventType === "winners_not_promoted")).toBe(true);
  });
});

describe("dedupeBentleyNotificationEvents", () => {
  it("drops events whose dedupeKey exists in DB set or duplicates in batch", () => {
    const o = buildEmptyOperatorOverview("u1");
    const built = buildBentleyNotificationEvents({
      userId: "u1",
      overview: o,
      exceptions: emptyExceptions(),
      reportHints: { dailyOperatorReportReady: true },
    });
    const first = built[0];
    expect(first).toBeDefined();
    const duped = dedupeBentleyNotificationEvents({
      events: [first!, first!, first!],
      existingDedupeKeys: new Set(),
    });
    expect(duped).toHaveLength(1);

    const suppressed = dedupeBentleyNotificationEvents({
      events: [first!],
      existingDedupeKeys: new Set([first!.dedupeKey]),
    });
    expect(suppressed).toHaveLength(0);
  });
});

describe("routeBentleyEscalations", () => {
  const draft = buildBentleyNotificationEvents({
    userId: "u1",
    overview: buildEmptyOperatorOverview("u1"),
    exceptions: emptyExceptions(),
    reportHints: { dailyOperatorReportReady: true },
  })[0]!;

  it("routes when policy matches event type, scope, severity, and channel enabled", () => {
    const ch = channelRow({ id: "ch1", userId: "u1", channelType: "in_app", isEnabled: true });
    const pol = policyRow({
      id: "p1",
      userId: "u1",
      channelId: "ch1",
      eventType: "daily_operator_report_ready",
      minimumSeverity: "info",
    });
    const r = routeBentleyEscalations({ events: [draft], policies: [pol], channels: [ch] });
    expect(r.routedDeliveries).toHaveLength(1);
    expect(r.skippedDeliveries.some((s) => s.reason === "no_policies_configured")).toBe(false);
  });

  it("skips when no policies configured but still records summary", () => {
    const ch = channelRow({ id: "ch1", userId: "u1", isEnabled: true });
    const r = routeBentleyEscalations({ events: [draft], policies: [], channels: [ch] });
    expect(r.routedDeliveries).toHaveLength(0);
    expect(r.skippedDeliveries.some((s) => s.reason === "no_policies_configured")).toBe(true);
  });

  it("skips scoped policy when event scope does not match", () => {
    const scoped = { ...draft, scope: { clientId: "c9", trustId: "t9" } };
    const ch = channelRow({ id: "ch1", userId: "u1", isEnabled: true });
    const pol = policyRow({
      id: "p1",
      userId: "u1",
      channelId: "ch1",
      eventType: scoped.eventType,
      clientId: "other",
      trustId: "other",
      minimumSeverity: "info",
    });
    const r = routeBentleyEscalations({ events: [scoped], policies: [pol], channels: [ch] });
    expect(r.routedDeliveries).toHaveLength(0);
  });

  it("skips when severity is below policy minimum", () => {
    const ch = channelRow({ id: "ch1", userId: "u1", isEnabled: true });
    const pol = policyRow({
      id: "p1",
      userId: "u1",
      channelId: "ch1",
      eventType: draft.eventType,
      minimumSeverity: "critical",
    });
    const r = routeBentleyEscalations({ events: [draft], policies: [pol], channels: [ch] });
    expect(r.routedDeliveries).toHaveLength(0);
    expect(r.skippedDeliveries.some((s) => s.reason === "severity_below_minimum")).toBe(true);
  });
});

describe("deliverBentleyNotification", () => {
  it("dryRun returns skipped with mock payload and does not require DB", async () => {
    const ch = channelRow({ id: "ch1", userId: "u1", channelType: "in_app" });
    const draft = buildBentleyNotificationEvents({
      userId: "u1",
      overview: buildEmptyOperatorOverview("u1"),
      exceptions: emptyExceptions(),
      reportHints: { dailyOperatorReportReady: true },
    })[0]!;
    const r = await deliverBentleyNotification({
      userId: "u1",
      eventId: "evt-1",
      channel: ch,
      draft,
      dryRun: true,
    });
    expect(r.deliveryStatus).toBe("skipped");
    expect(r.mock).toBe(true);
    expect(r.payloadPreview?.title).toBe(draft.title);
  });

  it("batch dryRun aggregates without throwing", async () => {
    const ch = channelRow({ id: "ch1", userId: "u1", channelType: "email_placeholder" });
    const draft = buildBentleyNotificationEvents({
      userId: "u1",
      overview: buildEmptyOperatorOverview("u1"),
      exceptions: emptyExceptions(),
      reportHints: { dailyOperatorReportReady: true },
    })[0]!;
    const batch = await deliverBentleyNotificationsBatch({
      userId: "u1",
      dryRun: true,
      items: [{ eventId: "e1", channel: ch, draft }],
    });
    expect(batch.results).toHaveLength(1);
    expect(batch.failedCount).toBe(0);
  });
});

describe("buildNotificationDashboardUiPayload", () => {
  it("returns safe empty payload when userId is blank", async () => {
    const p = await buildNotificationDashboardUiPayload({ userId: "", generatedAt: new Date().toISOString() });
    expect(p.unreadInApp).toEqual([]);
    expect(p.dedupeSuppressionSummary).toContain("No user");
  });
});

describe("buildNotificationEscalationGuidance", () => {
  it("returns signed-out safe line when no user", async () => {
    const g = await buildNotificationEscalationGuidance({ userId: "" });
    expect(g.bentleyNotificationSummaryLine).toMatch(/Sign in/i);
  });
});

describe("runBentleyNotificationEngine", () => {
  const mockOverview = buildBentleyOperatorOverview as jest.MockedFunction<typeof buildBentleyOperatorOverview>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOverview.mockResolvedValue(buildEmptyOperatorOverview("u1"));
  });

  it("no-ops for empty userId", async () => {
    const s = await runBentleyNotificationEngine({ userId: "  " });
    expect(s.noOp).toBe(true);
    expect(mockOverview).not.toHaveBeenCalled();
  });

  it("no-ops when skipIfQuiet and nothing notable", async () => {
    mockOverview.mockResolvedValue(buildEmptyOperatorOverview("u1"));
    const s = await runBentleyNotificationEngine({ userId: "u1", skipIfQuiet: true, dryRun: false });
    expect(s.noOp).toBe(true);
    expect(s.eventsBuilt).toBe(0);
    expect(s.routingSummary).toContain("quiet");
  });

  it("dryRun builds events and routes without persisting events", async () => {
    const rich = buildEmptyOperatorOverview("u1");
    rich.globalSummary.totalHandoffReadyLeads = 6;
    mockOverview.mockResolvedValue(rich);
    const s = await runBentleyNotificationEngine({ userId: "u1", dryRun: true, skipIfQuiet: false });
    expect(s.eventsBuilt).toBeGreaterThan(0);
    expect(s.eventsPersisted).toBe(0);
    expect(s.routingSummary).toMatch(/routed/);
  });

  it("resilience: no channels/policies still completes ok with skipped routing", async () => {
    const rich = buildEmptyOperatorOverview("u1");
    rich.globalSummary.totalHandoffReadyLeads = 6;
    mockOverview.mockResolvedValue(rich);
    const s = await runBentleyNotificationEngine({ userId: "u1", dryRun: true });
    expect(s.ok).toBe(true);
    expect(s.skippedRoutingSummary).toMatch(/skipped/);
  });
});
