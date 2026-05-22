import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildExecutiveKpiOverviewFromEngine } from "@/lib/fulfillment/executive-kpi-engine";
import { buildExecutiveKpiForecastFromEngine, buildForecastAwareRecommendations } from "@/lib/fulfillment/fulfillment-forecasting";
import { buildBottleneckForecasts } from "@/lib/fulfillment/bottleneck-forecasting";
import { buildRevisionRiskForecasts } from "@/lib/fulfillment/revision-risk-forecast";
import { buildApprovalDelayForecasts } from "@/lib/fulfillment/approval-delay-forecast";
import { buildDepartmentWorkloadBalance } from "@/lib/fulfillment/department-workload-balance";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";
import type { ExecutiveKpiEngineInput } from "@/lib/fulfillment/executive-kpi-forecast-types";
import type { ClientFulfillmentOrderSnapshot } from "@/lib/fulfillment/fulfillment-orchestration-types";

function snap(partial: Partial<ClientFulfillmentOrderSnapshot> & { orderId: string; clientId: string; department: ClientFulfillmentOrderSnapshot["department"] }): ClientFulfillmentOrderSnapshot {
  return {
    assignedDepartment: "site_builder",
    pipelineStage: "service_drafting",
    approvalStatus: "none",
    ownerReviewStatus: null,
    paymentStatus: "confirmed",
    paymentConsumed: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    daysInCurrentStage: 3,
    ...partial,
  };
}

const baseEngine: ExecutiveKpiEngineInput = {
  snapshots: [
    snap({ orderId: "o1", clientId: "c1", department: "WEBSITE", daysInCurrentStage: 10, approvalStatus: "pending" }),
    snap({ orderId: "o2", clientId: "c2", department: "REVENUE_OS", daysInCurrentStage: 12, revisionRound: 3 }),
    snap({ orderId: "o3", clientId: "c3", department: "SMART_TRUST", daysInCurrentStage: 9, governanceReviewRound: 1 }),
  ],
  bottlenecks: [
    { id: "b1", department: "WEBSITE", stage: "service_drafting", orderCount: 2, summary: "WEBSITE stalled in drafting" },
  ],
  approvalLatency: [
    {
      proposedAction: "createSiteBuilderTask",
      department: "WEBSITE",
      sampleCount: 3,
      medianHoursToExecute: 80,
      fastestHours: 24,
      slowestHours: 120,
    },
  ],
  clientLifecycle: [
    { clientId: "c2", guidanceScore: 40, revisionBurden: "high", departmentsActive: ["REVENUE_OS"], insight: "Heavy revisions" },
  ],
  outcomes: [
    {
      orderId: "o2",
      clientId: "c2",
      department: "REVENUE_OS",
      outcome: "revenue_os_kpi_watch",
      revisionCount: 2,
      daysInStage: 12,
      summary: "KPI watch on campaign",
    },
    {
      orderId: "o3",
      clientId: "c3",
      department: "SMART_TRUST",
      outcome: "smart_trust_governance_stalled",
      revisionCount: 0,
      daysInStage: 9,
      summary: "Governance review pending",
    },
  ],
  healthByClient: [
    { clientId: "c1", tier: "at_risk", score: 52, stalled: true },
    { clientId: "c2", tier: "critical", score: 35, stalled: true },
    { clientId: "c3", tier: "steady", score: 68, stalled: false },
  ],
};

describe("executive KPI engine", () => {
  it("builds overview metrics and velocity", () => {
    const overview = buildExecutiveKpiOverviewFromEngine(baseEngine);
    assert.ok(overview.metrics.length >= 4);
    assert.equal(overview.totals.activeOrders, 3);
    assert.ok(overview.velocity.velocityScore >= 0);
    assert.ok(overview.skipperSummary.includes("advisory"));
  });

  it("balances department workload", () => {
    const workload = buildDepartmentWorkloadBalance(baseEngine.snapshots);
    assert.equal(workload.length, 4);
    assert.ok(workload.some((w) => w.department === "WEBSITE"));
  });
});

describe("fulfillment forecasting", () => {
  it("forecasts bottlenecks and revision risk", () => {
    const bottlenecks = buildBottleneckForecasts({
      bottlenecks: baseEngine.bottlenecks,
      snapshots: baseEngine.snapshots,
    });
    assert.ok(bottlenecks.length >= 1);

    const revision = buildRevisionRiskForecasts({
      snapshots: baseEngine.snapshots,
      outcomes: baseEngine.outcomes,
      clientLifecycle: baseEngine.clientLifecycle,
    });
    assert.ok(revision.some((r) => r.clientId === "c2"));
  });

  it("forecasts approval delays for pending orders", () => {
    const delays = buildApprovalDelayForecasts({
      snapshots: baseEngine.snapshots,
      approvalLatency: baseEngine.approvalLatency,
    });
    assert.ok(delays.some((d) => d.pendingCount > 0));
  });

  it("builds forecast with risk alerts and recommendations", () => {
    const forecast = buildExecutiveKpiForecastFromEngine(baseEngine);
    assert.ok(forecast.riskAlerts.length > 0);
    assert.ok(forecast.fulfillmentDelays.length > 0);
    assert.ok(forecast.projectedBacklog.evidence.length > 0);
    const recs = buildForecastAwareRecommendations({ riskAlerts: forecast.riskAlerts });
    assert.ok(recs.every((r) => r.requiresHumanAction === true));
    assert.ok(recs.some((r) => r.title.startsWith("[Forecast]")));
  });
});

describe("Skipper read tool picker", () => {
  it("selects KPI tools for forecast prompts", () => {
    const tools = pickExecutiveReadTools("What is the fulfillment forecast and projected delay?", null, null);
    assert.ok(tools.includes("getExecutiveKpiForecast"));
    assert.ok(tools.includes("getExecutiveKpiOverview"));
  });
});
