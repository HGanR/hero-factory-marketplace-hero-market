import type { JarvaDocumentAssemblyHints } from "@/lib/jarva/jarva-document-assembly-hints";
import {
  jarvaHandoffIssueSecurityExecutionKind,
  jarvaHandoffTrustRecordsTabForLane,
} from "@/lib/jarva/jarva-handoff";
import { isJarvaWorkflowPath, type JarvaWorkflowPath } from "@/lib/jarva/jarva-workflow-path";

/**
 * Portable "next UI action" hints for Jarva — advisory only unless `autoApplyEligible` and
 * destination code explicitly applies (e.g. Trust Records tab when `tab` was absent).
 * Targets are stable string ids interpreted per surface; they do not replace workflow state.
 */

export type JarvaNextUiAction =
  | {
      kind: "select_tab";
      target: string;
      label: string;
      autoApplyEligible: boolean;
    }
  | {
      kind: "focus_step";
      target: string;
      label: string;
      autoApplyEligible: boolean;
    }
  | {
      kind: "highlight_action";
      target: string;
      label: string;
      autoApplyEligible: boolean;
    }
  | {
      kind: "prefill_mode";
      target: string;
      value: string;
      label: string;
      autoApplyEligible: boolean;
    };

export type JarvaNextUiActionBundle = {
  lane: string | null;
  proceduralStep: string | null;
  actions: JarvaNextUiAction[];
  advisoryLine?: string;
};

export type JarvaDestinationSurface =
  | "trust_records"
  | "trust_records_jarva"
  | "issue_security"
  | "estate_will"
  | "ecclesiastical"
  | "smart_trust"
  | "unknown";

/** Map URL path to a coarse destination surface (client-side). */
export function detectJarvaDestinationSurface(pathname: string): JarvaDestinationSurface {
  const p = pathname || "";
  if (p.includes("/issue-security")) return "issue_security";
  if (p.includes("/trust-records/jarva")) return "trust_records_jarva";
  if (p.includes("/trust-records/estate/will")) return "estate_will";
  if (p.startsWith("/ecclesiastical")) return "ecclesiastical";
  if (p.startsWith("/trust-records")) return "trust_records";
  if (p.startsWith("/smart-trust")) return "smart_trust";
  return "unknown";
}

function advisoryFromHints(h: JarvaDocumentAssemblyHints | null | undefined): string | undefined {
  if (!h?.lines?.length) return undefined;
  return h.lines[0]?.trim();
}

/**
 * Lane → concrete UI suggestions (server-safe; no pathname required).
 * Auto-apply is only *eligible* when destination logic agrees (e.g. empty tab on Trust Records).
 */
export function jarvaNextUiActionsForLane(lane: JarvaWorkflowPath): JarvaNextUiAction[] {
  const tab = jarvaHandoffTrustRecordsTabForLane(lane);
  const actions: JarvaNextUiAction[] = [];

  if (tab) {
    actions.push({
      kind: "select_tab",
      target: tab,
      label: `Open Trust Records → ${tab} tab`,
      autoApplyEligible: true,
    });
  }

  switch (lane) {
    case "trust_bond":
      actions.push({
        kind: "highlight_action",
        target: "bond_registry",
        label: "Continue bond registry alignment (PPM / Issue references)",
        autoApplyEligible: true,
      });
      break;
    case "trust_ppm":
      actions.push({
        kind: "focus_step",
        target: "D",
        label: "Continue at Step D — offering package (PPM / subscription materials)",
        autoApplyEligible: false,
      });
      actions.push({
        kind: "highlight_action",
        target: "issue_security_main",
        label: "Work the Issue Security wizard for this offering",
        autoApplyEligible: true,
      });
      break;
    case "trust_certificate":
      actions.push({
        kind: "focus_step",
        target: "E",
        label: "Continue at Step E — custody & issuance method",
        autoApplyEligible: false,
      });
      actions.push({
        kind: "focus_step",
        target: "F",
        label: "Or Step F — finalize before certificate execution",
        autoApplyEligible: false,
      });
      break;
    case "trust_estate":
      actions.push({
        kind: "highlight_action",
        target: "will_wizard_main",
        label: "Continue the pour-over will draft (estate workspace)",
        autoApplyEligible: true,
      });
      break;
    case "trust_revocable":
      actions.push({
        kind: "prefill_mode",
        target: "trust_drafting_lane",
        value: "revocable",
        label: "Continue revocable trust drafting (Build with Jarva / Smart Trust)",
        autoApplyEligible: false,
      });
      break;
    case "trust_irrevocable":
      actions.push({
        kind: "prefill_mode",
        target: "trust_drafting_lane",
        value: "irrevocable",
        label: "Continue irrevocable trust drafting (Build with Jarva / Smart Trust)",
        autoApplyEligible: false,
      });
      break;
    case "trust_ecclesiastical":
      actions.push({
        kind: "highlight_action",
        target: "ecclesiastical_binding",
        label: "Bind client & trust on the Ecclesiastical home surface",
        autoApplyEligible: true,
      });
      break;
    default:
      break;
  }

  const exec = jarvaHandoffIssueSecurityExecutionKind(lane);
  if (exec === "bond") {
    actions.push({
      kind: "focus_step",
      target: "A",
      label: "Define the security (Step A) for bond execution",
      autoApplyEligible: false,
    });
  }

  return actions;
}

