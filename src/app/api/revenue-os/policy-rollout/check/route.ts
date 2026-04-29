import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import {
  getPolicyRolloutPlanByIdForUser,
  getLatestRolloutRunForPlan,
  getPolicyRolloutRunByIdForUser,
  updatePolicyRolloutRun,
  insertPolicyRolloutStageCheck,
  type PolicyRolloutPlanRow,
} from "@/lib/revenue-os/policy-rollout-db";
import { monitorBentleyRolloutPlan } from "@/lib/revenue-os/rollout-monitoring";
import { buildRolloutMonitoringUiPayload } from "@/lib/revenue-os/rollout-monitoring-ui";
import {
  emitRolloutMonitoringNotification,
  rolloutNotificationKindFromMonitoring,
} from "@/lib/revenue-os/rollout-notifications";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
function scopeFromPlan(plan: PolicyRolloutPlanRow): { clientId?: string; trustId?: string } {
  const s = plan.scopeJson;
  if (!s || typeof s !== "object") return {};
  const o = s as Record<string, unknown>;
  return {
    clientId: typeof o.clientId === "string" ? o.clientId : undefined,
    trustId: typeof o.trustId === "string" ? o.trustId : undefined,
  };
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-rollout/check", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const uid = String(userId);
    const body = (await req.json()) as {
      planId?: string;
      persist?: boolean;
      runId?: string | null;
    };
    const planId = String(body.planId ?? "").trim();
    if (!planId) {
      return NextResponse.json({ error: "planId required" }, { status: 400 });
    }

    const plan = await getPolicyRolloutPlanByIdForUser({ userId: uid, planId });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    let run =
      body.runId?.trim() != null && body.runId.trim() !== ""
        ? (await getPolicyRolloutRunByIdForUser({ userId: uid, runId: body.runId.trim() }))?.run ?? null
        : await getLatestRolloutRunForPlan({ rolloutPlanId: plan.id });

    if (body.runId?.trim() && !run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const sc = scopeFromPlan(plan);
    const overview = await buildBentleyOperatorOverview({
      userId: uid,
      clientIds: sc.clientId ? [sc.clientId] : undefined,
      trustIds: sc.trustId ? [sc.trustId] : undefined,
    });

    const monitoring = monitorBentleyRolloutPlan({ plan, run, overview });
    const ui = buildRolloutMonitoringUiPayload(monitoring, { planId: plan.id, runId: run?.id ?? null });

    const persist = Boolean(body.persist);
    if (persist) {
      if (!run) {
        return NextResponse.json(
          { error: "No rollout run to persist — start a run (e.g. advance stage) or omit persist." },
          { status: 400 }
        );
      }

      const prev = run.monitoringSummaryJson;
      const prevRec = prev && typeof prev === "object" ? (prev as Record<string, unknown>) : {};
      const prevLm = prevRec.lastMonitoring as
        | { rolloutHealth?: string; recommendedNextAction?: string }
        | undefined;

      const baselineObservation =
        prevRec.baselineObservation != null && typeof prevRec.baselineObservation === "object"
          ? prevRec.baselineObservation
          : monitoring.observation;

      const monitoringSummaryJson: Record<string, unknown> = {
        ...prevRec,
        baselineObservation,
        lastObservation: monitoring.observation,
        lastMonitoring: {
          rolloutHealth: monitoring.rolloutHealth,
          recommendedNextAction: monitoring.recommendedNextAction,
          at: new Date().toISOString(),
        },
      };

      const stageStatus =
        monitoring.rolloutHealth === "critical"
          ? "breached"
          : monitoring.rolloutHealth === "warning"
            ? "warning"
            : "healthy";

      const checkStatus =
        monitoring.breachedTriggers.length >= 2 || monitoring.rolloutHealth === "critical"
          ? "breached"
          : monitoring.rolloutHealth === "warning"
            ? "warning"
            : "healthy";

      await updatePolicyRolloutRun({
        runId: run.id,
        monitoringSummaryJson,
        stageProgressJson: {
          successProgress: monitoring.successProgress,
          breachedTriggers: monitoring.breachedTriggers,
        },
        recommendedAction: monitoring.recommendedNextAction,
        stageStatus,
        ...(monitoring.recommendedNextAction === "recommend_rollback" && !run.rollbackTriggeredAt
          ? { rollbackTriggeredAt: new Date() }
          : {}),
      });

      await insertPolicyRolloutStageCheck({
        rolloutRunId: run.id,
        stageIndex: monitoring.activeStageIndex,
        checkStatus,
        observedMetricsJson: monitoring.observation as unknown as Record<string, unknown>,
        triggerBreachesJson: monitoring.breachedTriggers,
        successProgressJson: monitoring.successProgress,
      });

      const shouldEmit =
        !prevLm ||
        prevLm.rolloutHealth !== monitoring.rolloutHealth ||
        prevLm.recommendedNextAction !== monitoring.recommendedNextAction;

      if (shouldEmit) {
        const kind = rolloutNotificationKindFromMonitoring(monitoring);
        const summary = `Stage ${monitoring.activeStageIndex + 1} (${monitoring.stageLabel}): ${monitoring.rolloutHealth} — next: ${monitoring.recommendedNextAction.replace(/_/g, " ")}`;
        await emitRolloutMonitoringNotification({
          userId: uid,
          clientId: sc.clientId ?? "default",
          trustId: sc.trustId ?? "default",
          kind,
          planId: plan.id,
          runId: run.id,
          summary,
          monitoring,
        });
      }
    }

    return NextResponse.json({
      dryRun: !persist,
      plan,
      run,
      monitoring,
      ui,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
