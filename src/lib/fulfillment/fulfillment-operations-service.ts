import "server-only";

import { and, desc, eq, inArray, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  campaigns,
  clientServiceOrderEvents,
  clientServiceOrders,
  executiveAgentApprovals,
  fulfillmentDeliverables,
  paymentConfirmations,
} from "@/lib/db/schema";
import { buildClientOperationsGraph } from "@/lib/fulfillment/client-operations-graph";
import {
  buildSharedClientReadinessSummary,
  computeClientHealthScore,
  computeDaysInStage,
} from "@/lib/fulfillment/client-health-score";
import { resolveCrossDepartmentDependencyNarrative } from "@/lib/fulfillment/department-dependency-map";
import {
  buildFulfillmentRecommendations,
  buildFulfillmentSequencingRecommendation,
  detectCrossSellOpportunities,
  detectOperationalBottlenecks,
  summarizeWhatClientStillNeeds,
} from "@/lib/fulfillment/fulfillment-recommendation-engine";
import type {
  ClientFulfillmentOperationsDto,
  ClientFulfillmentOrderSnapshot,
  ExecutiveFulfillmentOperationsOverviewDto,
  FulfillmentOrchestrationDepartment,
} from "@/lib/fulfillment/fulfillment-orchestration-types";
import { auditFulfillmentExecutiveAction } from "@/lib/fulfillment/fulfillment-audit";
import {
  FULFILLMENT_DEPARTMENT_SITE_BUILDER,
  FULFILLMENT_DEPARTMENT_TRUST_RECORDS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";
import {
  buildUnifiedClientTimeline,
  summarizeTimelineForSkipper,
} from "@/lib/fulfillment/unified-client-timeline";
import { buildExecutiveFulfillmentOperationsBriefingFromDesk } from "@/lib/fulfillment/fulfillment-executive-operations-briefing-builder";
import type {
  BriefingApprovalBacklogItem,
  BriefingClientContext,
  BriefingDeskSnapshot,
  BriefingOrderSnapshot,
  ExecutiveFulfillmentOperationsBriefingDto,
} from "@/lib/fulfillment/fulfillment-executive-operations-briefing-types";

type Db = MySql2Database<typeof schema>;

const FULFILLMENT_ACTIONS = ["createSiteBuilderTask", "createTrustFulfillmentPacket"] as const;

function toIso(d: Date | null | undefined): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function departmentFromOrder(row: {
  primaryService: string;
  assignedDepartment: string;
}): FulfillmentOrchestrationDepartment | null {
  if (
    row.primaryService === FULFILLMENT_PRIMARY_SERVICE_WEBSITE &&
    row.assignedDepartment === FULFILLMENT_DEPARTMENT_SITE_BUILDER
  ) {
    return FULFILLMENT_PRIMARY_SERVICE_WEBSITE;
  }
  if (
    row.primaryService === FULFILLMENT_PRIMARY_SERVICE_TRUST &&
    row.assignedDepartment === FULFILLMENT_DEPARTMENT_TRUST_RECORDS
  ) {
    return FULFILLMENT_PRIMARY_SERVICE_TRUST;
  }
  return null;
}

async function loadLatestApprovalsByOrder(
  db: Db,
  input: { adminUserId: number; orderIds: string[] }
): Promise<Map<string, { status: string; proposedAction: string }>> {
  const map = new Map<string, { status: string; proposedAction: string }>();
  if (!input.orderIds.length) return map;

  const rows = await db
    .select({
      targetId: executiveAgentApprovals.targetId,
      status: executiveAgentApprovals.status,
      proposedAction: executiveAgentApprovals.proposedAction,
      createdAt: executiveAgentApprovals.createdAt,
    })
    .from(executiveAgentApprovals)
    .where(
      and(
        eq(executiveAgentApprovals.adminUserId, input.adminUserId),
        inArray(executiveAgentApprovals.proposedAction, [...FULFILLMENT_ACTIONS]),
        inArray(executiveAgentApprovals.targetId, input.orderIds),
        or(
          eq(executiveAgentApprovals.targetType, "client_service_order"),
          eq(executiveAgentApprovals.targetType, "fulfillment_order")
        )
      )
    )
    .orderBy(desc(executiveAgentApprovals.createdAt));

  for (const r of rows) {
    const oid = r.targetId?.trim();
    if (!oid || map.has(oid)) continue;
    map.set(oid, { status: r.status, proposedAction: r.proposedAction });
  }
  return map;
}

function buildOrderSnapshots(
  rows: Array<{
    id: string;
    clientId: string;
    primaryService: string;
    assignedDepartment: string;
    pipelineStage: string;
    paymentConfirmationId: string;
    createdAt: Date;
    updatedAt: Date | null;
    executiveHandoffJson: string | null;
    salesSummaryText: string | null;
    requestedDeliverableJson: string | null;
  }>,
  payments: Map<string, { status: "pending" | "confirmed" | "failed"; consumedAt: Date | null; consumedByOrderId: string | null }>,
  deliverables: Map<
    string,
    {
      ownerReviewStatus: "pending" | "approved" | "rejected";
      clientDeliveryStatus?: "not_sent" | "workspace_active" | "client_approved" | "client_revision_requested";
    }
  >,
  approvals: Map<string, { status: string; proposedAction: string }>
): ClientFulfillmentOrderSnapshot[] {
  const out: ClientFulfillmentOrderSnapshot[] = [];
  for (const row of rows) {
    const dept = departmentFromOrder(row);
    if (!dept) continue;
    const pay = payments.get(row.paymentConfirmationId);
    const del = deliverables.get(row.id);
    const appr = approvals.get(row.id);
    const approvalStatus = (appr?.status ?? "none") as ClientFulfillmentOrderSnapshot["approvalStatus"];

    out.push({
      orderId: row.id,
      clientId: row.clientId,
      department: dept,
      assignedDepartment: row.assignedDepartment,
      pipelineStage: row.pipelineStage,
      approvalStatus,
      ownerReviewStatus: del?.ownerReviewStatus ?? null,
      paymentStatus: pay?.status ?? "pending",
      paymentConsumed: Boolean(pay?.consumedAt ?? pay?.consumedByOrderId),
      createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(row.updatedAt),
      daysInCurrentStage: computeDaysInStage(row.updatedAt, row.createdAt),
    });
  }
  return out;
}

export async function buildClientFulfillmentOperations(
  db: Db,
  input: { adminUserId: number; clientId: string }
): Promise<ClientFulfillmentOperationsDto | { ok: false; code: string; message: string }> {
  const clientId = input.clientId.trim();
  if (!clientId) {
    return { ok: false, code: "invalid_client_id", message: "clientId is required." };
  }

  const orderRows = await db
    .select()
    .from(clientServiceOrders)
    .where(
      and(
        eq(clientServiceOrders.clientId, clientId),
        eq(clientServiceOrders.ownerAdminUserId, input.adminUserId)
      )
    )
    .orderBy(desc(clientServiceOrders.createdAt));

  const fulfillmentRows = orderRows.filter((r) => departmentFromOrder(r) != null);
  const orderIds = fulfillmentRows.map((r) => r.id);
  const paymentIds = [...new Set(fulfillmentRows.map((r) => r.paymentConfirmationId))];

  const [paymentRows, deliverableRows, eventRows, approvalDetailRows, campaignCountRow] =
    await Promise.all([
      paymentIds.length
        ? db
            .select({
              id: paymentConfirmations.id,
              status: paymentConfirmations.status,
              confirmedAt: paymentConfirmations.confirmedAt,
              consumedAt: paymentConfirmations.consumedAt,
              consumedByOrderId: paymentConfirmations.consumedByOrderId,
            })
            .from(paymentConfirmations)
            .where(inArray(paymentConfirmations.id, paymentIds))
        : Promise.resolve([]),
      orderIds.length
        ? db
            .select({
              orderId: fulfillmentDeliverables.orderId,
              ownerReviewStatus: fulfillmentDeliverables.ownerReviewStatus,
            })
            .from(fulfillmentDeliverables)
            .where(inArray(fulfillmentDeliverables.orderId, orderIds))
        : Promise.resolve([]),
      orderIds.length
        ? db
            .select({
              id: clientServiceOrderEvents.id,
              orderId: clientServiceOrderEvents.orderId,
              actorType: clientServiceOrderEvents.actorType,
              fromStage: clientServiceOrderEvents.fromStage,
              toStage: clientServiceOrderEvents.toStage,
              payloadJson: clientServiceOrderEvents.payloadJson,
              createdAt: clientServiceOrderEvents.createdAt,
            })
            .from(clientServiceOrderEvents)
            .where(inArray(clientServiceOrderEvents.orderId, orderIds))
            .orderBy(desc(clientServiceOrderEvents.createdAt))
        : Promise.resolve([]),
      orderIds.length
        ? db
            .select({
              id: executiveAgentApprovals.id,
              targetId: executiveAgentApprovals.targetId,
              status: executiveAgentApprovals.status,
              proposedAction: executiveAgentApprovals.proposedAction,
              createdAt: executiveAgentApprovals.createdAt,
              executedAt: executiveAgentApprovals.executedAt,
            })
            .from(executiveAgentApprovals)
            .where(
              and(
                eq(executiveAgentApprovals.adminUserId, input.adminUserId),
                inArray(executiveAgentApprovals.targetId, orderIds),
                inArray(executiveAgentApprovals.proposedAction, [...FULFILLMENT_ACTIONS])
              )
            )
            .orderBy(desc(executiveAgentApprovals.createdAt))
        : Promise.resolve([]),
      db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.clientId, clientId))
        .limit(50),
    ]);

  const paymentById = new Map(
    paymentRows.map((p) => [
      p.id,
      {
        status: p.status,
        consumedAt: p.consumedAt,
        consumedByOrderId: p.consumedByOrderId,
      },
    ])
  );
  const deliverableByOrder = new Map(deliverableRows.map((d) => [d.orderId, d]));
  const approvals = await loadLatestApprovalsByOrder(db, {
    adminUserId: input.adminUserId,
    orderIds,
  });

  const orders = buildOrderSnapshots(
    fulfillmentRows,
    paymentById,
    deliverableByOrder,
    approvals
  );

  const readiness = buildSharedClientReadinessSummary({
    clientId,
    orders: fulfillmentRows.map((r) => ({
      primaryService: r.primaryService,
      executiveHandoffJson: r.executiveHandoffJson,
      salesSummaryText: r.salesSummaryText,
      requestedDeliverableJson: r.requestedDeliverableJson,
    })),
  });

  const health = computeClientHealthScore({ clientId, orders, readiness });

  const primaryByOrderId = new Map(fulfillmentRows.map((r) => [r.id, r.primaryService]));

  const timeline = buildUnifiedClientTimeline({
    payments: paymentRows.map((p) => ({
      id: p.id,
      status: p.status,
      confirmedAt: p.confirmedAt,
      consumedAt: p.consumedAt,
      orderId: p.consumedByOrderId,
    })),
    events: eventRows.map((e) => ({
      ...e,
      primaryService: primaryByOrderId.get(e.orderId) ?? "UNKNOWN",
    })),
    approvalMarkers: approvalDetailRows.map((a) => ({
      id: a.id,
      orderId: a.targetId ?? "",
      primaryService: primaryByOrderId.get(a.targetId ?? "") ?? "UNKNOWN",
      status: a.status,
      proposedAction: a.proposedAction,
      createdAt: a.createdAt,
      executedAt: a.executedAt,
    })),
  });

  const graph = buildClientOperationsGraph({
    clientId,
    orders,
    campaignCount: campaignCountRow.length,
  });

  const websiteApproved = orders.some(
    (o) =>
      o.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE &&
      (o.pipelineStage === "approved_for_release" || o.pipelineStage === "released")
  );

  const engineInput = {
    clientId,
    orders,
    graph,
    readiness,
    health,
    campaignCount: campaignCountRow.length,
    websiteApprovedForRelease: websiteApproved,
  };

  const recommendations = buildFulfillmentRecommendations(engineInput);
  const crossSellOpportunities = detectCrossSellOpportunities(engineInput);
  const sequencing = buildFulfillmentSequencingRecommendation(orders);

  const web = orders.find((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE);
  const trust = orders.find((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_TRUST);
  const dependencies = resolveCrossDepartmentDependencyNarrative({
    websiteOrderActive: Boolean(web),
    trustOrderActive: Boolean(trust),
    websiteStage: web?.pipelineStage ?? null,
    trustStage: trust?.pipelineStage ?? null,
  });

  const skipperBrief = summarizeWhatClientStillNeeds({ recommendations, readiness, health });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.operations.client",
    actionType: "orchestration_plan_viewed",
    targetType: "client",
    targetId: clientId,
    inputJson: { orderCount: orders.length },
    outputJson: {
      healthScore: health.score,
      stalled: health.stalled,
      recommendationCount: recommendations.length,
      overallFulfillmentReady: readiness.overallFulfillmentReady,
    },
  });

  return {
    ok: true,
    clientId,
    generatedAt: new Date().toISOString(),
    graph,
    readiness,
    health,
    timeline,
    recommendations,
    crossSellOpportunities,
    sequencing,
    dependencies,
    orders,
    meta: {
      recommendationOnly: true,
      noAutonomousExecution: true,
    },
    skipperBrief,
    timelineSummary: summarizeTimelineForSkipper(timeline),
  };
}

