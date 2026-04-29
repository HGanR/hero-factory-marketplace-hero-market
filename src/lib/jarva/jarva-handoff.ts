import type { JarvaWorkflowPath } from "@/lib/jarva/jarva-workflow-path";

/** Query flags when FloatingNPCChat navigates the consultant into a workflow surface. */
export const JARVA_HANDOFF_FROM = "jarvaFrom";
export const JARVA_HANDOFF_LANE = "jarvaLane";
/** Optional short slug for future use (e.g. pre-filled hints). */
export const JARVA_HANDOFF_HINT = "jarvaHint";

const PATH_SET = new Set<JarvaWorkflowPath>([
  "trust_revocable",
  "trust_irrevocable",
  "trust_ecclesiastical",
  "trust_certificate",
  "trust_ppm",
  "trust_bond",
  "trust_estate",
]);

export type ParsedJarvaHandoff = {
  fromJarva: true;
  lane: JarvaWorkflowPath;
  hint?: string;
};

function isWorkflowPath(v: string): v is JarvaWorkflowPath {
  return PATH_SET.has(v as JarvaWorkflowPath);
}

/** Append handoff query params to an in-app href (preserves existing search). */
export function appendJarvaHandoffParams(href: string, lane: JarvaWorkflowPath): string {
  let url: URL;
  try {
    url = new URL(href, "http://jarva.local");
  } catch {
    return href;
  }
  url.searchParams.set(JARVA_HANDOFF_FROM, "1");
  url.searchParams.set(JARVA_HANDOFF_LANE, lane);
  return url.pathname + (url.search ? url.search : "") + url.hash;
}

export function parseJarvaHandoff(sp: URLSearchParams): ParsedJarvaHandoff | null {
  const from = (sp.get(JARVA_HANDOFF_FROM) || "").trim();
  if (from !== "1") return null;
  const laneRaw = (sp.get(JARVA_HANDOFF_LANE) || "").trim();
  if (!laneRaw || !isWorkflowPath(laneRaw)) return null;
  const hint = (sp.get(JARVA_HANDOFF_HINT) || "").trim() || undefined;
  return { fromJarva: true, lane: laneRaw, hint };
}

/** Remove handoff keys for URL comparison (same destination with/without handoff). */
export function stripJarvaHandoffFromSearchParams(sp: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(sp.toString());
  next.delete(JARVA_HANDOFF_FROM);
  next.delete(JARVA_HANDOFF_LANE);
  next.delete(JARVA_HANDOFF_HINT);
  return next;
}

export function buildDismissHandoffUrl(pathname: string, sp: URLSearchParams): string {
  const next = stripJarvaHandoffFromSearchParams(sp);
  const q = next.toString();
  return q ? `${pathname}?${q}` : pathname;
}

/** One-line next-step copy for the arrival strip (DRAFT framing). */
export function jarvaHandoffNextStepLine(lane: JarvaWorkflowPath): string {
  switch (lane) {
    case "trust_revocable":
    case "trust_irrevocable":
      return "Next: complete labeled intake fields; apply merges into Smart Trust drafts (DRAFT — counsel review).";
    case "trust_ecclesiastical":
      return "Next: bind client/trust if needed, then work the ecclesiastical workflow (DRAFT — not legal advice).";
    case "trust_certificate":
      return "Next: configure offering / issuance details in this workspace (DRAFT — counsel review).";
    case "trust_ppm":
      return "Next: build PPM / subscription package materials and link to trust records (DRAFT).";
    case "trust_bond":
      return "Next: align bond issuance with Issue tab records and PPM references (DRAFT).";
    case "trust_estate":
      return "Next: complete estate / will steps or Trust Records estate tab tasks (DRAFT).";
    default:
      return "Next: continue this workflow in Trust Records (DRAFT — counsel review).";
  }
}

export function jarvaHandoffWhyLine(lane: JarvaWorkflowPath): string {
  return `Jarva routed you here for the ${lane.replace(/^trust_/, "").replace(/_/g, " ")} lane.`;
}

/**
 * Trust Records `tab` query value to emphasize for a lane (when no explicit `tab` is set).
 * Returns null when the lane does not map to a Trust Records tab (e.g. ecclesiastical → separate app).
 */
export function jarvaHandoffTrustRecordsTabForLane(lane: JarvaWorkflowPath): string | null {
  switch (lane) {
    case "trust_bond":
      return "bonds";
    case "trust_certificate":
    case "trust_ppm":
      return "issue";
    case "trust_estate":
      return "estate";
    case "trust_revocable":
    case "trust_irrevocable":
      return "settings";
    case "trust_ecclesiastical":
      return null;
    default:
      return null;
  }
}

