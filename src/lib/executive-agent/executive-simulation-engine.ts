import { buildExecutiveKpiOverviewFromEngine, buildFulfillmentVelocitySnapshot } from "@/lib/fulfillment/executive-kpi-engine";
import { simulateApprovalDelayImpact } from "@/lib/executive-agent/approval-delay-impact";
import { simulateBottleneckCascade } from "@/lib/executive-agent/bottleneck-cascade-simulation";
import { modelCampaignLaunchProbability } from "@/lib/executive-agent/campaign-launch-probability";
import { simulateDepartmentLoadRedistribution } from "@/lib/executive-agent/department-load-simulation";
import { simulateEscalationImpact } from "@/lib/executive-agent/escalation-impact-simulation";
import type {
  ExecutiveSimulationEngineInput,
  ExecutiveSimulationRunResult,
  ForecastConfidenceCalibration,
  SimulationScenarioAssumptions,
  SimulationScenarioDefinition,
  SimulationScenarioId,
} from "@/lib/executive-agent/executive-simulation-types";
import { simulateFulfillmentTimeline } from "@/lib/executive-agent/fulfillment-timeline-simulation";
import { modelGovernanceStagnation } from "@/lib/executive-agent/governance-stagnation-model";
import { simulateOperatorRedistribution } from "@/lib/executive-agent/operator-redistribution-simulation";
import { compareSimulationScenarios } from "@/lib/executive-agent/scenario-comparison-engine";

export const SIMULATION_SCENARIOS: SimulationScenarioDefinition[] = [
  {
    id: "baseline",
    label: "Baseline desk",
    description: "Current snapshot and memory — no hypothetical stress.",
    defaultAssumptions: { horizonDays: 14 },
  },
  {
    id: "approval_delay_stress",
    label: "Approval delay +48h",
    description: "Simulates additional owner approval latency across pending gates.",
    defaultAssumptions: { additionalApprovalDelayHours: 48, horizonDays: 14 },
  },
  {
    id: "operator_redistribution",
    label: "Operator redistribution",
    description: "Advisory simulation of load shift between overloaded and underloaded roles.",
    defaultAssumptions: { simulateOperatorRedistribution: true, horizonDays: 14 },
  },
  {
    id: "escalation_pressure",
    label: "Escalation pressure",
    description: "Models additional escalation chain climbs without executing escalations.",
    defaultAssumptions: { escalationLevelDelta: 1, horizonDays: 14 },
  },
  {
    id: "department_rebalance",
    label: "Department rebalance",
    description: "Hypothetical -15% load on overloaded departments.",
    defaultAssumptions: {
      departmentLoadShiftPercent: {
        WEBSITE: -15,
        TRUST: -15,
        REVENUE_OS: -10,
        SMART_TRUST: -10,
      },
    },
  },
  {
    id: "launch_readiness_watch",
    label: "Launch readiness watch",
    description: "REVENUE_OS launch probability under current desk conditions.",
    defaultAssumptions: { horizonDays: 21 },
  },
  {
    id: "governance_stagnation_watch",
    label: "Governance stagnation watch",
    description: "SMART_TRUST governance stagnation probability model.",
    defaultAssumptions: { horizonDays: 21 },
  },
];

export function resolveScenarioDefinition(
  id: SimulationScenarioId
): SimulationScenarioDefinition {
  return SIMULATION_SCENARIOS.find((s) => s.id === id) ?? SIMULATION_SCENARIOS[0]!;
}

export function mergeScenarioAssumptions(
  def: SimulationScenarioDefinition,
  overrides?: SimulationScenarioAssumptions
): SimulationScenarioAssumptions {
  return { ...def.defaultAssumptions, ...overrides };
}

