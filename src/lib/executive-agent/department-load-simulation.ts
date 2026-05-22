import { buildDepartmentWorkloadBalance } from "@/lib/fulfillment/department-workload-balance";
import type {
  DepartmentLoadSimulationResult,
  ExecutiveSimulationEngineInput,
  SimulationScenarioAssumptions,
} from "@/lib/executive-agent/executive-simulation-types";
export function simulateDepartmentLoadRedistribution(
  input: ExecutiveSimulationEngineInput,
  assumptions?: SimulationScenarioAssumptions
): DepartmentLoadSimulationResult {
  const current = buildDepartmentWorkloadBalance(input.kpi.snapshots);
  const shift = assumptions?.departmentLoadShiftPercent ?? {};

  const departments = current.map((d) => {
    const pct = shift[d.department] ?? 0;
    const simulated = Math.max(0, Math.min(100, Math.round(d.loadIndex * (1 + pct / 100))));
    return {
      department: d.department,
      currentLoadIndex: d.loadIndex,
      simulatedLoadIndex: simulated,
      delta: simulated - d.loadIndex,
    };
  });

  const loads = departments.map((d) => d.simulatedLoadIndex);
  const max = Math.max(...loads, 0);
  const min = Math.min(...loads, 0);
  const imbalanceScore = max - min;

  return {
    departments,
    imbalanceScore,
    confidence: current.some((d) => d.activeOrders > 0) ? "medium" : "low",
    evidence: [
      { source: "snapshots", detail: "Department load from active fulfillment snapshots" },
      ...(Object.keys(shift).length
        ? [{ source: "assumption" as const, detail: "Scenario load shift applied" }]
        : []),
    ],
    advisoryOnly: true,
  };
}
