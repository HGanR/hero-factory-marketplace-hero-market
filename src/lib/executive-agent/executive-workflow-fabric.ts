import type {
  LifecycleSupervisionRecord,
  WorkflowContinuitySignal,
} from "@/lib/executive-agent/executive-workflow-types";
import { buildAllApprovalChains } from "@/lib/executive-agent/approval-chain-orchestration";
import { buildCrossDepartmentWorkflowChains } from "@/lib/executive-agent/cross-department-workflow-chaining";
import { orchestrateMultiStageLifecycle } from "@/lib/executive-agent/lifecycle-orchestration-engine";
import {
  buildPersistentWorkflowStates,
} from "@/lib/executive-agent/persistent-workflow-state";
import { buildAllWorkflowRecoveryOptions } from "@/lib/executive-agent/workflow-recovery-engine";
import { superviseAllLifecycles } from "@/lib/executive-agent/workflow-recovery-engine";
import { detectWorkflowBottlenecks } from "@/lib/executive-agent/workflow-bottleneck-intelligence";
import { aggregateContinuityAlertCount, monitorAllWorkflowContinuity } from "@/lib/executive-agent/workflow-continuity-monitor";
import { buildAllWorkflowDependencyGraphs } from "@/lib/executive-agent/workflow-dependency-graph";
import type {
  ExecutiveWorkflowFabricEngineInput,
  ExecutiveWorkflowFabricOverview,
} from "@/lib/executive-agent/executive-workflow-types";

function aggregateConfidence(workflows: ReturnType<typeof buildPersistentWorkflowStates>): {
  confidence: ExecutiveWorkflowFabricOverview["confidence"];
  confidenceScore: number;
} {
  if (workflows.length === 0) return { confidence: "low", confidenceScore: 35 };
  const avg =
    workflows.reduce((sum, w) => sum + w.continuityScore, 0) / Math.max(workflows.length, 1);
  if (avg >= 75) return { confidence: "high", confidenceScore: Math.round(avg) };
  if (avg >= 55) return { confidence: "medium", confidenceScore: Math.round(avg) };
  return { confidence: "low", confidenceScore: Math.round(avg) };
}

function buildSkipperSummary(input: {
  workflows: ReturnType<typeof buildPersistentWorkflowStates>;
  paused: number;
  blocked: number;
  continuityAlerts: number;
  crossLinks: number;
}): string {
  return [
    `Workflow fabric: ${input.workflows.length} persistent workflow(s), ${input.paused} paused, ${input.blocked} blocked.`,
    `${input.crossLinks} cross-department chain(s), ${input.continuityAlerts} continuity alert(s).`,
    "Approval-gated lifecycle — no autonomous deploy, publish, spend, or governance mutation.",
  ].join(" ");
}

/** Pure executive workflow fabric orchestrator. */
export function buildExecutiveWorkflowFabricOverview(
  input: ExecutiveWorkflowFabricEngineInput
): ExecutiveWorkflowFabricOverview {
  const workflows = buildPersistentWorkflowStates(input);
  const dependencyGraphs = buildAllWorkflowDependencyGraphs({
    workflows,
    tasks: input.tasks,
  });
  const crossDepartmentLinks = buildCrossDepartmentWorkflowChains(workflows);
  const approvalChains = buildAllApprovalChains({ workflows, approvals: input.approvals });
  const continuitySignals = monitorAllWorkflowContinuity({ workflows, dependencyGraphs });
  const bottlenecks = detectWorkflowBottlenecks(workflows);
  const recoveryOptions = buildAllWorkflowRecoveryOptions({ workflows, continuitySignals });
  const supervision = superviseAllLifecycles({ workflows, continuitySignals });

  orchestrateMultiStageLifecycle(workflows);

  const { confidence, confidenceScore } = aggregateConfidence(workflows);
  const pausedWorkflowCount = workflows.filter((w) => w.paused).length;
  const blockedWorkflowCount = workflows.filter((w) => w.currentStage === "blocked").length;

  return {
    workflows,
    dependencyGraphs,
    crossDepartmentLinks,
    approvalChains,
    recoveryOptions,
    continuitySignals,
    bottlenecks,
    supervision,
    activeWorkflowCount: workflows.filter((w) => !w.paused && w.currentStage !== "execution_complete").length,
    pausedWorkflowCount,
    blockedWorkflowCount,
    confidence,
    confidenceScore,
    skipperSummary: buildSkipperSummary({
      workflows,
      paused: pausedWorkflowCount,
      blocked: blockedWorkflowCount,
      continuityAlerts: aggregateContinuityAlertCount(continuitySignals),
      crossLinks: crossDepartmentLinks.length,
    }),
    generatedAt: new Date().toISOString(),
    meta: {
      explainable: true,
      auditable: true,
      approvalAware: true,
      dependencyAware: true,
      lifecycleAware: true,
      rollbackAware: true,
      noUnrestrictedAutonomousExecution: true,
      noAutonomousDeploy: true,
      noAutonomousPublish: true,
      noAutonomousSpend: true,
      noAutonomousGovernanceMutation: true,
      noWorkflowApprovalBypass: true,
      departmentIsolationPreserved: true,
    },
  };
}

export type { LifecycleSupervisionRecord, WorkflowContinuitySignal };