export function calibrateForecastConfidence(
  input: ExecutiveSimulationEngineInput
): ForecastConfidenceCalibration {
  const orders = input.kpi.snapshots.length;
  const memorySamples = input.kpi.outcomes.length + input.kpi.approvalLatency.length;
  let score = 0.45;
  const notes: string[] = [];

  if (orders >= 10) {
    score += 0.2;
    notes.push("Strong order sample for simulation");
  } else if (orders >= 4) {
    score += 0.1;
    notes.push("Moderate order sample");
  } else {
    notes.push("Limited order sample — widen confidence bands");
  }

  if (memorySamples >= 8) {
    score += 0.2;
    notes.push("Operational memory reinforces forecasts");
  } else if (memorySamples >= 3) {
    score += 0.08;
  }

  if (input.operatorWorkload.some((w) => w.activeOrders > 0)) {
    score += 0.1;
    notes.push("Operator workload context included");
  }

  score = Math.min(0.92, Math.max(0.25, score));
  const overallConfidence: ForecastConfidenceCalibration["overallConfidence"] =
    score >= 0.7 ? "high" : score >= 0.5 ? "medium" : "low";

  return {
    overallConfidence,
    overallScore: Math.round(score * 100) / 100,
    sampleOrders: orders,
    memorySamples,
    calibrationNotes: notes,
    evidence: [
      { source: "snapshots", detail: `${orders} fulfillment snapshot(s)` },
      { source: "memory", detail: `${memorySamples} memory/latency sample(s)` },
    ],
  };
}

export function runExecutiveSimulation(
  input: ExecutiveSimulationEngineInput,
  scenarioId: SimulationScenarioId,
  assumptionOverrides?: SimulationScenarioAssumptions,
  baselineResult?: ExecutiveSimulationRunResult
): ExecutiveSimulationRunResult {
  const def = resolveScenarioDefinition(scenarioId);
  const assumptions = mergeScenarioAssumptions(def, assumptionOverrides);
  const approvalHours = assumptions.additionalApprovalDelayHours ?? 0;
  const horizon = assumptions.horizonDays ?? 14;

  const timeline = simulateFulfillmentTimeline(input, {
    horizonDays: horizon,
    approvalDelayHours: approvalHours,
  });

  const operatorRedistribution = assumptions.simulateOperatorRedistribution
    ? simulateOperatorRedistribution(input)
    : scenarioId === "operator_redistribution"
      ? simulateOperatorRedistribution(input)
      : [];

  const approvalDelayImpact = simulateApprovalDelayImpact(input, approvalHours);

  const campaignLaunchProbability = modelCampaignLaunchProbability(input);
  const governanceStagnation = modelGovernanceStagnation(input);
  const bottleneckCascade = simulateBottleneckCascade(input);
  const departmentLoad = simulateDepartmentLoadRedistribution(input, assumptions);
  const escalationImpact = simulateEscalationImpact(
    input,
    assumptions.escalationLevelDelta ?? (scenarioId === "escalation_pressure" ? 1 : 0)
  );

  const confidenceCalibration = calibrateForecastConfidence(input);

  const overview = buildExecutiveKpiOverviewFromEngine(input.kpi);
  const velocity = buildFulfillmentVelocitySnapshot(input.kpi.snapshots);

  const skipperSummary = [
    `Simulation "${def.label}" — advisory only; no production mutation.`,
    `Timeline: median ${timeline.medianCompletionDays}d, P90 ${timeline.p90CompletionDays}d (${timeline.confidence} confidence).`,
    approvalDelayImpact.pendingApprovals > 0
      ? `Approval delay impact: +${approvalHours}h stress → ~${approvalDelayImpact.projectedDeskDelayDays}d desk delay.`
      : null,
    `Launch success probability ${Math.round(campaignLaunchProbability.launchSuccessProbability * 100)}% (REVENUE_OS).`,
    governanceStagnation.smartTrustOrders > 0
      ? `SMART_TRUST stagnation probability ${Math.round(governanceStagnation.stagnationProbability * 100)}%.`
      : null,
    `Bottleneck cascade depth ${bottleneckCascade.projectedCascadeDepth}; revision cascade risk ${Math.round(bottleneckCascade.revisionCascadeRisk * 100)}%.`,
    `Velocity ${velocity.velocityScore}/100; health ${overview.operationalHealth.score}/100.`,
    "No autonomous execution, reassignment, approvals, or launch/publish/spend.",
  ]
    .filter(Boolean)
    .join(" ");

  const result: ExecutiveSimulationRunResult = {
    scenarioId,
    scenarioLabel: def.label,
    assumptions,
    timeline,
    operatorRedistribution,
    approvalDelayImpact,
    campaignLaunchProbability,
    governanceStagnation,
    bottleneckCascade,
    departmentLoad,
    escalationImpact,
    confidenceCalibration,
    scenarioComparison: [],
    skipperSummary,
  };

  if (baselineResult && scenarioId !== "baseline") {
    result.scenarioComparison = compareSimulationScenarios(baselineResult, result);
  }

  return result;
}
