import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import {
  buildBentleyOperatorOverview,
  buildEmptyOperatorOverview,
} from "@/lib/revenue-os/operator-intelligence";
import { buildOperatorDashboardUiPayload } from "@/lib/revenue-os/operator-dashboard-ui";
import { buildBentleyOperatorDigest } from "@/lib/revenue-os/operator-digest";
import { planBentleyOperatorActions } from "@/lib/revenue-os/operator-action-planner";
import { buildProactiveAutomationGuidance } from "@/lib/revenue-os/proactive-automation-guidance";
import { listAutomationPoliciesForUser, listAutomationRunsForUser } from "@/lib/revenue-os/automation-policies-db";
import { buildAutomationDashboardUiPayload } from "@/lib/revenue-os/automation-dashboard-ui";
import { detectBentleyExceptions } from "@/lib/revenue-os/exception-detection";
import {
  buildNotificationDashboardUiPayload,
  buildNotificationEscalationGuidance,
} from "@/lib/revenue-os/notification-dashboard-ui";
import {
  buildAutonomousDashboardUiPayload,
  buildAutonomousGuidanceFromDashboard,
} from "@/lib/revenue-os/autonomous-dashboard-ui";
import { buildAutonomousApprovalUiPayload } from "@/lib/revenue-os/autonomous-approval-ui";
import { buildAutonomousAuditUiPayload } from "@/lib/revenue-os/autonomous-audit-ui";
import { summarizeBentleyAutonomousAudit } from "@/lib/revenue-os/autonomous-audit";
import {
  buildPolicyWorkbenchGuidanceLines,
  mergePolicyWorkbenchGuidanceIntoGrowthGuidance,
} from "@/lib/revenue-os/policy-workbench-guidance";
import { buildBentleyRolloutCoaching } from "@/lib/revenue-os/rollout-coaching";
import {
  buildRolloutGuidanceLines,
  mergeRolloutGuidanceIntoGrowthGuidance,
  mergeRolloutMonitoringGuidanceIntoGrowthGuidance,
} from "@/lib/revenue-os/rollout-guidance";
import { getBentleyRolloutMonitoringSnapshot } from "@/lib/revenue-os/rollout-monitoring";
import { getLatestSavedRollbackPackageForUser } from "@/lib/revenue-os/policy-rollback-db";
import { mergeRollbackPackageGuidanceIntoGrowthGuidance } from "@/lib/revenue-os/rollback-guidance";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
function parseBool(v: string | null, defaultTrue: boolean): boolean {
  if (v == null) return defaultTrue;
  const lower = v.toLowerCase();
  if (lower === "false" || lower === "0") return false;
  if (lower === "true" || lower === "1") return true;
  return defaultTrue;
}

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/operator/summary", req);
    const sp = req.nextUrl.searchParams;
    const includeWorkspaces = parseBool(sp.get("includeWorkspaces"), true);
    const includeActions = parseBool(sp.get("includeActions"), true);
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;

    const userId = await getAuthedUserId();
    if (userId == null) {
      const empty = buildEmptyOperatorOverview("");
      const emptyEx = detectBentleyExceptions({ overview: empty });
      return NextResponse.json({
        signedOut: true,
        generatedAt: empty.generatedAt,
        operatorOverview: null,
        rankedWorkspaces: [],
        operatorActions: null,
        digest: null,
        ui: buildOperatorDashboardUiPayload(empty),
        proactiveGuidance: null,
        automationWidgets: buildAutomationDashboardUiPayload({
          policies: [],
          recentRuns: [],
          criticalExceptions: emptyEx.criticalExceptions,
          generatedAt: empty.generatedAt,
        }),
        notificationEscalation: null,
        notificationWidgets: await buildNotificationDashboardUiPayload({
          userId: "",
          generatedAt: empty.generatedAt,
        }),
        autonomousGuidance: null,
        autonomousWidgets: await buildAutonomousDashboardUiPayload({
          userId: "",
          generatedAt: empty.generatedAt,
        }),
        autonomousApprovalUi: await buildAutonomousApprovalUiPayload({
          userId: "",
          generatedAt: empty.generatedAt,
        }),
        autonomousAuditUi: await buildAutonomousAuditUiPayload({
          userId: "",
          generatedAt: empty.generatedAt,
        }),
        autonomousAuditSummary: null,
        policyWorkbenchGuidance: null,
        growthGuidance: null,
      });
    }

    const uid = String(userId);
    const overview = await buildBentleyOperatorOverview({
      userId: uid,
      clientIds: clientId ? [clientId] : undefined,
      trustIds: trustId ? [trustId] : undefined,
    });

    const redactedOverview = includeWorkspaces
      ? overview
      : {
          ...overview,
          workspaceSummaries: [],
          prioritization: {
            ...overview.prioritization,
            rankedWorkspaces: [],
            topUrgentWorkspace: null,
            topOpportunityWorkspace: null,
            deprioritizedWorkspaces: [],
          },
        };

    const rankedWorkspaces = includeWorkspaces ? overview.prioritization.rankedWorkspaces : [];

    const operatorActions = includeActions
      ? planBentleyOperatorActions({
          workspaceSummaries: overview.workspaceSummaries,
          prioritization: overview.prioritization,
        })
      : null;

    const digest = buildBentleyOperatorDigest({ overview });

    const proactiveGuidance = await buildProactiveAutomationGuidance({
      userId: uid,
      clientId,
      trustId,
      overview,
    });
    const policies = await listAutomationPoliciesForUser({
      userId: uid,
      clientId,
      trustId,
    });
    const recentRuns = await listAutomationRunsForUser({ userId: uid, limit: 40 });
    const exDetect = detectBentleyExceptions({ overview });
    const automationWidgets = buildAutomationDashboardUiPayload({
      policies,
      recentRuns,
      criticalExceptions: exDetect.criticalExceptions,
      generatedAt: overview.generatedAt,
    });

    const notificationWidgets = await buildNotificationDashboardUiPayload({
      userId: uid,
      generatedAt: overview.generatedAt,
    });
    const notificationEscalation = await buildNotificationEscalationGuidance({
      userId: uid,
      lastEngineRun: null,
    });

    const autonomousWidgets = await buildAutonomousDashboardUiPayload({
      userId: uid,
      generatedAt: overview.generatedAt,
    });
    const autonomousGuidance = await buildAutonomousGuidanceFromDashboard({
      userId: uid,
      generatedAt: overview.generatedAt,
      clientId,
      trustId,
    });

    const policyWorkbenchGuidance = await buildPolicyWorkbenchGuidanceLines({
      userId: uid,
      clientId,
      trustId,
    });

    const [autonomousApprovalUi, autonomousAuditUi, autonomousAuditSummary] = await Promise.all([
      buildAutonomousApprovalUiPayload({
        userId: uid,
        generatedAt: overview.generatedAt,
        clientId,
        trustId,
      }),
      buildAutonomousAuditUiPayload({
        userId: uid,
        generatedAt: overview.generatedAt,
        clientId,
        trustId,
      }),
      summarizeBentleyAutonomousAudit({
        userId: uid,
        clientId,
        trustId,
        sinceMs: Date.now() - 7 * 24 * 60 * 60 * 1000,
      }),
    ]);

    const rolloutCoaching = buildBentleyRolloutCoaching({
      overview,
      autonomousApprovalPendingCount: autonomousApprovalUi.pendingApprovals.length,
    });
    const rolloutMonitoring = await getBentleyRolloutMonitoringSnapshot({ userId: uid, overview });
    const rollbackPkg = await getLatestSavedRollbackPackageForUser({ userId: uid });
    const growthGuidance = mergeRollbackPackageGuidanceIntoGrowthGuidance(
      mergeRolloutMonitoringGuidanceIntoGrowthGuidance(
        mergeRolloutGuidanceIntoGrowthGuidance(
          mergePolicyWorkbenchGuidanceIntoGrowthGuidance(null, policyWorkbenchGuidance),
          buildRolloutGuidanceLines(rolloutCoaching)
        ),
        rolloutMonitoring
      ),
      rollbackPkg
    );

    return NextResponse.json({
      signedOut: false,
      generatedAt: overview.generatedAt,
      operatorOverview: redactedOverview,
      rankedWorkspaces,
      operatorActions,
      digest,
      ui: buildOperatorDashboardUiPayload(overview),
      proactiveGuidance,
      automationWidgets,
      notificationEscalation,
      notificationWidgets,
      autonomousGuidance,
      autonomousWidgets,
      autonomousApprovalUi,
      autonomousAuditUi,
      autonomousAuditSummary,
      policyWorkbenchGuidance,
      growthGuidance,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
