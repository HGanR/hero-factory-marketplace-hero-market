/**
 * Policy-governed autonomous operator: candidates → thresholds → dispatch.
 */

import { detectBentleyExceptions } from "@/lib/revenue-os/exception-detection";
import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import {
  collectBentleyAutonomousCandidates,
  type BentleyAutonomousCandidate,
} from "@/lib/revenue-os/autonomous-candidates";
import {
  countAutonomousRunsSinceForPolicy,
  countAutonomousRunsTodayForPolicy,
  insertAutonomousActionRun,
  listAutonomousPoliciesForUser,
  type AutonomousPolicyRow,
} from "@/lib/revenue-os/autonomous-policies-db";
import { evaluateBentleyAutonomousThresholds } from "@/lib/revenue-os/autonomous-thresholds";
import { insertNotificationEvent } from "@/lib/revenue-os/notification-db";
import { writeBentleyAutonomousAuditEntry } from "@/lib/revenue-os/autonomous-audit";
import { createApprovalRequestsFromDecisions } from "@/lib/revenue-os/autonomous-approval-queue";
import { executeBentleyAutonomousCandidate } from "@/lib/revenue-os/autonomous-candidate-execute";

export type RunBentleyAutonomousActionEngineInput = {
  userId: string;
  clientId?: string;
  trustId?: string;
  dryRun?: boolean;
  maxCandidates?: number;
};

export type BentleyAutonomousEngineSummary = {
  ok: boolean;
  dryRun: boolean;
  candidatesFound: number;
  autoExecuted: number;
  approvalRequired: number;
  skipped: number;
  escalated: number;
  failed: number;
  noOp: boolean;
  error?: string;
};

function pickPolicy(policies: AutonomousPolicyRow[], c: BentleyAutonomousCandidate): AutonomousPolicyRow | null {
  const matches = policies.filter((p) => p.isEnabled && p.actionType === c.actionType);
  let best: AutonomousPolicyRow | null = null;
  for (const p of matches) {
    const pc = p.clientId ?? "";
    const pt = p.trustId ?? "";
    if (pc === c.scope.clientId && pt === c.scope.trustId) {
      best = p;
      break;
    }
  }
  if (best) return best;
  for (const p of matches) {
    const pc = p.clientId ?? "";
    const pt = p.trustId ?? "";
    if (pc === "" && pt === "") return p;
  }
  return null;
}

function workspaceConnectorReady(
  overview: Awaited<ReturnType<typeof buildBentleyOperatorOverview>>,
  c: BentleyAutonomousCandidate
): boolean {
  const ws = overview.workspaceSummaries.find(
    (s) => s.workspace.clientId === c.scope.clientId && s.workspace.trustId === c.scope.trustId
  );
  return (ws?.connectorAutoPublishReady ?? 0) > 0;
}

async function emitAutonomousNotification(params: {
  userId: string;
  candidate: BentleyAutonomousCandidate;
  eventType:
    | "autonomous_action_approval_required"
    | "autonomous_action_executed"
    | "autonomous_action_skipped_by_policy"
    | "autonomous_action_failed";
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  payload: Record<string, unknown>;
  dryRun: boolean;
}): Promise<void> {
  if (params.dryRun) return;
  const scope = params.candidate.scope;
  await insertNotificationEvent({
    userId: params.userId,
    clientId: scope.clientId,
    trustId: scope.trustId,
    sourceType: "bentley_autonomous",
    eventType: params.eventType,
    severity: params.severity,
    title: params.title.slice(0, 512),
    body: params.body,
    eventPayloadJson: params.payload,
    dedupeKey: `auto:${params.eventType}:${params.userId}:${params.candidate.actionType}:${params.candidate.targetIds[0] ?? "na"}:${Date.now()}`.slice(
      0,
      191
    ),
  });
}

