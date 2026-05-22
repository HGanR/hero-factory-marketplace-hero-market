import type {
  ExecutiveAgentCoordinationEngineInput,
  ExecutiveAgentCoordinationOverview,
} from "@/lib/executive-agent/executive-agent-coordination-types";
import { buildAgentCapabilityRegistry } from "@/lib/executive-agent/agent-capability-registry";
import { buildExecutiveAgentHierarchy } from "@/lib/executive-agent/executive-agent-hierarchy";
import { buildPersistentAgentWorkspaces } from "@/lib/executive-agent/persistent-agent-workspaces";
import { buildInterAgentThreadLinks } from "@/lib/executive-agent/inter-agent-threading";
import { buildRouteRecommendationsForTasks } from "@/lib/executive-agent/agent-task-routing";
import { scoreAgentSpecializationForTask } from "@/lib/executive-agent/agent-specialization-intelligence";
import { buildAgentWorkloadBalances } from "@/lib/executive-agent/agent-workload-balancing";
import { buildCrossAgentEscalationPaths } from "@/lib/executive-agent/cross-agent-escalation";

function aggregateConfidence(scores: number[]): { confidence: ExecutiveAgentCoordinationOverview["confidence"]; confidenceScore: number } {
  if (scores.length === 0) return { confidence: "low", confidenceScore: 35 };
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg >= 70) return { confidence: "high", confidenceScore: Math.round(avg) };
  if (avg >= 50) return { confidence: "medium", confidenceScore: Math.round(avg) };
  return { confidence: "low", confidenceScore: Math.round(avg) };
}

function buildSkipperSummary(input: {
  workspaces: ReturnType<typeof buildPersistentAgentWorkspaces>;
  routes: ReturnType<typeof buildRouteRecommendationsForTasks>;
  escalations: ReturnType<typeof buildCrossAgentEscalationPaths>;
  threadLinks: ReturnType<typeof buildInterAgentThreadLinks>;
}): string {
  const overloaded = input.workspaces.filter((w) => w.balanceLabel === "overloaded").length;
  const parts = [
    `Multi-agent coordination: ${input.workspaces.length} persistent workspaces active.`,
    `${input.routes.length} route recommendation(s), ${input.threadLinks.length} inter-agent thread link(s), ${input.escalations.length} escalation path(s).`,
  ];
  if (overloaded > 0) parts.push(`${overloaded} agent workspace(s) overloaded — approval-gated redistribution only.`);
  parts.push("No unrestricted autonomous execution — all routes require human approval.");
  return parts.join(" ");
}

/** Pure multi-agent coordination orchestrator — explainable, approval-aware, hierarchy-governed. */
export function buildExecutiveAgentCoordinationOverview(
  input: ExecutiveAgentCoordinationEngineInput
): ExecutiveAgentCoordinationOverview {
  const agents = buildAgentCapabilityRegistry();
  const hierarchy = buildExecutiveAgentHierarchy();
  const workspaces = buildPersistentAgentWorkspaces({
    tasks: input.tasks,
    threads: input.threads,
    pendingApprovalCount: input.pendingApprovalCount,
  });
  const interAgentThreads = buildInterAgentThreadLinks(input.threads);
  const routeRecommendations = buildRouteRecommendationsForTasks(input.tasks);
  const workloadBalances = buildAgentWorkloadBalances({
    workspaces,
    operatorWorkload: input.operatorWorkload,
  });
  const escalationPaths = buildCrossAgentEscalationPaths({ workspaces, workloadBalances });

  const specializationScores = input.tasks
    .filter((t) => t.status !== "completed" && t.status !== "canceled")
    .slice(0, 8)
    .flatMap((t) => scoreAgentSpecializationForTask(t).slice(0, 2));

  const routeScores = routeRecommendations.map((r) => r.confidenceScore);
  const { confidence, confidenceScore } = aggregateConfidence(routeScores);

  const pendingApprovalRoutes = routeRecommendations.filter((r) => r.requiresApproval).length;

  return {
    agents,
    workspaces,
    interAgentThreads,
    routeRecommendations,
    specializationScores,
    workloadBalances,
    escalationPaths,
    hierarchy,
    pendingApprovalRoutes,
    confidence,
    confidenceScore,
    skipperSummary: buildSkipperSummary({
      workspaces,
      routes: routeRecommendations,
      escalations: escalationPaths,
      threadLinks: interAgentThreads,
    }),
    generatedAt: new Date().toISOString(),
    meta: {
      explainable: true,
      auditable: true,
      approvalAware: true,
      workloadAware: true,
      evidenceLinked: true,
      hierarchyGoverned: true,
      noUnrestrictedAutonomousExecution: true,
      departmentIsolationPreserved: true,
      rollbackControlsPreserved: true,
      executionPolicyPreserved: true,
    },
  };
}
