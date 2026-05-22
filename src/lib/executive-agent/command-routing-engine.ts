import type {
  CommandRoutingResult,
  ExecutiveCommandEngineInput,
} from "@/lib/executive-agent/executive-command-types";
import { buildIncidentIntelligence } from "@/lib/executive-agent/incident-intelligence";

const DEPT_OPERATOR: Record<string, string> = {
  WEBSITE: "website_desk_lead",
  TRUST: "trust_desk_lead",
  REVENUE_OS: "revenue_os_desk_lead",
  SMART_TRUST: "smart_trust_desk_lead",
};

export function routeCrossDepartmentCommand(
  input: ExecutiveCommandEngineInput
): CommandRoutingResult {
  const incidents = buildIncidentIntelligence(input);
  const routes: CommandRoutingResult["routes"] = [];

  for (const inc of incidents.incidents.slice(0, 6)) {
    if (inc.department) {
      routes.push({
        department: inc.department,
        operatorId: DEPT_OPERATOR[inc.department] ?? "department_lead",
        reason: `${inc.title} — route for human review (no auto-routing)`,
      });
    } else if (inc.category === "cross_department_crisis") {
      routes.push({
        department: null,
        operatorId: "executive_owner",
        reason: "Cross-department crisis — executive owner command tier",
      });
    }
  }

  const overloaded = input.operatorWorkload.filter((w) => w.balanceLabel === "overloaded");
  for (const w of overloaded.slice(0, 2)) {
    routes.push({
      department: w.department,
      operatorId: w.operatorId,
      reason: `Operator overload advisory for ${w.label}`,
    });
  }

  if (routes.length === 0) {
    routes.push({
      department: null,
      operatorId: "fulfillment_coordinator",
      reason: "Default command watch — no urgent routing",
    });
  }

  return {
    routes: routes.slice(0, 10),
    evidence: [{ source: "inference", detail: `${routes.length} command route(s) suggested` }],
    advisoryOnly: true,
  };
}