async function safeAudit(
  fn: () => Promise<{ id: string; ok: boolean }>
): Promise<{ id: string; ok: boolean }> {
  try {
    return await fn();
  } catch (e) {
    console.warn("[autonomous-action-engine] audit write failed", e);
    return { id: "", ok: false };
  }
}

export async function runBentleyAutonomousActionEngine(
  input: RunBentleyAutonomousActionEngineInput
): Promise<BentleyAutonomousEngineSummary> {
  const uid = String(input.userId).trim();
  const dry = Boolean(input.dryRun);
  const maxC = Math.min(80, Math.max(1, input.maxCandidates ?? 24));

  if (!uid) {
    return {
      ok: true,
      dryRun: dry,
      candidatesFound: 0,
      autoExecuted: 0,
      approvalRequired: 0,
      skipped: 0,
      escalated: 0,
      failed: 0,
      noOp: true,
    };
  }

  try {
    const overview = await buildBentleyOperatorOverview({
      userId: uid,
      clientIds: input.clientId ? [input.clientId] : undefined,
      trustIds: input.trustId ? [input.trustId] : undefined,
    });
    const ex = detectBentleyExceptions({ overview });
    const hasOpenBlockingIssue = ex.criticalExceptions.length > 0;

    const policies = await listAutonomousPoliciesForUser({
      userId: uid,
      clientId: input.clientId,
      trustId: input.trustId,
    });

    if (!policies.some((p) => p.isEnabled)) {
      return {
        ok: true,
        dryRun: dry,
        candidatesFound: 0,
        autoExecuted: 0,
        approvalRequired: 0,
        skipped: 0,
        escalated: 0,
        failed: 0,
        noOp: true,
      };
    }

    const candidates = (
      await collectBentleyAutonomousCandidates({
        userId: uid,
        clientId: input.clientId,
        trustId: input.trustId,
        overview,
      })
    ).slice(0, maxC);

    if (candidates.length === 0) {
      return {
        ok: true,
        dryRun: dry,
        candidatesFound: 0,
        autoExecuted: 0,
        approvalRequired: 0,
        skipped: 0,
        escalated: 0,
        failed: 0,
        noOp: true,
      };
    }

    let autoExecuted = 0;
    let approvalRequired = 0;
    let skipped = 0;
    let escalated = 0;
    let failed = 0;

    for (const c of candidates) {
      const policy = pickPolicy(policies, c);
      const execToday = policy ? await countAutonomousRunsTodayForPolicy(policy.id) : 0;
      const cooldownMs = (policy?.cooldownMinutes ?? 0) * 60 * 1000;
      const policyCooldownActive =
        policy && cooldownMs > 0
          ? (await countAutonomousRunsSinceForPolicy(policy.id, Date.now() - cooldownMs)) > 0
          : false;

      const evaluation = evaluateBentleyAutonomousThresholds({
        candidate: c,
        policy,
        context: {
          hasOpenBlockingIssue,
          connectorReady: workspaceConnectorReady(overview, c),
          recentFailuresForTarget: 0,
          executionsToday: execToday,
          policyCooldownActive,
        },
      });

      if (!policy) {
        skipped++;
        await safeAudit(() =>
          writeBentleyAutonomousAuditEntry({
            userId: uid,
            clientId: c.scope.clientId,
            trustId: c.scope.trustId,
            sourceType: "autonomous_engine",
            actionType: c.actionType,
            actionStatus: "skipped",
            targetIdsJson: c.targetIds,
            rationaleJson: { reason: "no_matching_policy" },
          })
        );
        continue;
      }

      if (evaluation.outcome === "skip") {
        skipped++;
        await emitAutonomousNotification({
          userId: uid,
          candidate: c,
          eventType: "autonomous_action_skipped_by_policy",
          severity: "info",
          title: `Skipped: ${c.actionType}`,
          body: evaluation.rationale.join(" ") || c.reason.slice(0, 400),
          payload: { evaluation, policyId: policy.id },
          dryRun: dry,
        });
        await safeAudit(() =>
          writeBentleyAutonomousAuditEntry({
            userId: uid,
            clientId: c.scope.clientId,
            trustId: c.scope.trustId,
            sourceType: "autonomous_engine",
            actionType: c.actionType,
            actionStatus: "skipped",
            targetIdsJson: c.targetIds,
            rationaleJson: { evaluation: evaluation.rationale },
            actionPayloadJson: { policyId: policy.id },
          })
        );
        if (!dry) {
          await insertAutonomousActionRun({
            policyId: policy.id,
            actionType: c.actionType,
            runStatus: "skipped",
            scopeJson: { ...c.scope, targetIds: c.targetIds },
            decisionSummaryJson: { evaluation },
            executedCount: 0,
            skippedCount: 1,
            completedAt: new Date(),
          });
        }
        continue;
      }

      if (evaluation.outcome === "require_approval" || evaluation.outcome === "escalate_only") {
        if (evaluation.outcome === "require_approval") approvalRequired++;
        else escalated++;

        await emitAutonomousNotification({
          userId: uid,
          candidate: c,
          eventType:
            evaluation.outcome === "require_approval"
              ? "autonomous_action_approval_required"
              : "autonomous_action_skipped_by_policy",
          severity: evaluation.outcome === "require_approval" ? "warning" : "critical",
          title:
            evaluation.outcome === "require_approval"
              ? "Approval required for autonomous action"
              : "Autonomous action held (escalate)",
          body: `${c.actionType} — ${evaluation.rationale.join(" ")}`,
          payload: { evaluation, policyId: policy.id, candidate: c },
          dryRun: dry,
        });

        let runId: string | undefined;
        if (!dry) {
          const runIns = await insertAutonomousActionRun({
            policyId: policy.id,
            actionType: c.actionType,
            runStatus: evaluation.outcome === "require_approval" ? "approval_required" : "skipped",
            scopeJson: { ...c.scope, targetIds: c.targetIds },
            decisionSummaryJson: { evaluation },
            executedCount: 0,
            skippedCount: 1,
            completedAt: new Date(),
          });
          runId = runIns.ok ? runIns.id : undefined;

          if (evaluation.outcome === "require_approval" && runId) {
            await createApprovalRequestsFromDecisions({
              dryRun: false,
              decisions: [
                {
                  userId: uid,
                  autonomousRunId: runId,
                  candidate: c,
                  evaluation,
                  policyId: policy.id,
                },
              ],
            });
          }

          await safeAudit(() =>
            writeBentleyAutonomousAuditEntry({
              userId: uid,
              clientId: c.scope.clientId,
              trustId: c.scope.trustId,
              sourceType: "autonomous_engine",
              actionType: c.actionType,
              actionStatus:
                evaluation.outcome === "require_approval" ? "approval_required" : "skipped",
              relatedRunId: runId,
              targetIdsJson: c.targetIds,
              rationaleJson: { evaluation: evaluation.rationale, outcome: evaluation.outcome },
              actionPayloadJson: { policyId: policy.id, candidate: c },
            })
          );
        }
        continue;
      }

      await safeAudit(() =>
        writeBentleyAutonomousAuditEntry({
          userId: uid,
          clientId: c.scope.clientId,
          trustId: c.scope.trustId,
          sourceType: "autonomous_engine",
          actionType: c.actionType,
          actionStatus: "planned",
          targetIdsJson: c.targetIds,
          rationaleJson: { evaluation: evaluation.rationale },
          actionPayloadJson: { policyId: policy.id },
        })
      );

      try {
        const res = await executeBentleyAutonomousCandidate({ userId: uid, candidate: c, dryRun: dry });
        if (res.ok) {
          autoExecuted++;
          await emitAutonomousNotification({
            userId: uid,
            candidate: c,
            eventType: "autonomous_action_executed",
            severity: "info",
            title: `Executed: ${c.actionType}`,
            body: c.reason.slice(0, 400),
            payload: { policyId: policy.id, details: res },
            dryRun: dry,
          });
          await safeAudit(() =>
            writeBentleyAutonomousAuditEntry({
              userId: uid,
              clientId: c.scope.clientId,
              trustId: c.scope.trustId,
              sourceType: "autonomous_engine",
              actionType: c.actionType,
              actionStatus: "executed",
              targetIdsJson: c.targetIds,
              resultPayloadJson: { dispatch: res },
              rationaleJson: { evaluation: evaluation.rationale },
            })
          );
          if (!dry) {
            await insertAutonomousActionRun({
              policyId: policy.id,
              actionType: c.actionType,
              runStatus: "completed",
              scopeJson: { ...c.scope, targetIds: c.targetIds },
              decisionSummaryJson: { evaluation, dispatch: res },
              executedCount: 1,
              skippedCount: 0,
              completedAt: new Date(),
            });
          }
        } else {
          failed++;
          await emitAutonomousNotification({
            userId: uid,
            candidate: c,
            eventType: "autonomous_action_failed",
            severity: "warning",
            title: `Autonomous action failed: ${c.actionType}`,
            body: res.reason ?? "dispatch_failed",
            payload: { policyId: policy.id, evaluation },
            dryRun: dry,
          });
          await safeAudit(() =>
            writeBentleyAutonomousAuditEntry({
              userId: uid,
              clientId: c.scope.clientId,
              trustId: c.scope.trustId,
              sourceType: "autonomous_engine",
              actionType: c.actionType,
              actionStatus: "failed",
              targetIdsJson: c.targetIds,
              resultPayloadJson: { dispatch: res },
              rationaleJson: { evaluation: evaluation.rationale },
            })
          );
          if (!dry) {
            await insertAutonomousActionRun({
              policyId: policy.id,
              actionType: c.actionType,
              runStatus: "failed",
              scopeJson: { ...c.scope, targetIds: c.targetIds },
              decisionSummaryJson: { evaluation, error: res.reason },
              executedCount: 0,
              skippedCount: 0,
              completedAt: new Date(),
            });
          }
        }
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        await emitAutonomousNotification({
          userId: uid,
          candidate: c,
          eventType: "autonomous_action_failed",
          severity: "critical",
          title: `Autonomous action error: ${c.actionType}`,
          body: msg.slice(0, 500),
          payload: { policyId: policy.id },
          dryRun: dry,
        });
        await safeAudit(() =>
          writeBentleyAutonomousAuditEntry({
            userId: uid,
            clientId: c.scope.clientId,
            trustId: c.scope.trustId,
            sourceType: "autonomous_engine",
            actionType: c.actionType,
            actionStatus: "failed",
            targetIdsJson: c.targetIds,
            resultPayloadJson: { error: msg },
            rationaleJson: { evaluation: evaluation.rationale },
          })
        );
        if (!dry) {
          await insertAutonomousActionRun({
            policyId: policy.id,
            actionType: c.actionType,
            runStatus: "failed",
            scopeJson: { ...c.scope, targetIds: c.targetIds },
            decisionSummaryJson: { evaluation, error: msg },
            executedCount: 0,
            skippedCount: 0,
            completedAt: new Date(),
          });
        }
      }
    }

    return {
      ok: true,
      dryRun: dry,
      candidatesFound: candidates.length,
      autoExecuted,
      approvalRequired,
      skipped,
      escalated,
      failed,
      noOp: autoExecuted === 0 && approvalRequired === 0 && failed === 0 && escalated === 0,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      dryRun: dry,
      candidatesFound: 0,
      autoExecuted: 0,
      approvalRequired: 0,
      skipped: 0,
      escalated: 0,
      failed: 0,
      noOp: true,
      error: err,
    };
  }
}
