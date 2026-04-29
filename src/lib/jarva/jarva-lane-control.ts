import type { JarvaWorkflowPath } from "@/lib/jarva/jarva-workflow-path";

/** Consultant / UI: deterministic lane switches without JSON body fields. */
export const JARVA_SET_LANE_PREFIX = "__jarva_set_lane__:" as const;
export const JARVA_CLEAR_LANE_MESSAGE = "__jarva_clear_lane__" as const;

const PATH_SET = new Set<JarvaWorkflowPath>([
  "trust_revocable",
  "trust_irrevocable",
  "trust_ecclesiastical",
  "trust_certificate",
  "trust_ppm",
  "trust_bond",
  "trust_estate",
]);

/** Short tokens after `__jarva_set_lane__:` (also accepts full `trust_*` ids). */
const SHORT_TO_PATH: Record<string, JarvaWorkflowPath> = {
  revocable: "trust_revocable",
  irrevocable: "trust_irrevocable",
  ecclesiastical: "trust_ecclesiastical",
  certificate: "trust_certificate",
  ppm: "trust_ppm",
  bond: "trust_bond",
  estate: "trust_estate",
};

export type JarvaLaneControlOp =
  | { action: "set"; path: JarvaWorkflowPath }
  | { action: "clear" };

function normalizeLaneToken(raw: string): JarvaWorkflowPath | null {
  const t = raw.trim();
  if (!t) return null;
  if (PATH_SET.has(t as JarvaWorkflowPath)) return t as JarvaWorkflowPath;
  const fromShort = SHORT_TO_PATH[t.toLowerCase()];
  return fromShort ?? null;
}

/**
 * Parse structured lane control from the user message (trust-advisor only at call site).
 * Returns null if the message is not a control token.
 */
export function parseJarvaLaneControlMessage(message: string): JarvaLaneControlOp | null {
  const m = message.trim();
  if (m === JARVA_CLEAR_LANE_MESSAGE) return { action: "clear" };
  if (!m.startsWith(JARVA_SET_LANE_PREFIX)) return null;
  const rest = m.slice(JARVA_SET_LANE_PREFIX.length);
  const path = normalizeLaneToken(rest);
  if (!path) return null;
  return { action: "set", path };
}

/** UI: replace magic strings with readable chat lines. */
export function displayLabelForLaneMessage(message: string): string | null {
  const op = parseJarvaLaneControlMessage(message);
  if (!op) return null;
  if (op.action === "clear") return "[Clear workflow lane]";
  return `[Workflow lane: ${op.path}]`;
}
