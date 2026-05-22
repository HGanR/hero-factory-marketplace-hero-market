import type {
  ExecutiveSimulationRunResult,
  ScenarioComparisonRow,
} from "@/lib/executive-agent/executive-simulation-types";

export function compareSimulationScenarios(
  baseline: ExecutiveSimulationRunResult,
  scenario: ExecutiveSimulationRunResult
): ScenarioComparisonRow[] {
  const rows: ScenarioComparisonRow[] = [];

  const add = (
    metric: string,
    b: string | number,
    s: string | number,
    betterWhenLower: boolean
  ) => {
    const bNum = typeof b === "number" ? b : parseFloat(String(b));
    const sNum = typeof s === "number" ? s : parseFloat(String(s));
    let better: boolean | null = null;
    let delta = "n/a";
    if (Number.isFinite(bNum) && Number.isFinite(sNum)) {
      const d = sNum - bNum;
      delta = d > 0 ? `+${d}` : String(d);
      better = betterWhenLower ? d < 0 : d > 0;
    }
    rows.push({ metric, baseline: b, scenario: s, delta, better });
  };

  add("Median completion (days)", baseline.timeline.medianCompletionDays, scenario.timeline.medianCompletionDays, true);
  add("P90 completion (days)", baseline.timeline.p90CompletionDays, scenario.timeline.p90CompletionDays, true);
  add("Stalled projected", baseline.timeline.stalledProjected, scenario.timeline.stalledProjected, true);
  add(
    "Approval delay impact (days)",
    baseline.approvalDelayImpact.projectedDeskDelayDays,
    scenario.approvalDelayImpact.projectedDeskDelayDays,
    true
  );
  add(
    "Launch success probability",
    Math.round(baseline.campaignLaunchProbability.launchSuccessProbability * 100),
    Math.round(scenario.campaignLaunchProbability.launchSuccessProbability * 100),
    false
  );
  add(
    "Governance stagnation %",
    Math.round(baseline.governanceStagnation.stagnationProbability * 100),
    Math.round(scenario.governanceStagnation.stagnationProbability * 100),
    true
  );
  add(
    "Bottleneck cascade depth",
    baseline.bottleneckCascade.projectedCascadeDepth,
    scenario.bottleneckCascade.projectedCascadeDepth,
    true
  );
  add(
    "Dept imbalance score",
    baseline.departmentLoad.imbalanceScore,
    scenario.departmentLoad.imbalanceScore,
    true
  );
  add(
    "Escalation projections",
    baseline.escalationImpact.escalationsProjected,
    scenario.escalationImpact.escalationsProjected,
    true
  );
  add(
    "Confidence score",
    Math.round(baseline.confidenceCalibration.overallScore * 100),
    Math.round(scenario.confidenceCalibration.overallScore * 100),
    false
  );

  return rows;
}