/** Remove actions that do not apply on this surface (avoids bond registry copy on Issue Security, etc.). */
export function filterJarvaNextUiActionsForSurface(
  actions: JarvaNextUiAction[],
  surface: JarvaDestinationSurface
): JarvaNextUiAction[] {
  if (surface === "unknown") return actions;

  const keep = (a: JarvaNextUiAction): boolean => {
    if (surface === "trust_records") {
      if (a.kind === "focus_step") return false;
      if (a.target === "issue_security_main") return false;
      if (a.target === "will_wizard_main") return false;
      if (a.target === "ecclesiastical_binding") return false;
      if (a.kind === "prefill_mode" && a.target === "trust_drafting_lane") return false;
      return true;
    }
    if (surface === "trust_records_jarva") {
      if (a.kind === "select_tab") return false;
      if (a.target === "bond_registry") return false;
      if (a.target === "issue_security_main") return false;
      if (a.target === "will_wizard_main") return false;
      if (a.target === "ecclesiastical_binding") return false;
      if (a.kind === "focus_step") return false;
      if (a.kind === "prefill_mode" && a.target === "trust_drafting_lane") return true;
      if (a.kind === "highlight_action" && a.target === "jarva_intake_main") return true;
      return false;
    }
    if (surface === "issue_security") {
      if (a.kind === "select_tab") return false;
      if (a.target === "bond_registry") return false;
      if (a.target === "will_wizard_main") return false;
      if (a.target === "ecclesiastical_binding") return false;
      if (a.kind === "prefill_mode") return false;
      return a.kind === "focus_step" || a.target === "issue_security_main";
    }
    if (surface === "estate_will") {
      if (a.kind !== "highlight_action" || a.target !== "will_wizard_main") return false;
      return true;
    }
    if (surface === "ecclesiastical") {
      if (a.target !== "ecclesiastical_binding") return false;
      return true;
    }
    if (surface === "smart_trust") {
      if (a.kind === "select_tab") return false;
      if (a.target === "bond_registry") return false;
      if (a.target === "issue_security_main") return false;
      if (a.target === "will_wizard_main") return false;
      if (a.target === "ecclesiastical_binding") return false;
      if (a.kind === "focus_step") return false;
      if (a.kind === "prefill_mode" && a.target === "trust_drafting_lane") return true;
      return false;
    }
    return true;
  };

  return actions.filter(keep);
}

/** Add intake highlight for Jarva route when lane is revocable/irrevocable. */
function augmentActionsForJarvaIntakeRoute(
  lane: JarvaWorkflowPath | null,
  actions: JarvaNextUiAction[]
): JarvaNextUiAction[] {
  if (!lane || (lane !== "trust_revocable" && lane !== "trust_irrevocable")) return actions;
  return [
    ...actions,
    {
      kind: "highlight_action",
      target: "jarva_intake_main",
      label: "Complete labeled intake fields; apply merges when ready (DRAFT)",
      autoApplyEligible: true,
    },
  ];
}

/**
 * Client: pathname + handoff lane → filtered bundle for the current surface.
 */