export async function buildExecutiveFulfillmentOperationsOverview(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveFulfillmentOperationsOverviewDto> {
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);

  const orderRows = await db
    .select({
      id: clientServiceOrders.id,
      clientId: clientServiceOrders.clientId,
      primaryService: clientServiceOrders.primaryService,
      assignedDepartment: clientServiceOrders.assignedDepartment,
      pipelineStage: clientServiceOrders.pipelineStage,
      paymentConfirmationId: clientServiceOrders.paymentConfirmationId,
      createdAt: clientServiceOrders.createdAt,
      updatedAt: clientServiceOrders.updatedAt,
      executiveHandoffJson: clientServiceOrders.executiveHandoffJson,
      salesSummaryText: clientServiceOrders.salesSummaryText,
      requestedDeliverableJson: clientServiceOrders.requestedDeliverableJson,
    })
    .from(clientServiceOrders)
    .where(eq(clientServiceOrders.ownerAdminUserId, input.adminUserId))
    .orderBy(desc(clientServiceOrders.updatedAt))
    .limit(limit * 5);

  const fulfillmentRows = orderRows.filter((r) => departmentFromOrder(r) != null);
  const orderIds = fulfillmentRows.map((r) => r.id);
  const paymentIds = [...new Set(fulfillmentRows.map((r) => r.paymentConfirmationId))];

  const [paymentRows, deliverableRows, approvalRows] = await Promise.all([
    paymentIds.length
      ? db
          .select({
            id: paymentConfirmations.id,
            status: paymentConfirmations.status,
            consumedAt: paymentConfirmations.consumedAt,
            consumedByOrderId: paymentConfirmations.consumedByOrderId,
          })
          .from(paymentConfirmations)
          .where(inArray(paymentConfirmations.id, paymentIds))
      : Promise.resolve([]),
    orderIds.length
      ? db
          .select({
            orderId: fulfillmentDeliverables.orderId,
            ownerReviewStatus: fulfillmentDeliverables.ownerReviewStatus,
            clientDeliveryStatus: fulfillmentDeliverables.clientDeliveryStatus,
          })
          .from(fulfillmentDeliverables)
          .where(inArray(fulfillmentDeliverables.orderId, orderIds))
      : Promise.resolve([]),
    loadLatestApprovalsByOrder(db, { adminUserId: input.adminUserId, orderIds }),
  ]);

  const paymentById = new Map(
    paymentRows.map((p) => [
      p.id,
      {
        status: p.status as "pending" | "confirmed" | "failed",
        consumedAt: p.consumedAt,
        consumedByOrderId: p.consumedByOrderId,
      },
    ])
  );
  const deliverableByOrder = new Map(deliverableRows.map((d) => [d.orderId, d]));

  const snapshots = buildOrderSnapshots(
    fulfillmentRows,
    paymentById,
    deliverableByOrder,
    approvalRows
  );

  const byClient = new Map<string, ClientFulfillmentOrderSnapshot[]>();
  for (const s of snapshots) {
    const list = byClient.get(s.clientId) ?? [];
    list.push(s);
    byClient.set(s.clientId, list);
  }

  const clients: ExecutiveFulfillmentOperationsOverviewDto["clients"] = [];
  let stalledClients = 0;
  let pendingApprovals = 0;

  for (const [clientId, clientOrders] of byClient.entries()) {
    const readiness = buildSharedClientReadinessSummary({
      clientId,
      orders: fulfillmentRows
        .filter((r) => r.clientId === clientId)
        .map((r) => ({
          primaryService: r.primaryService,
          executiveHandoffJson: r.executiveHandoffJson,
          salesSummaryText: r.salesSummaryText,
          requestedDeliverableJson: r.requestedDeliverableJson,
        })),
    });
    const health = computeClientHealthScore({ clientId, orders: clientOrders, readiness });
    if (health.stalled) stalledClients += 1;
    pendingApprovals += clientOrders.filter((o) => o.approvalStatus === "pending").length;

    const recs = buildFulfillmentRecommendations({
      clientId,
      orders: clientOrders,
      graph: buildClientOperationsGraph({ clientId, orders: clientOrders }),
      readiness,
      health,
      campaignCount: 0,
      websiteApprovedForRelease: clientOrders.some(
        (o) =>
          o.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE &&
          (o.pipelineStage === "approved_for_release" || o.pipelineStage === "released")
      ),
    });

    clients.push({
      clientId,
      healthScore: health.score,
      healthTier: health.tier,
      stalled: health.stalled,
      activeDepartments: [...new Set(clientOrders.map((o) => o.department))],
      topRecommendation: recs[0]?.title ?? null,
    });

    if (clients.length >= limit) break;
  }

  clients.sort((a, b) => a.healthScore - b.healthScore);

  const bottlenecks = detectOperationalBottlenecks(snapshots);
  const activeOrders = snapshots.filter(
    (o) => o.pipelineStage !== "released" && o.pipelineStage !== "closed"
  ).length;

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.operations.overview",
    actionType: "orchestration_overview_viewed",
    targetType: "platform",
    inputJson: { limit },
    outputJson: { activeOrders, stalledClients, clientCount: clients.length },
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    totals: {
      activeOrders,
      stalledClients,
      pendingApprovals,
      websiteOrders: snapshots.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE).length,
      trustOrders: snapshots.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_TRUST).length,
    },
    bottlenecks,
    clients,
    meta: {
      recommendationOnly: true,
      noAutonomousExecution: true,
    },
  };
}

