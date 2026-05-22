import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  clientServiceOrderEvents,
  clientServiceOrders,
  executiveAgentApprovals,
  executiveAgentAuditLogs,
  executiveAgentMemoryItems,
  fulfillmentDeliverables,
} from "@/lib/db/schema";
import {
  buildSharedClientReadinessSummary,
  computeClientHealthScore,
} from "@/lib/fulfillment/client-health-score";
import type {
  ExecutiveKpiForecastDto,
  ExecutiveKpiOverviewDto,
  ExecutiveKpiEngineInput,
} from "@/lib/fulfillment/executive-kpi-forecast-types";
import { buildExecutiveKpiOverviewFromEngine } from "@/lib/fulfillment/executive-kpi-engine";
import { buildExecutiveKpiForecastFromEngine } from "@/lib/fulfillment/fulfillment-forecasting";
import { auditFulfillmentExecutiveAction } from "@/lib/fulfillment/fulfillment-audit";
import { buildExecutiveFulfillmentOperationalMemoryInsights } from "@/lib/fulfillment/fulfillment-operational-memory-insights-builder";
import type { ClientFulfillmentOrderSnapshot } from "@/lib/fulfillment/fulfillment-orchestration-types";
import {
  buildExecutiveFulfillmentOperationsOverview,
  loadFulfillmentOrderSnapshotsForExecutive,
} from "@/lib/fulfillment/fulfillment-operations-service";

type Db = MySql2Database<typeof schema>;

const FULFILLMENT_ACTIONS = [
  "createSiteBuilderTask",
  "createTrustFulfillmentPacket",
  "createRevenueOsCampaignReviewPacket",
  "recordRevenueOsLaunchReadinessCheckpoint",
  "createSmartTrustGovernanceReviewPacket",
  "recordSmartTrustResolutionCheckpoint",
] as const;

async function buildKpiEngineInput(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveKpiEngineInput> {
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 100);

  const [snapshots, overview] = await Promise.all([
    loadFulfillmentOrderSnapshotsForExecutive(db, {
      adminUserId: input.adminUserId,
      rowLimit: limit * 5,
    }),
    buildExecutiveFulfillmentOperationsOverview(db, {
      adminUserId: input.adminUserId,
      limit,
    }),
  ]);

  const orderRows = await db
    .select()
    .from(clientServiceOrders)
    .where(eq(clientServiceOrders.ownerAdminUserId, input.adminUserId))
    .orderBy(desc(clientServiceOrders.updatedAt))
    .limit(limit * 4);

  const fulfillmentRows = orderRows.filter((r) =>
    snapshots.some((s) => s.orderId === r.id)
  );
  const orderIds = fulfillmentRows.map((r) => r.id);
  const snapshotByOrder = new Map(snapshots.map((s) => [s.orderId, s]));

  const orderIdToDept = new Map(
    fulfillmentRows.map((r) => [r.id, snapshotByOrder.get(r.id)?.department ?? null] as const)
  );

  const [deliverableRows, approvalHistoryRows, eventRows, auditRows, memoryRows] =
    await Promise.all([
      orderIds.length
        ? db
            .select({
              orderId: fulfillmentDeliverables.orderId,
              ownerReviewStatus: fulfillmentDeliverables.ownerReviewStatus,
              clientDeliveryStatus: fulfillmentDeliverables.clientDeliveryStatus,
              draftVersion: fulfillmentDeliverables.draftVersion,
            })
            .from(fulfillmentDeliverables)
            .where(inArray(fulfillmentDeliverables.orderId, orderIds))
        : Promise.resolve([]),
      db
        .select({
          proposedAction: executiveAgentApprovals.proposedAction,
          targetId: executiveAgentApprovals.targetId,
          status: executiveAgentApprovals.status,
          createdAt: executiveAgentApprovals.createdAt,
          executedAt: executiveAgentApprovals.executedAt,
        })
        .from(executiveAgentApprovals)
        .where(
          and(
            eq(executiveAgentApprovals.adminUserId, input.adminUserId),
            inArray(executiveAgentApprovals.proposedAction, [...FULFILLMENT_ACTIONS])
          )
        )
        .orderBy(desc(executiveAgentApprovals.createdAt))
        .limit(200),
      orderIds.length
        ? db
            .select({
              orderId: clientServiceOrderEvents.orderId,
              toStage: clientServiceOrderEvents.toStage,
            })
            .from(clientServiceOrderEvents)
            .where(inArray(clientServiceOrderEvents.orderId, orderIds))
        : Promise.resolve([]),
      db
        .select({ actionType: executiveAgentAuditLogs.actionType })
        .from(executiveAgentAuditLogs)
        .where(eq(executiveAgentAuditLogs.adminUserId, input.adminUserId))
        .orderBy(desc(executiveAgentAuditLogs.createdAt))
        .limit(80),
      db
        .select({ title: executiveAgentMemoryItems.title })
        .from(executiveAgentMemoryItems)
        .where(eq(executiveAgentMemoryItems.adminUserId, input.adminUserId))
        .limit(40),
    ]);

  const deliverableByOrder = new Map(deliverableRows.map((d) => [d.orderId, d]));
  const revisionEventsByOrder = new Map<string, number>();
  for (const e of eventRows) {
    if (e.toStage.includes("revision")) {
      revisionEventsByOrder.set(e.orderId, (revisionEventsByOrder.get(e.orderId) ?? 0) + 1);
    }
  }

  const memoryDto = buildExecutiveFulfillmentOperationalMemoryInsights({
    orders: snapshots.map((s) => {
      const del = deliverableByOrder.get(s.orderId);
      return {
        orderId: s.orderId,
        clientId: s.clientId,
        department: s.department,
        pipelineStage: s.pipelineStage,
        approvalStatus: s.approvalStatus,
        ownerReviewStatus: del?.ownerReviewStatus ?? "pending",
        clientDeliveryStatus: del?.clientDeliveryStatus ?? "not_sent",
        draftVersion: del?.draftVersion ?? s.revisionRound ?? 1,
        daysInCurrentStage: s.daysInCurrentStage,
        paymentConsumed: s.paymentConsumed,
        updatedAt: s.updatedAt,
        createdAt: s.createdAt,
      };
    }),
    approvals: approvalHistoryRows.map((a) => ({
      proposedAction: a.proposedAction,
      status: a.status,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
      executedAt:
        a.executedAt instanceof Date
          ? a.executedAt.toISOString()
          : a.executedAt
            ? String(a.executedAt)
            : null,
      department: orderIdToDept.get(a.targetId ?? "") ?? null,
    })),
    revisionEventsByOrder,
    auditActionTypes: auditRows.map((r) => r.actionType),
    memoryItemTitles: memoryRows.map((m) => m.title).filter(Boolean) as string[],
  });

  const byClient = new Map<string, ClientFulfillmentOrderSnapshot[]>();
  for (const s of snapshots) {
    const list = byClient.get(s.clientId) ?? [];
    list.push(s);
    byClient.set(s.clientId, list);
  }

  const healthByClient: ExecutiveKpiEngineInput["healthByClient"] = [];
  for (const [clientId, clientOrders] of byClient.entries()) {
    const rowMeta = fulfillmentRows.filter((r) => r.clientId === clientId);
    const readiness = buildSharedClientReadinessSummary({
      clientId,
      orders: rowMeta.map((r) => ({
        primaryService: r.primaryService,
        executiveHandoffJson: r.executiveHandoffJson,
        salesSummaryText: r.salesSummaryText,
        requestedDeliverableJson: r.requestedDeliverableJson,
        pipelineStage: r.pipelineStage,
      })),
    });
    const health = computeClientHealthScore({ clientId, orders: clientOrders, readiness });
    healthByClient.push({
      clientId,
      tier: health.tier,
      score: health.score,
      stalled: health.stalled,
    });
  }

  return {
    snapshots,
    bottlenecks: overview.bottlenecks,
    approvalLatency: memoryDto.memory.approvalLatency,
    clientLifecycle: memoryDto.memory.clientLifecycle,
    outcomes: memoryDto.memory.outcomes,
    healthByClient,
  };
}

