/**
 * Brand Brain orchestration: evaluate → safe autofix → optional second Troothertz pass → metadata.
 */

import { reinforceCinematicHeroesOnDocument } from "@/lib/site-builder/ai/cinematic-visual-injection";
import { applyTroothertzVisualPostProcessToDocument, styleModeFromSiteDocument } from "@/lib/site-builder/ai/troothertz-visual-postprocess";
import { applyBrandBrainAutofixes, applyBrandBrainFixByCode } from "@/lib/site-builder/brand-brain-autofix";
import { evaluateBrandBrain } from "@/lib/site-builder/brand-brain-evaluate";
import {
  type BrandBrainDecisionMode,
  type BrandBrainFinding,
  type BrandBrainQueueItem,
  BrandBrainStateSchema,
} from "@/lib/site-builder/brand-brain-schema";
import { runAgencyLaunchOrchestration } from "@/lib/site-builder/agency-launch-pipeline";
import { hydrateDesignSystemBindingsOnDocument } from "@/lib/site-builder/design-system";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

export { applyBrandBrainFixByCode };

const PREMIUM_LABELS: Record<string, string> = {
  cta_tone_inconsistent: "I can align CTA emphasis across pages.",
  visual_accent_token_drift: "I can snap accents to your design tokens.",
  hero_cta_accent_mismatch: "I can match mid-page CTAs to the hero thread.",
  proof_overload_mid: "I can soften proof density in this stretch.",
  spacing_padding_imbalance: "I can normalize spacing between text sections.",
  accent_streak_heavy: "I can calm an accent-heavy run.",
  proof_underuse_home: "A light proof moment on home could help credibility.",
  visual_density_high: "This page reads heavier than a minimal direction.",
  narrative_weak_cta_placement: "A late invitation would complete the arc.",
  route_family_inconsistent: "Routes could share a bit more parallel depth.",
  theme_media_drift: "Background media and theme could align more closely.",
};

function fixabilityForCode(code: string): BrandBrainQueueItem["fixability"] {
  if (
    code === "proof_underuse_home" ||
    code === "narrative_weak_cta_placement" ||
    code === "route_family_inconsistent"
  ) {
    return "structural";
  }
  if (code === "theme_media_drift" || code === "visual_density_high") {
    return "suggest";
  }
  return "safe_auto";
}

function buildQueue(
  findings: BrandBrainFinding[],
  mode: BrandBrainDecisionMode,
  appliedCodes: string[],
): BrandBrainQueueItem[] {
  const applied = new Set(appliedCodes);
  const out: BrandBrainQueueItem[] = [];

  for (const f of findings) {
    const fixability = fixabilityForCode(f.code);
    const autoApplied = applied.has(f.code);
    const surfacedAsSuggestion = fixability === "safe_auto" ? !autoApplied : true;

    out.push({
      code: f.code,
      severity: f.severity,
      scope: f.scope,
      route: f.route,
      sectionId: f.sectionId,
      fixability,
      autoApplied,
      surfacedAsSuggestion,
      label: PREMIUM_LABELS[f.code] ?? "A small consistency pass is available.",
      recommendation: f.recommendation,
    });
  }

  out.sort((a, b) => {
    const sev = (x: BrandBrainQueueItem) => (x.severity === "warn" ? 0 : 1);
    const d = sev(a) - sev(b);
    if (d !== 0) return d;
    return a.code.localeCompare(b.code);
  });

  return out;
}

function writeBrandBrainState(
  doc: SiteSchemaDocumentType,
  evaluation: ReturnType<typeof evaluateBrandBrain>,
  mode: BrandBrainDecisionMode,
  appliedCodes: string[],
): void {
  const base = doc.metadata ?? { title: "Site" };
  const queue = buildQueue(evaluation.findings, mode, appliedCodes);
  const state = BrandBrainStateSchema.parse({
    version: 1,
    decisionMode: mode,
    evaluatedAt: new Date().toISOString(),
    findings: evaluation.findings,
    scorecard: evaluation.scorecard,
    improvementQueue: queue,
    lastAppliedCodes: appliedCodes,
  });
  doc.metadata = { ...base, brandBrain: state };
  runAgencyLaunchOrchestration(doc);
}

/**
 * Run after Troothertz + governance has been applied at least once on `doc`.
 * May run Troothertz again if autofixes touched visual metadata.
 */
export function applyBrandBrainAfterTroothertz(
  doc: SiteSchemaDocumentType,
  styleSource: SiteSchemaDocumentType,
  mode: BrandBrainDecisionMode,
): { appliedCodes: string[] } {
  const styleMode = styleModeFromSiteDocument(styleSource);
  const evaluation = evaluateBrandBrain(doc);
  const { touched, appliedCodes } = applyBrandBrainAutofixes(doc, evaluation, mode);
  if (touched) {
    applyTroothertzVisualPostProcessToDocument(doc, styleMode);
  }
  const evaluationFinal = evaluateBrandBrain(doc);
  writeBrandBrainState(doc, evaluationFinal, mode, appliedCodes);
  return { appliedCodes };
}

/** Initial full build: one Troothertz pass, Brand Brain (aggressive safe fixes), optional second Troothertz. */
export function finalizeGenerationWithTroothertzAndBrandBrain(doc: SiteSchemaDocumentType): void {
  applyTroothertzVisualPostProcessToDocument(doc, styleModeFromSiteDocument(doc));
  applyBrandBrainAfterTroothertz(doc, doc, "safe_auto_apply");
  hydrateDesignSystemBindingsOnDocument(doc);
  reinforceCinematicHeroesOnDocument(doc);
}

export function pickProactiveSuggestionLabels(queue: BrandBrainQueueItem[], dismissed: Set<string>, limit = 3): BrandBrainQueueItem[] {
  return queue.filter((q) => q.surfacedAsSuggestion && !q.autoApplied && !dismissed.has(q.code)).slice(0, limit);
}
