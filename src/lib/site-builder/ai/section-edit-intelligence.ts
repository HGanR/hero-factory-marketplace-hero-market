/**
 * Deterministic classification for adaptive section regeneration (Refine stage).
 * No raw prompt logging — intents/scopes are safe for analytics.
 */

import { buildSiteBuilderAssistantContractAppendix } from "@/lib/site-builder/ai/assistant-builder-context";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

export type EditIntent =
  | "design_token_update"
  | "copy_tone_change"
  | "visual_change"
  | "background_change"
  | "media_change"
  | "layout_change"
  | "section_type_change"
  | "proof_change"
  | "cta_change"
  | "continuity_adjustment";

export type EditScope = "section_only" | "section_plus_neighbors" | "route_level" | "full_rebuild";

/** Session-only agency / launch memory. */
export type AgencySessionMemory = {
  dismissedTaskIds?: string[];
  acceptedTaskIds?: string[];
  prefersLaunchReadiness?: boolean;
  movingTowardLaunch?: boolean;
  deliverableDismissedIds?: string[];
  conversionSuggestionAccepts?: number;
  deliverableSuggestionAccepts?: number;
};

/** Session-only Brand Brain memory (dismiss / accept patterns). */
export type BrandBrainSessionMemory = {
  dismissedSuggestionCodes?: string[];
  acceptedSuggestionCodes?: string[];
  /** Heuristic: user accepts token-safe suggestions more than structural guidance */
  prefersStrongConsistencyHeuristic?: boolean;
  tokenLevelSuggestionAccepts?: number;
  structuralSuggestionAccepts?: number;
};

export type SessionEditContext = {
  lastSectionId?: string;
  /** Last multi-section batch (max 3 ids), most recent first in planner order */
  lastBatchSectionIds?: string[];
  lastEditIntents?: EditIntent[];
  lastEditScope?: EditScope;
  /** Heuristic: user repeatedly asks for wording-only style edits */
  prefersCopyTweaks?: boolean;
  /** Heuristic: user repeatedly asks for swaps / structure */
  prefersStructuralEdits?: boolean;
  /** Drift toward a styleMode from repeated requests */
  styleDrift?: "minimal" | "bold" | "corporate" | "web3";
  brandBrainSession?: BrandBrainSessionMemory;
  agencySession?: AgencySessionMemory;
};

/** Multi-section / structural batch classification (deterministic; safe for analytics). */
export type BatchEditIntent =
  | "multi_section_copy_tone_change"
  | "multi_section_visual_alignment"
  | "multi_section_background_change"
  | "multi_section_cta_alignment"
  | "multi_section_proof_adjustment"
  | "structural_resequence"
  | "structural_insert"
  | "structural_merge"
  | "structural_split"
  | "structural_remove"
  | "structural_rebalance";

const BATCH_INTENT_ORDER: BatchEditIntent[] = [
  "structural_remove",
  "structural_merge",
  "structural_split",
  "structural_insert",
  "structural_rebalance",
  "structural_resequence",
  "multi_section_proof_adjustment",
  "multi_section_cta_alignment",
  "multi_section_background_change",
  "multi_section_visual_alignment",
  "multi_section_copy_tone_change",
];