export function buildJarvaNextUiSurfaceBundle(params: {
  pathname: string;
  searchParams: URLSearchParams;
  lane: JarvaWorkflowPath;
  proceduralStep?: string | null;
}): JarvaNextUiActionBundle {
  const surface = detectJarvaDestinationSurface(params.pathname);
  let actions = jarvaNextUiActionsForLane(params.lane);
  if (surface === "trust_records_jarva") {
    actions = augmentActionsForJarvaIntakeRoute(params.lane, actions);
  }
  actions = filterJarvaNextUiActionsForSurface(actions, surface);
  return {
    lane: params.lane,
    proceduralStep: params.proceduralStep ?? null,
    actions,
    advisoryLine: undefined,
  };
}

/**
 * Server / chat: bundle from lane + procedural step + optional assembly hints.
 */
export function buildJarvaNextUiActionBundleFromJarvaState(input: {
  lane: JarvaWorkflowPath | null;
  proceduralStep: string | null;
  proceduralTitle?: string | null;
  documentAssemblyHints?: JarvaDocumentAssemblyHints | null;
}): JarvaNextUiActionBundle {
  const actions = input.lane ? jarvaNextUiActionsForLane(input.lane) : [];
  const hintLine = advisoryFromHints(input.documentAssemblyHints);
  const title = (input.proceduralTitle || "").trim();
  const advisoryLine =
    hintLine ||
    (title ? `Current focus: ${title} (DRAFT — counsel review).` : undefined) ||
    undefined;

  return {
    lane: input.lane,
    proceduralStep: input.proceduralStep,
    actions,
    advisoryLine,
  };
}

/**
 * Whether Trust Records should auto-merge tab from handoff (tab absent only).
 * Mirrors `jarvaHandoffSuggestedTrustRecordsTabIfAbsent` eligibility.
 */
export function canAutoApplyTrustRecordsTab(searchParams: URLSearchParams): boolean {
  const tab = (searchParams.get("tab") || "").trim();
  return !tab;
}

/** Prefer focus → tab → prefill → first (matches page strip). */
export function pickPrimaryJarvaNextUiAction(actions: JarvaNextUiAction[]): JarvaNextUiAction | null {
  if (!actions.length) return null;
  return (
    actions.find((a) => a.kind === "focus_step") ??
    actions.find((a) => a.kind === "select_tab") ??
    actions.find((a) => a.kind === "prefill_mode") ??
    actions[0] ??
    null
  );
}

/**
 * Same resolution as `JarvaNextActionStrip` / chat: lane + current URL → surface-filtered actions.
 * Ignores server `bundle.actions` ordering; re-derives from lane for one source of truth.
 */
export function getResolvedJarvaNextUiActionsForContext(
  pathname: string,
  searchParams: URLSearchParams,
  lane: JarvaWorkflowPath | null
): JarvaNextUiAction[] {
  if (!lane) return [];
  return buildJarvaNextUiSurfaceBundle({ pathname, searchParams, lane }).actions;
}

function isValidActionShape(raw: unknown): raw is JarvaNextUiAction {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  const k = o.kind;
  if (k === "select_tab" || k === "focus_step" || k === "highlight_action") {
    return typeof o.target === "string" && typeof o.label === "string" && typeof o.autoApplyEligible === "boolean";
  }
  if (k === "prefill_mode") {
    return (
      typeof o.target === "string" &&
      typeof o.value === "string" &&
      typeof o.label === "string" &&
      typeof o.autoApplyEligible === "boolean"
    );
  }
  return false;
}

/** Parse `/api/npc/chat` `jarvaNextUiActionBundle` field. */
export function parseJarvaNextUiActionBundleFromApi(raw: unknown): JarvaNextUiActionBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const laneRaw = o.lane;
  const lane: JarvaWorkflowPath | null =
    laneRaw === null || laneRaw === undefined
      ? null
      : isJarvaWorkflowPath(String(laneRaw))
        ? (String(laneRaw) as JarvaWorkflowPath)
        : null;
  const proceduralStep =
    o.proceduralStep === null || o.proceduralStep === undefined
      ? null
      : typeof o.proceduralStep === "string"
        ? o.proceduralStep
        : null;
  const advisoryLine = typeof o.advisoryLine === "string" ? o.advisoryLine : undefined;
  const actions = Array.isArray(o.actions) ? o.actions.filter(isValidActionShape) : [];
  return {
    lane,
    proceduralStep,
    actions,
    advisoryLine,
  };
}
