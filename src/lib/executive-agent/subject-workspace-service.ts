import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { clientServiceOrders } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  buildSubjectSkipperContext,
  extractSubjectMemoryHighlights,
  filterOrdersForScope,
  filterRecommendationsForScope,
  filterTimelineForScope,
} from "@/lib/executive-agent/subject-memory-context";
import {
  resolveSubjectWorkspace,
  type ResolveSubjectWorkspaceInput,
} from "@/lib/executive-agent/subject-workspace-state";
import type { SubjectExecutiveWorkspaceDto } from "@/lib/executive-agent/subject-workspace-types";
import type { ExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import { auditFulfillmentExecutiveAction } from "@/lib/fulfillment/fulfillment-audit";
import {
  buildClientFulfillmentOperations,
  buildExecutiveFulfillmentOperationsMemoryInsights,
  buildExecutiveFulfillmentOperationsOverview,
} from "@/lib/fulfillment/fulfillment-operations-service";
import {
  FULFILLMENT_DEPARTMENT_SITE_BUILDER,
  FULFILLMENT_DEPARTMENT_TRUST_RECORDS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

type Db = MySql2Database<typeof schema>;

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

async function loadOrderContext(
  db: Db,
  input: { adminUserId: number; orderId: string }
): Promise<{ department: FulfillmentOrchestrationDepartment | null; clientId: string | null }> {
  const [row] = await db
    .select({
      clientId: clientServiceOrders.clientId,
      primaryService: clientServiceOrders.primaryService,
      assignedDepartment: clientServiceOrders.assignedDepartment,
    })
    .from(clientServiceOrders)
    .where(
      and(
        eq(clientServiceOrders.id, input.orderId),
        eq(clientServiceOrders.ownerAdminUserId, input.adminUserId)
      )
    )
    .limit(1);
  return {
    department: row ? departmentFromOrder(row) : null,
    clientId: row?.clientId?.trim() ?? null,
  };
}

function buildDeskWorkspaceHeadline(scope: ReturnType<typeof resolveSubjectWorkspace>): string {
  if (scope.workspaceKind === "website") {
    return "WEBSITE fulfillment desk — Site Builder drafts and owner review (no deploy from workspace).";
  }
  if (scope.workspaceKind === "trust") {
    return "TRUST legal-review desk — Jarva packets only; no trust apply or client-facing adaptation.";
  }
  if (scope.workspaceKind === "client") {
    return "Client executive review — cross-department fulfillment graph and recommendations.";
  }
  if (scope.workspaceKind === "fulfillment_case") {
    return "Fulfillment case review — single-order timeline, recommendations, and memory signals.";
  }
  return `${scope.label} — read-only orchestration context for Skipper.`;
}

export async function buildSubjectExecutiveWorkspace(
  db: Db,
  input: {
    adminUserId: number;
    subjectId: ExecutiveSubjectId;
    clientId?: string | null;
    orderId?: string | null;
  }
): Promise<SubjectExecutiveWorkspaceDto> {
  const orderId = input.orderId?.trim() || null;
  let orderDepartment: FulfillmentOrchestrationDepartment | null = null;
  let orderClientId: string | null = null;
  if (orderId) {
    const orderCtx = await loadOrderContext(db, {
      adminUserId: input.adminUserId,
      orderId,
    });
    orderDepartment = orderCtx.department;
    orderClientId = orderCtx.clientId;
  }

  const resolveInput: ResolveSubjectWorkspaceInput = {
    subjectId: input.subjectId,
    clientId: input.clientId?.trim() || orderClientId,
    orderId,
    orderDepartment,
  };
  const scope = resolveSubjectWorkspace(resolveInput);

  let timeline: SubjectExecutiveWorkspaceDto["timeline"] = [];
  let timelineSummary: string | null = null;
  let recommendations: SubjectExecutiveWorkspaceDto["recommendations"] = [];
  let orders: SubjectExecutiveWorkspaceDto["orders"] = [];
  let health: SubjectExecutiveWorkspaceDto["health"] = null;
  let skipperBrief: string | null = null;

  const clientId = scope.clientId ?? input.clientId?.trim() ?? null;

  if (
    clientId &&
    (scope.workspaceKind === "client" ||
      scope.workspaceKind === "fulfillment_case" ||
      scope.workspaceKind === "website" ||
      scope.workspaceKind === "trust")
  ) {
    const clientOps = await buildClientFulfillmentOperations(db, {
      adminUserId: input.adminUserId,
      clientId,
    });
    if (clientOps.ok) {
      timeline = filterTimelineForScope(clientOps.timeline, scope);
      timelineSummary = clientOps.timelineSummary;
      recommendations = filterRecommendationsForScope(clientOps.recommendations, scope);
      orders = filterOrdersForScope(clientOps.orders, scope);
      health = clientOps.health;
      skipperBrief = clientOps.skipperBrief;
      if (!scope.clientId && clientOps.clientId) {
        scope.clientId = clientOps.clientId;
      }
    }
  } else if (scope.workspaceKind === "website" || scope.workspaceKind === "trust") {
    const overview = await buildExecutiveFulfillmentOperationsOverview(db, {
      adminUserId: input.adminUserId,
      limit: 40,
    });
    const dept = scope.department!;
    const clientRows = overview.clients.filter((c) => c.activeDepartments.includes(dept));
    skipperBrief =
      clientRows.length > 0
        ? `${dept} desk: ${clientRows.length} active client(s); ${overview.totals.pendingApprovals} pending approval(s).`
        : `No active ${dept} clients on desk.`;
    recommendations = [];
    orders = [];
    timeline = [];
    timelineSummary = overview.bottlenecks
      .filter((b) => b.department === dept)
      .map((b) => b.summary)
      .join("; ");
  } else {
    const overview = await buildExecutiveFulfillmentOperationsOverview(db, {
      adminUserId: input.adminUserId,
      limit: 25,
    });
    skipperBrief = `Desk: ${overview.totals.activeOrders} active order(s), ${overview.totals.stalledClients} stalled client(s).`;
    timelineSummary = overview.bottlenecks.slice(0, 3).map((b) => b.summary).join("; ");
  }

  const memoryInsights = await buildExecutiveFulfillmentOperationsMemoryInsights(db, {
    adminUserId: input.adminUserId,
    limit: 60,
  });
  const memoryHighlights = extractSubjectMemoryHighlights(memoryInsights, scope);

  const headline = buildDeskWorkspaceHeadline(scope);
  const activeOrderIds = orders.map((o) => o.orderId);
  let skipperContext = buildSubjectSkipperContext({
    scope,
    headline,
    timelineSummary,
    skipperBrief,
    recommendations,
    memoryHighlights,
    activeOrderIds,
  });

  try {
    const { buildExecutiveOperationalThreadsContext } = await import(
      "@/lib/executive-agent/operational-thread-service"
    );
    const threadsCtx = await buildExecutiveOperationalThreadsContext(db, {
      adminUserId: input.adminUserId,
      subjectId: input.subjectId,
      clientId: scope.clientId,
      orderId: scope.orderId,
      limit: 12,
    });
    if (threadsCtx.skipperThreadContext) {
      skipperContext = `${skipperContext} ${threadsCtx.skipperThreadContext}`;
    }
  } catch {
    /* threads table may be absent in some dev DBs */
  }

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "executive.subject.workspace",
    actionType: "subject_workspace_viewed",
    targetType: scope.orderId ? "fulfillment_order" : scope.clientId ? "client" : "platform",
    targetId: scope.orderId ?? scope.clientId ?? scope.subjectId,
    inputJson: {
      subjectId: input.subjectId,
      workspaceKind: scope.workspaceKind,
      department: scope.department,
    },
    outputJson: {
      recommendationCount: recommendations.length,
      timelineCount: timeline.length,
      orderCount: orders.length,
    },
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    scope,
    headline,
    skipperContext,
    timeline,
    timelineSummary,
    recommendations,
    orders,
    health,
    memoryHighlights,
    skipperBrief,
    meta: {
      recommendationOnly: true,
      noAutonomousExecution: true,
      readOnlyWorkspace: true,
    },
  };
}