function toBriefingOrderSnapshot(o: ClientFulfillmentOrderSnapshot, clientDeliveryStatus: BriefingOrderSnapshot["clientDeliveryStatus"]): BriefingOrderSnapshot {
  return { ...o, clientDeliveryStatus };
}

export async function buildExecutiveFulfillmentOperationsBriefing(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveFulfillmentOperationsBriefingDto> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);

  const orderRows = await db
    .select()
    .from(clientServiceOrders)
    .where(eq(clientServiceOrders.ownerAdminUserId, input.adminUserId))
    .orderBy(desc(clientServiceOrders.updatedAt))
    .limit(limit * 6);

  const fulfillmentRows = orderRows.filter((r) => departmentFromOrder(r) != null);
  const orderIds = fulfillmentRows.map((r) => r.id);
  const paymentIds = [...new Set(fulfillmentRows.map((r) => r.paymentConfirmationId))];
  const orderIdToClient = new Map(fulfillmentRows.map((r) => [r.id, r.clientId]));
  const orderIdToDept = new Map(
    fulfillmentRows.map((r) => [r.id, departmentFromOrder(r)] as const)
  );

  const [paymentRows, deliverableRows, approvalRows, pendingApprovalRows] = await Promise.all([
    paymentIds.length
      ? db
          .select({
            id: paymentConfirmations.id,
            status: paymentConfirmations.status,
            consumedAt: paymentConfirmations.consumedAt,
            consumedByOrderId: paymentConfirmations.consumedByOrderId,
          })
          .from(paymentConfirmations)
          .where(inArray(paymentConfirmations.id, paymentIds))
      : Promise.resolve([]),
    orderIds.length
      ? db
          .select({
            orderId: fulfillmentDeliverables.orderId,
            ownerReviewStatus: fulfillmentDeliverables.ownerReviewStatus,
            clientDeliveryStatus: fulfillmentDeliverables.clientDeliveryStatus,
          })
          .from(fulfillmentDeliverables)
          .where(inArray(fulfillmentDeliverables.orderId, orderIds))
      : Promise.resolve([]),
    loadLatestApprovalsByOrder(db, { adminUserId: input.adminUserId, orderIds }),
    db
      .select({
        id: executiveAgentApprovals.id,
        targetId: executiveAgentApprovals.targetId,
        proposedAction: executiveAgentApprovals.proposedAction,
        createdAt: executiveAgentApprovals.createdAt,
      })
      .from(executiveAgentApprovals)
      .where(
        and(
          eq(executiveAgentApprovals.adminUserId, input.adminUserId),
          eq(executiveAgentApprovals.status, "pending"),
          inArray(executiveAgentApprovals.proposedAction, [...FULFILLMENT_ACTIONS])
        )
      )
      .orderBy(desc(executiveAgentApprovals.createdAt))
      .limit(50),
  ]);

  const paymentById = new Map(
    paymentRows.map((p) => [
      p.id,
      {
        status: p.status as "pending" | "confirmed" | "failed",
        consumedAt: p.consumedAt,
        consumedByOrderId: p.consumedByOrderId,
      },
    ])
  );
  const deliverableByOrder = new Map(deliverableRows.map((d) => [d.orderId, d]));

  const snapshots = buildOrderSnapshots(
    fulfillmentRows,
    paymentById,
    deliverableByOrder,
    approvalRows
  );

  const briefingOrders: BriefingOrderSnapshot[] = snapshots.map((s) =>
    toBriefingOrderSnapshot(
      s,
      deliverableByOrder.get(s.orderId)?.clientDeliveryStatus ?? "not_sent"
    )
  );

  const approvalBacklog: BriefingApprovalBacklogItem[] = pendingApprovalRows.map((a) => {
    const oid = a.targetId?.trim() ?? null;
    const dept = oid ? orderIdToDept.get(oid) ?? null : null;
    return {
      approvalId: a.id,
      orderId: oid,
      clientId: oid ? orderIdToClient.get(oid) ?? null : null,
      proposedAction: a.proposedAction,
      department: dept,
      createdAt: toIso(a.createdAt),
    };
  });

  const byClient = new Map<string, BriefingOrderSnapshot[]>();
  for (const s of briefingOrders) {
    const list = byClient.get(s.clientId) ?? [];
    list.push(s);
    byClient.set(s.clientId, list);
  }

  const clients: BriefingClientContext[] = [];

  for (const [clientId, clientOrders] of byClient.entries()) {
    const readiness = buildSharedClientReadinessSummary({
      clientId,
      orders: fulfillmentRows
        .filter((r) => r.clientId === clientId)
        .map((r) => ({
          primaryService: r.primaryService,
          executiveHandoffJson: r.executiveHandoffJson,
          salesSummaryText: r.salesSummaryText,
          requestedDeliverableJson: r.requestedDeliverableJson,
        })),
    });
    const health = computeClientHealthScore({ clientId, orders: clientOrders, readiness });

    const web = clientOrders.find((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE);
    const trust = clientOrders.find((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_TRUST);
    const dependencies = resolveCrossDepartmentDependencyNarrative({
      websiteOrderActive: Boolean(web),
      trustOrderActive: Boolean(trust),
      websiteStage: web?.pipelineStage ?? null,
      trustStage: trust?.pipelineStage ?? null,
    });

    const recommendations = buildFulfillmentRecommendations({
      clientId,
      orders: clientOrders,
      graph: buildClientOperationsGraph({ clientId, orders: clientOrders }),
      readiness,
      health,
      campaignCount: 0,
      websiteApprovedForRelease: clientOrders.some(
        (o) =>
          o.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE &&
          (o.pipelineStage === "approved_for_release" || o.pipelineStage === "released")
      ),
    });

    const crossSellOpportunities = detectCrossSellOpportunities({
      clientId,
      orders: clientOrders,
      graph: buildClientOperationsGraph({ clientId, orders: clientOrders }),
      readiness,
      health,
      campaignCount: 0,
      websiteApprovedForRelease: clientOrders.some(
        (o) =>
          o.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE &&
          (o.pipelineStage === "approved_for_release" || o.pipelineStage === "released")
      ),
    });

    clients.push({
      clientId,
      orders: clientOrders,
      readinessFulfillmentReady: readiness.overallFulfillmentReady,
      healthScore: health.score,
      healthTier: health.tier,
      stalled: health.stalled,
      stallReasons: health.stallReasons,
      recommendations,
      crossSellOpportunities,
      websiteDependsOnTrust: dependencies.websiteDependsOnTrust,
      trustDependsOnWebsite: dependencies.trustDependsOnWebsite,
    });

    if (clients.length >= limit) break;
  }

  const deskSnapshot: BriefingDeskSnapshot = {
    orders: briefingOrders,
    clients,
    approvalBacklog,
    bottlenecks: detectOperationalBottlenecks(snapshots).map((b) => ({
      department: b.department,
      stage: b.stage,
      orderCount: b.orderCount,
    })),
  };

  const briefing = buildExecutiveFulfillmentOperationsBriefingFromDesk(deskSnapshot);

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.operations.briefing",
    actionType: "operations_briefing_viewed",
    targetType: "platform",
    inputJson: { limit },
    outputJson: {
      urgentActions: briefing.topUrgentActions.length,
      stalledOrders: briefing.stalledOrders.length,
      approvalBacklog: briefing.approvalBacklog.length,
    },
  });

  return briefing;
}
