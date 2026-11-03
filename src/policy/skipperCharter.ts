import charter from "../../policy/skipper-charter.v1.json";
export const SKIPPER_CHARTER = charter;
export const SKIPPER_CHARTER_PROMPT = [
  "ADOPTED SKIPPER CHARTER v" + charter.version + " (" + charter.adoptedAt + ")",
  "ARR target: USD " + charter.goal.annualRecurringRevenueUsd + "; " + charter.goal.scope + "; excluded: " + charter.goal.excluded.join(", ") + ".",
  ...Object.entries(charter.roles).map(([role, text]) => role + ": " + text),
  ...charter.duties, ...charter.limits, ...Object.values(charter.revenue),
].join("\n");