/**
 * If `tab` is absent and Jarva handoff is present, returns the tab to merge into the URL.
 * When `tab` is already set, returns null (caller must not override).
 */
export function jarvaHandoffSuggestedTrustRecordsTabIfAbsent(sp: URLSearchParams): string | null {
  const existingTab = (sp.get("tab") || "").trim();
  if (existingTab) return null;
  const handoff = parseJarvaHandoff(sp);
  if (!handoff) return null;
  return jarvaHandoffTrustRecordsTabForLane(handoff.lane);
}

/** Smart Trust / Jarva trust intake: revocable vs irrevocable drafting only (not ecclesiastical or other lanes). */
export function jarvaHandoffTrustDraftingLaneKind(lane: JarvaWorkflowPath): "revocable" | "irrevocable" | null {
  if (lane === "trust_revocable") return "revocable";
  if (lane === "trust_irrevocable") return "irrevocable";
  return null;
}

/** Compact line for trust drafting surfaces (Jarva intake, Smart Trust home). */
export function jarvaHandoffTrustDraftingIntakeLine(kind: "revocable" | "irrevocable"): string {
  if (kind === "revocable") return "Jarva routed you here for revocable trust intake.";
  return "Continue irrevocable trust drafting — complete intake, then apply to the workspace draft.";
}

/** Subtle wizard headline when continuing a revocable / irrevocable Jarva lane inside Smart Trust. */
export function jarvaHandoffTrustDraftingWizardLine(kind: "revocable" | "irrevocable"): string {
  if (kind === "revocable") {
    return "Revocable trust drafting — work Matter Setup first, then continue through the wizard steps.";
  }
  return "Irrevocable trust drafting — work Matter Setup first, then continue through the wizard steps.";
}

/** Clauses, memo, funding, references — same lane context without repeating wizard copy. */
export function jarvaHandoffTrustDraftingSurfaceContinuityLine(kind: "revocable" | "irrevocable"): string {
  if (kind === "revocable") {
    return "Continuing in revocable trust drafting context (Jarva lane).";
  }
  return "Continuing in irrevocable trust drafting context (Jarva lane).";
}

/**
 * Copies Jarva handoff query keys into `target` when the lane is revocable/irrevocable drafting
 * and consistent with the selected entity type (if any). Avoids misleading labels when the user
 * picked a different entity than the Jarva lane.
 */
export function mergeJarvaHandoffIntoSearchParamsIfConsistentWithEntity(
  target: URLSearchParams,
  source: URLSearchParams,
  selectedEntityType: string | null | undefined,
): void {
  const handoff = parseJarvaHandoff(source);
  if (!handoff) return;
  const kind = jarvaHandoffTrustDraftingLaneKind(handoff.lane);
  if (!kind) return;
  const expectedEntity = kind === "revocable" ? "revocable_living_trust" : "irrevocable_trust";
  const selected = (selectedEntityType ?? "").trim();
  if (selected && selected !== expectedEntity) return;
  target.set(JARVA_HANDOFF_FROM, "1");
  target.set(JARVA_HANDOFF_LANE, handoff.lane);
  if (handoff.hint) target.set(JARVA_HANDOFF_HINT, handoff.hint);
}

/** Issue Security wizard: certificate / PPM / bond execution lanes only. */
export type JarvaIssueSecurityExecutionKind = "certificate" | "ppm" | "bond";

export function jarvaHandoffIssueSecurityExecutionKind(lane: JarvaWorkflowPath): JarvaIssueSecurityExecutionKind | null {
  if (lane === "trust_certificate") return "certificate";
  if (lane === "trust_ppm") return "ppm";
  if (lane === "trust_bond") return "bond";
  return null;
}

/** Continuity copy for the Issue Security / securities execution surface (DRAFT framing). */
export function jarvaHandoffIssueSecurityExecutionContinuityLine(kind: JarvaIssueSecurityExecutionKind): string {
  switch (kind) {
    case "certificate":
      return "Certificate issuance lane — work through custody and finalization (Steps E–F), then issue the executed certificate (DRAFT — counsel review).";
    case "ppm":
      return "Private placement / PPM lane — Step D packages PPM, subscription, and specimen materials; finalize before issuance (DRAFT).";
    case "bond":
      return "Bond execution lane — define the security (Step A), align with Trust Records bond registry and PPM references (DRAFT).";
  }
}

/**
 * Trust Records Bonds tab: short cue when Jarva routed for bond work (complements tab selection).
 */
export function jarvaHandoffTrustRecordsBondRegistryContinuityLine(): string {
  return "Bond registry — keep PPM references aligned with Issue tab issuance and bond certificates (DRAFT — counsel review).";
}