export function classifyBatchEditIntents(instruction: string, sectionCount: number): BatchEditIntent[] {
  if (sectionCount < 2) return [];
  const t = instruction.trim().toLowerCase();
  const out = new Set<BatchEditIntent>();
  if (!t) {
    out.add("multi_section_visual_alignment");
    return ["multi_section_visual_alignment"];
  }

  if (/\b(remove|delete|drop)\b.*\bsection\b/.test(t) || /\btake out\b.*\bsection\b/.test(t)) out.add("structural_remove");
  if (/\b(merge|combine|unify|one stronger)\b/.test(t)) out.add("structural_merge");
  if (/\b(split|break into|two sections|separate into)\b/.test(t)) out.add("structural_split");
  if (/\b(insert|add (a )?new section)\b/.test(t)) out.add("structural_insert");
  if (/\b(rebalance|re-balance|page flow|narrative order)\b/.test(t)) out.add("structural_rebalance");
  if (
    /\b(move|reorder|re-sequence|resequence|put .*\b(after|before)\b|higher up|lower down|earlier|later in the page)\b/.test(t)
  ) {
    out.add("structural_resequence");
  }

  if (/\b(proof|stats|metrics|stat band)\b/.test(t)) out.add("multi_section_proof_adjustment");
  if (/\b(cta|call to action|button)\b/.test(t)) out.add("multi_section_cta_alignment");
  if (/\b(white background|backdrop|background)\b/.test(t)) out.add("multi_section_background_change");
  if (/\b(align|aligned|consistent|cohesive|same look)\b/.test(t)) out.add("multi_section_visual_alignment");
  if (/\b(editorial|tone|wording|copy|rewrite)\b/.test(t)) out.add("multi_section_copy_tone_change");

  if (out.size === 0) out.add("multi_section_visual_alignment");
  return BATCH_INTENT_ORDER.filter((i) => out.has(i));
}

export function primaryBatchIntent(intents: BatchEditIntent[]): BatchEditIntent {
  return intents[0] ?? "multi_section_visual_alignment";
}

export function shouldApplyLayoutRestructureHeuristic(intents: BatchEditIntent[]): boolean {
  return intents.some((i) => i.startsWith("structural_"));
}

export function resolveBatchEditScope(
  batchIntents: BatchEditIntent[],
  mergedSingleIntents: EditIntent[],
  instruction: string,
): EditScope {
  const t = instruction.toLowerCase();
  if (/\b(whole site|all pages|every route)\b/.test(t)) return "full_rebuild";
  const structuralHeavy = batchIntents.some((i) =>
    ["structural_merge", "structural_split", "structural_insert", "structural_remove", "structural_rebalance"].includes(i),
  );
  if (structuralHeavy) return "route_level";
  if (batchIntents.includes("structural_resequence")) return "route_level";
  return resolveEditScope(mergedSingleIntents, instruction);
}

export function mergeSessionAfterBatchEdit(
  prev: SessionEditContext | undefined,
  sectionIds: string[],
  meta: Pick<SectionEditMeta, "intents" | "scope" | "registrySwapped">,
  instruction?: string,
): SessionEditContext {
  const first = sectionIds[0] ?? "";
  const next = mergeSessionAfterEdit(prev, first, meta, instruction);
  return { ...next, lastBatchSectionIds: sectionIds.slice(0, 3) };
}

export type SectionEditMeta = {
  intents: EditIntent[];
  scope: EditScope;
  registrySwapped: boolean;
  neighborBlocksUpdated: number;
  primaryIntent: EditIntent;
  /** Populated when a site-wide token instruction runs instead of section regen. */
  designTokenKinds?: Array<"color" | "spacing" | "motion" | "shadow" | "density" | "typography">;
  brandGovernanceApplied?: boolean;
};

const INTENT_ORDER: EditIntent[] = [
  "section_type_change",
  "layout_change",
  "continuity_adjustment",
  "proof_change",
  "background_change",
  "media_change",
  "visual_change",
  "cta_change",
  "copy_tone_change",
];