export async function buildExecutiveKpiOverview(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveKpiOverviewDto> {
  const engineInput = await buildKpiEngineInput(db, input);
  const body = buildExecutiveKpiOverviewFromEngine(engineInput);

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "executive.kpi.overview",
    actionType: "kpi_overview_viewed",
    targetType: "platform",
    inputJson: { limit: input.limit },
    outputJson: {
      healthScore: body.operationalHealth.score,
      activeOrders: body.totals.activeOrders,
    },
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    ...body,
    meta: {
      forecastingOnly: true,
      recommendationOnly: true,
      noAutonomousExecution: true,
    },
  };
}

export async function buildExecutiveKpiForecast(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveKpiForecastDto> {
  const engineInput = await buildKpiEngineInput(db, input);
  const body = buildExecutiveKpiForecastFromEngine(engineInput);

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "executive.kpi.forecast",
    actionType: "kpi_forecast_viewed",
    targetType: "platform",
    inputJson: { limit: input.limit },
    outputJson: {
      riskAlertCount: body.riskAlerts.length,
      projectedStalls: body.projectedBacklog.projectedStallsNext7d,
    },
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    ...body,
    meta: {
      forecastingOnly: true,
      recommendationOnly: true,
      noAutonomousExecution: true,
      explainable: true,
    },
  };
}

/** Compact bundle for Skipper read tools. */
export async function buildExecutiveKpiIntelligenceForSkipper(
  db: Db,
  input: { adminUserId: number; limit?: number; mode?: "overview" | "forecast" | "both" }
) {
  const mode = input.mode ?? "both";
  const overview =
    mode === "forecast" ? null : await buildExecutiveKpiOverview(db, input);
  const forecast =
    mode === "overview" ? null : await buildExecutiveKpiForecast(db, input);

  return {
    recommendationOnly: true,
    forecastingOnly: true,
    overview: overview
      ? {
          operationalHealth: overview.operationalHealth,
          velocity: overview.velocity,
          metrics: overview.metrics.slice(0, 8),
          departmentWorkload: overview.departmentWorkload,
          totals: overview.totals,
          healthByTier: overview.healthByTier,
          skipperSummary: overview.skipperSummary,
        }
      : null,
    forecast: forecast
      ? {
          operationalHealth: forecast.operationalHealth,
          riskAlerts: forecast.riskAlerts.slice(0, 12),
          fulfillmentDelays: forecast.fulfillmentDelays.slice(0, 10),
          revisionRisks: forecast.revisionRisks.slice(0, 8),
          approvalDelays: forecast.approvalDelays.slice(0, 8),
          projectedBacklog: forecast.projectedBacklog,
          forecastRecommendations: forecast.forecastAwareRecommendations.slice(0, 8),
          skipperSummary: forecast.skipperSummary,
        }
      : null,
    meta: {
      noAutonomousExecution: true,
      noAutonomousReassignment: true,
      noAutomaticApprovals: true,
    },
    generatedAt: new Date().toISOString(),
  };
}
