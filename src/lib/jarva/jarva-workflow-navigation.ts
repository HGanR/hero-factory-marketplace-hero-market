import { stripJarvaHandoffFromSearchParams } from "@/lib/jarva/jarva-handoff";
import type { JarvaWorkflowPath } from "@/lib/jarva/jarva-workflow-path";

/** Set via FloatingNPCChat only for explicit UI actions (lane dropdown, trust-type chips, specialty chat). */
export type JarvaNavIntent = "lane_control" | "trust_type" | "specialty_chat";

const TRUST_TYPE_PATHS = new Set<JarvaWorkflowPath>([
  "trust_revocable",
  "trust_irrevocable",
  "trust_ecclesiastical",
]);

const SPECIALTY_PATHS = new Set<JarvaWorkflowPath>([
  "trust_certificate",
  "trust_ppm",
  "trust_bond",
  "trust_estate",
]);

function isJarvaWorkflowPath(v: string | null | undefined): v is JarvaWorkflowPath {
  return typeof v === "string" && v.startsWith("trust_");
}

/**
 * Whether we should run lane → destination resolution after this chat response.
 * Passive turns (sticky_session, transcript_fallback) never qualify.
 */
export function shouldApplyWorkflowNavigation(
  navIntent: JarvaNavIntent | undefined,
  workflowPathSource: string | null | undefined,
  workflowPath: string | null | undefined
): boolean {
  if (!navIntent || !workflowPath || !isJarvaWorkflowPath(workflowPath)) return false;
  if (workflowPathSource === "lane_clear") return false;

  if (navIntent === "lane_control") {
    return workflowPathSource === "lane_control";
  }
  if (workflowPathSource !== "explicit_turn") return false;

  if (navIntent === "trust_type") {
    return TRUST_TYPE_PATHS.has(workflowPath);
  }
  if (navIntent === "specialty_chat") {
    return SPECIALTY_PATHS.has(workflowPath);
  }
  return false;
}

/** Compare same path + query (order-independent). Ignores Jarva handoff query keys so “same page” works with/without handoff. */
export function sameAppDestination(aHref: string, bHref: string, origin: string): boolean {
  try {
    const ua = new URL(aHref, origin);
    const ub = new URL(bHref, origin);
    if (ua.pathname !== ub.pathname) return false;
    const pa = stripJarvaHandoffFromSearchParams(ua.searchParams);
    const pb = stripJarvaHandoffFromSearchParams(ub.searchParams);
    const sa = [...pa.entries()].sort(([x], [y]) => x.localeCompare(y));
    const sb = [...pb.entries()].sort(([x], [y]) => x.localeCompare(y));
    return JSON.stringify(sa) === JSON.stringify(sb);
  } catch {
    return false;
  }
}