export function classifyEditIntents(instruction: string): EditIntent[] {
  const t = instruction.trim().toLowerCase();
  const out = new Set<EditIntent>();
  if (!t) {
    return ["copy_tone_change"];
  }

  if (/\b(full page|entire page|everything on this page|rebuild\s+all\s+sections?)\b/.test(t)) {
    out.add("layout_change");
    out.add("continuity_adjustment");
  }
  if (/\b(whole site|all pages|every page)\b/.test(t)) {
    out.add("layout_change");
  }
  if (/\b(restructure|reorder|columns?|grid layout|reflow)\b/.test(t)) out.add("layout_change");
  if (/\b(testimonial|quote|customer quote|social proof strip)\b/.test(t)) {
    out.add("section_type_change");
    out.add("proof_change");
  }
  if (/\b(process|step[s]?\s*\d|how it works|workflow)\b/.test(t)) out.add("section_type_change");
  if (/\b(proof-?heavy|more proof|add metrics|show numbers|stats?\b|kpi)\b/.test(t)) out.add("proof_change");
  if (/\b(editorial|magazine|softer tone|gentler|more narrative|less salesy)\b/.test(t)) {
    out.add("copy_tone_change");
    out.add("continuity_adjustment");
  }
  if (/\b(white background|light background|solid white|off-?white)\b/.test(t)) out.add("background_change");
  if (/\b(hero image|background image|video background|replace (the )?photo|new media)\b/.test(t)) out.add("media_change");
  if (/\b(more premium|more luxury|more bold|more minimal|visual polish|elevated look)\b/.test(t)) out.add("visual_change");
  if (/\b(cta|call to action|button text|primary action)\b/.test(t)) out.add("cta_change");
  if (/\b(flow|transition|align with|cohesive|continuity|match (the )?section above|bridge)\b/.test(t)) {
    out.add("continuity_adjustment");
  }
  if (/\b(replace|turn (this )?into|swap|instead of|convert to)\b/.test(t)) out.add("section_type_change");
  if (out.size === 0 && /\b(rewrite|reword|tone|copy|wording|punchier|shorter|longer|clearer)\b/.test(t)) {
    out.add("copy_tone_change");
  }
  if (out.size === 0) out.add("copy_tone_change");

  return INTENT_ORDER.filter((i) => out.has(i)).concat([...out].filter((i) => !INTENT_ORDER.includes(i)));
}

export function resolveEditScope(intents: EditIntent[], instruction: string): EditScope {
  const t = instruction.toLowerCase();
  if (/\b(whole site|all pages|every route)\b/.test(t)) return "full_rebuild";
  if (/\b(full page|entire page|everything|all sections)\b/.test(t)) return "route_level";
  if (intents.includes("continuity_adjustment")) return "section_plus_neighbors";
  if (intents.includes("layout_change")) return "section_plus_neighbors";
  if (intents.includes("section_type_change")) return "section_plus_neighbors";
  if (intents.includes("proof_change") && intents.includes("section_type_change")) return "section_plus_neighbors";
  return "section_only";
}

export function applySessionBiasToScope(
  scope: EditScope,
  intents: EditIntent[],
  session?: SessionEditContext,
): EditScope {
  if (!session) return scope;
  if (session.prefersCopyTweaks && !intents.some((i) => i === "section_type_change" || i === "layout_change")) {
    if (scope === "section_only") return "section_only";
    if (scope === "section_plus_neighbors" && intents.length === 1 && intents[0] === "copy_tone_change") {
      return "section_only";
    }
  }
  return scope;
}

/** If non-null, replace current registry key before rebuild. */
export function resolveRegistrySwap(currentRegistryKey: string, instruction: string): string | null {
  const t = instruction.toLowerCase();
  const k = currentRegistryKey;

  if (/\btestimonial\b/.test(t) || /\bsocial proof (strip|line)\b/.test(t) || /\bcustomer quote\b/.test(t)) {
    if (["feature_grid", "value_props", "paragraph_intro", "stat_band", "trust_strip", "mid_cta"].includes(k)) {
      return "social_proof";
    }
  }
  if (/\b(process|how it works|workflow steps)\b/.test(t)) {
    if (k === "feature_grid" || k === "stat_band") return "value_props";
  }
  if (/\bproof-?heavy\b/.test(t) || /\bmore metrics\b/.test(t) || /\badd stats\b/.test(t)) {
    if (k === "paragraph_intro" || k === "feature_grid" || k === "value_props" || k === "social_proof") {
      return "stat_band";
    }
  }
  if (/\beditorial\b/.test(t) && /\b(less proof|softer proof|remove stats)\b/.test(t)) {
    if (k === "stat_band") return "paragraph_intro";
  }
  return null;
}

