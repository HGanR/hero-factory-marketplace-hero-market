import { classifyJarvaEntry } from "@/lib/jarva/jarva-entry-router";
import type { JarvaEntryIntent, JarvaEntryRoute } from "@/lib/jarva/jarva-entry-router";

/**
 * Persisted “specialist lane” after entry classification (not `trust_general` / `unknown`).
 * Mirrors `JarvaEntryIntent` for the seven resolved product paths.
 */
export type JarvaWorkflowPath =
  | "trust_revocable"
  | "trust_irrevocable"
  | "trust_ecclesiastical"
  | "trust_certificate"
  | "trust_ppm"
  | "trust_bond"
  | "trust_estate";

const PATH_SET = new Set<JarvaWorkflowPath>([
  "trust_revocable",
  "trust_irrevocable",
  "trust_ecclesiastical",
  "trust_certificate",
  "trust_ppm",
  "trust_bond",
  "trust_estate",
]);

export function isJarvaWorkflowPath(v: string | null | undefined): v is JarvaWorkflowPath {
  return typeof v === "string" && PATH_SET.has(v as JarvaWorkflowPath);
}

/** Stored in `oasis_npc_sessions.jarvaWorkflowPath` to clear specialist lane without transcript immediately re-picking from history. */
export const JARVA_WORKFLOW_TRANSCRIPT_SUPPRESS = "__suppress__" as const;

export function sessionTranscriptFallbackSuppressed(raw: string | null | undefined): boolean {
  return typeof raw === "string" && raw.trim() === JARVA_WORKFLOW_TRANSCRIPT_SUPPRESS;
}

/** Map current entry classification to a workflow path when the consultant has picked a lane. */
export function resolveJarvaWorkflowPath(route: JarvaEntryRoute | null): JarvaWorkflowPath | null {
  if (!route) return null;
  const i = route.intent as JarvaEntryIntent;
  if (i === "unknown" || i === "trust_general") return null;
  if (PATH_SET.has(i as JarvaWorkflowPath)) return i as JarvaWorkflowPath;
  return null;
}

/** How the effective workflow path was chosen for this turn (API / UI). */
export type JarvaWorkflowPathSource =
  | "explicit_turn"
  | "sticky_session"
  | "transcript_fallback"
  | "lane_control"
  | "lane_clear";

export function parseJarvaWorkflowPathFromStorage(value: string | null | undefined): JarvaWorkflowPath | null {
  if (!value || typeof value !== "string") return null;
  const v = value.trim();
  if (v === JARVA_WORKFLOW_TRANSCRIPT_SUPPRESS) return null;
  return PATH_SET.has(v as JarvaWorkflowPath) ? (v as JarvaWorkflowPath) : null;
}

/**
 * Resolution order:
 * 1) Current message alone classifies to a specialist lane → explicit_turn (overrides sticky).
 * 2) Stored sticky session path → sticky_session.
 * 3) Full transcript re-classification → transcript_fallback (establishes sticky when none stored),
 *    unless transcript fallback is suppressed (see `JARVA_WORKFLOW_TRANSCRIPT_SUPPRESS`).
 * 4) Otherwise null (unknown / trust_general alone does not clear sticky in DB).
 */
export function resolveEffectiveJarvaWorkflowPath(args: {
  currentMessage: string;
  combinedUserText: string;
  stickyPath: JarvaWorkflowPath | null;
  /** When session row holds `__suppress__`, skip transcript re-classification until explicit lane or lane_control set. */
  transcriptFallbackSuppressed?: boolean;
}): { path: JarvaWorkflowPath | null; source: JarvaWorkflowPathSource | null } {
  const currentRoute = classifyJarvaEntry(args.currentMessage.trim());
  const explicitPath = resolveJarvaWorkflowPath(currentRoute);
  if (explicitPath) {
    return { path: explicitPath, source: "explicit_turn" };
  }

  if (args.stickyPath) {
    return { path: args.stickyPath, source: "sticky_session" };
  }

  if (args.transcriptFallbackSuppressed) {
    return { path: null, source: null };
  }

  const combinedRoute = classifyJarvaEntry(args.combinedUserText);
  const fallbackPath = resolveJarvaWorkflowPath(combinedRoute);
  if (fallbackPath) {
    return { path: fallbackPath, source: "transcript_fallback" };
  }

  return { path: null, source: null };
}

/** Whether to persist `path` onto the NPC session row for the next turn. Never returns "clear". */
export function shouldPersistJarvaWorkflowPath(params: {
  source: JarvaWorkflowPathSource | null;
  path: JarvaWorkflowPath | null;
  hadStickyBefore: boolean;
}): JarvaWorkflowPath | null {
  if (!params.path || !params.source) return null;
  if (params.source === "lane_control" || params.source === "lane_clear") return null;
  if (params.source === "explicit_turn") return params.path;
  if (params.source === "transcript_fallback" && !params.hadStickyBefore) return params.path;
  return null;
}

/** Extra procedural banner lines (DRAFT / platform routing — not legal advice). */
export const JARVA_PATH_FOCUS_INSTRUCTIONS: Record<JarvaWorkflowPath, string[]> = {
  trust_revocable: [
    "Path focus: **Revocable / living-style** — prioritize grantor/trustee identity, beneficiaries, successor trustees, and pour-over will coordination as **DRAFT** routing notes.",
  ],
  trust_irrevocable: [
    "Path focus: **Irrevocable** — capture funding intent and transfer/control considerations as **DRAFT** workpapers for counsel review (not titling or tax advice).",
  ],
  trust_ecclesiastical: [
    "Path focus: **Ecclesiastical** — align religious purpose, affiliation/structure, and trustee/custodian roles with **`/ecclesiastical`** wizard fields; outputs stay **DRAFT**.",
  ],
  trust_certificate: [
    "Path focus: **Certificates** — verify workspace readiness, then use Trust Records → **Issue** / **Certificates** and **Settings** (prefix/seal); Jarva does not issue certificates automatically.",
  ],
  trust_ppm: [
    "Path focus: **PPM / private placement** — confirm trust/workspace context, issuer posture, and that securities-related materials remain **DRAFT** pending counsel and approvals.",
  ],
  trust_bond: [
    "Path focus: **Bonds / indenture** — confirm obligor/trust authority, indenture purpose, and **PPM** prerequisites in Trust Records before bond workflow steps.",
  ],
  trust_estate: [
    "Path focus: **Estate / will** — gather will/testamentary intent and executor-style facts as **DRAFT** notes; use Trust Records **Estate** paths when appropriate.",
  ],
};