export function shouldRegenerateNeighbors(intents: EditIntent[], scope: EditScope): boolean {
  if (scope !== "section_plus_neighbors") return false;
  return intents.some((i) =>
    ["continuity_adjustment", "section_type_change", "layout_change"].includes(i),
  );
}

export function buildRegenerationPlannerPrompt(
  doc: SiteSchemaDocumentType,
  instruction: string,
  session?: SessionEditContext,
): string {
  const title = doc.metadata?.title?.trim() || "";
  const desc = doc.metadata?.description?.trim().slice(0, 400) || "";
  const parts = [
    "Section edit request for an existing site draft.",
    title ? `Site title: ${title}.` : "",
    desc ? `Summary: ${desc}` : "",
    `User request: ${instruction}`,
  ];
  if (session?.prefersCopyTweaks) {
    parts.unshift("Prefer copy and tone adjustments; keep block structure unless the user explicitly asks to change section type.");
  }
  if (session?.prefersStructuralEdits) {
    parts.unshift("User has been making structural changes; satisfy layout/type requests clearly.");
  }
  if (session?.styleDrift) {
    parts.push(`Style bias for this session: ${session.styleDrift}.`);
  }
  if (session?.brandBrainSession?.prefersStrongConsistencyHeuristic) {
    parts.push("Session bias: prefer tighter visual and token consistency across sections unless the user asks otherwise.");
  }
  if (session?.agencySession?.prefersLaunchReadiness || session?.agencySession?.movingTowardLaunch) {
    parts.push("Session bias: prioritize launch clarity, conversion path, and credible proof over experimental layout.");
  }
  const siteImport = doc.metadata?.siteImport;
  if (siteImport?.sourceUrl) {
    const path = siteImport.reconstruction?.path;
    parts.push(
      `IMPORT→REDESIGN mode: This draft was reconstructed from a public URL (${siteImport.sourceUrl}) — not a pixel-perfect clone. Default to improving layout, copy, and CTAs while keeping the same visitor intent; do not rebuild from scratch unless the user asks. Weak HTML / SPA shells may have used path ${path ?? "native"}.`,
    );
  }
  const core = parts.filter(Boolean).join(" ").slice(0, 6500);
  return `${core}\n\n---\n${buildSiteBuilderAssistantContractAppendix()}`.slice(0, 12000);
}

export function mergeSessionAfterEdit(
  prev: SessionEditContext | undefined,
  sectionId: string,
  meta: Pick<SectionEditMeta, "intents" | "scope" | "registrySwapped">,
  instruction?: string,
): SessionEditContext {
  const next: SessionEditContext = { ...prev, lastSectionId: sectionId, lastEditIntents: meta.intents, lastEditScope: meta.scope };
  const structural = meta.registrySwapped || meta.intents.some((i) => i === "section_type_change" || i === "layout_change");
  const copyOnly = meta.intents.every((i) => i === "copy_tone_change");
  const structuralCount = (prev?.prefersStructuralEdits ? 1 : 0) + (structural ? 1 : 0);
  const copyCount = (prev?.prefersCopyTweaks ? 1 : 0) + (copyOnly ? 1 : 0);
  next.prefersStructuralEdits = structuralCount >= 2;
  next.prefersCopyTweaks = copyCount >= 2 && !next.prefersStructuralEdits;

  const ins = (instruction || "").toLowerCase();
  if (/\bminimal|more air|whitespace|lighter touch\b/.test(ins)) next.styleDrift = "minimal";
  else if (/\bbold|punchy|high impact|louder\b/.test(ins)) next.styleDrift = "bold";
  else if (/\bweb3|on-?chain|protocol|token\b/.test(ins)) next.styleDrift = "web3";
  else if (/\bcorporate|enterprise|b2b\b/.test(ins)) next.styleDrift = "corporate";

  return next;
}

export function primaryIntent(intents: EditIntent[]): EditIntent {
  return intents[0] ?? "copy_tone_change";
}
