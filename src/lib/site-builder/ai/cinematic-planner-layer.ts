import { applyLayoutFamilyTokensToPlannerDesignTokens } from "@/lib/site-builder/ai/cinematic-styles";
import {
  buildVisualDirectionSummary,
  detectCinematicDesignIntent,
  extractExplicitVisualConstraints,
  shouldForceDarkCinematicPlatter,
  shouldForceLightCinematicPlatter,
} from "@/lib/site-builder/ai/cinematic-design-intent";
import type { SiteBuilderIntakeFields } from "@/lib/site-builder/ai/site-builder-intake";
import type { SitePlannerInput, SitePlannerOutput } from "@/lib/site-builder/ai/schemas";
import { SitePlannerOutputSchema } from "@/lib/site-builder/ai/schemas";
import { applyStrictLayoutFamilyToPlanner, stampSectionRolesOnPlanner } from "@/lib/site-builder/ai/section-composition";
import type { VisualDirectionRecord } from "@/lib/site-builder/ai/cinematic-design-intent";

function intakeFromPlannerInput(input: SitePlannerInput): SiteBuilderIntakeFields {
  return {
    businessName: input.businessName ?? "",
    primaryOffer: input.primaryOffer ?? "",
    audience: input.audience ?? "",
    industry: input.industry ?? "",
    market: input.market ?? "",
    additionalNotes: input.userPrompt,
    conversionGoal: input.statedConversionGoal ?? "",
    brandTone: input.statedBrandTone ?? "",
    designPreference: input.statedDesignPreference ?? "",
    inspirationWebsites: (input.competitorUrls ?? []).filter(Boolean).join("\n"),
    trustAndProof: input.statedTrustAndProof ?? "",
  };
}

export type { VisualDirectionRecord };

export function buildVisualDirectionRecord(
  input: SitePlannerInput,
  planner: SitePlannerOutput,
): VisualDirectionRecord {
  const intake = intakeFromPlannerInput(input);
  const c = detectCinematicDesignIntent(input.userPrompt, intake, {
    designDirection: input.designDirection,
    styleIntensity: input.styleIntensity,
    web3VisualMode: input.web3VisualMode,
    siteType: String(input.siteType),
  });
  return buildVisualDirectionSummary(
    c,
    extractExplicitVisualConstraints(input.userPrompt),
    planner.designTokens,
    planner.intent,
  );
}

const promptFingerprint = (input: SitePlannerInput, planner: SitePlannerOutput) =>
  `${input.userPrompt}\n${planner.normalizedBrief}`.toLowerCase();

function mergeLayoutFamilyCinematicLayer(input: SitePlannerInput, planner: SitePlannerOutput): void {
  const id = input.layoutFamilyId?.trim();
  if (!id) return;
  applyLayoutFamilyTokensToPlannerDesignTokens(
    planner.designTokens,
    id,
    `${input.userPrompt}:${id}:${planner.normalizedBrief}`,
  );
}

/**
 * Merges cinematic heuristics + user constraints into planner output without replacing the core planner.
 * Call after `runSitePlanner` (and for each generate variant with a distinct `variantIndex` when `variantCount > 1`).
 */
export function applyCinematicPostProcessToPlannerOutput(
  input: SitePlannerInput,
  planner: SitePlannerOutput,
  opts?: { variantIndex?: number; variantCount?: number },
): SitePlannerOutput {
  const intake = intakeFromPlannerInput(input);
  const matchText = [
    input.userPrompt,
    intake.industry,
    intake.market,
    input.inspirationBrief?.tone,
    input.inspirationBrief?.colorDirection,
    input.inspirationBrief?.heroPattern,
    ...(input.inspirationBrief?.keywordThemes ?? []),
  ]
    .filter(Boolean)
    .join("\n");
  const c = detectCinematicDesignIntent(matchText, intake, {
    designDirection: input.designDirection,
    styleIntensity: input.styleIntensity,
    web3VisualMode: input.web3VisualMode,
    siteType: String(input.siteType),
  });
  const v = extractExplicitVisualConstraints(input.userPrompt);
  const vi = Math.max(0, opts?.variantIndex ?? 0);
  const vc = Math.max(1, opts?.variantCount ?? 1);

  const next = JSON.parse(JSON.stringify(planner)) as SitePlannerOutput;
  applyStrictLayoutFamilyToPlanner(next, input);
  const forceLight = shouldForceLightCinematicPlatter(v);
  const forceDark = shouldForceDarkCinematicPlatter(v) && !forceLight;
  const needsCinematicPass = c.isCinematic || forceLight || forceDark;

  if (!needsCinematicPass) {
    mergeLayoutFamilyCinematicLayer(input, next);
    stampSectionRolesOnPlanner(next);
    return SitePlannerOutputSchema.parse(next);
  }

  next.designTokens = { ...next.designTokens };

  if (forceLight) {
    next.designTokens.backgroundMode = "white-editorial";
    next.designTokens.gradientStart = "#ffffff";
    next.designTokens.gradientEnd = vi % 2 === 0 ? "#f8fafc" : "#f1f5f9";
    next.designTokens.gradientStyle = vi % 3 === 1 ? "chrome" : "soft-mesh";
    next.designTokens.buttonStyle =
      v.buttonStyle === "glow" ? "glow" : v.buttonStyle === "glass" ? "glass" : "bold-solid";
    next.designTokens.depthStyle = "card-depth";
    next.designTokens.motionHint = "subtle-parallax";
    if (/web3|blockchain|wallet|chain|protocol/i.test(input.userPrompt)) {
      next.designTokens.accent = (next.designTokens.accent || "").trim() || "#0ea5e9";
    } else {
      next.designTokens.accent = (next.designTokens.accent || "").trim() || "#0f172a";
    }
  } else if (forceDark) {
    next.designTokens.backgroundMode = "dark-cinematic";
    next.designTokens.gradientStart = "#020617";
    next.designTokens.gradientEnd = "#5b21b6";
    next.designTokens.gradientStyle = "aurora";
    next.designTokens.depthStyle = "cinematic-layered";
    next.designTokens.buttonStyle = "glow";
    next.designTokens.motionHint = "scroll-reveal";
  } else if (vc > 1 && c.isCinematic) {
    const m = vi % 3;
    if (m === 0) {
      next.designTokens.backgroundMode = "white-editorial";
      next.designTokens.gradientStart = "#ffffff";
      next.designTokens.gradientEnd = "#e2e8f0";
      next.designTokens.gradientStyle = "soft-mesh";
      next.designTokens.buttonStyle = "bold-solid";
      next.designTokens.depthStyle = "card-depth";
      next.designTokens.motionHint = "subtle-parallax";
    } else if (m === 1) {
      next.designTokens.backgroundMode = "holographic-gradient";
      next.designTokens.gradientStart = "#0f172a";
      next.designTokens.gradientEnd = "#4c1d95";
      next.designTokens.gradientStyle = "neon-radial";
      next.designTokens.buttonStyle = "glow";
      next.designTokens.depthStyle = "floating-panels";
      next.designTokens.motionHint = "floating-orbs";
    } else {
      next.designTokens.backgroundMode = "luxury-minimal";
      next.designTokens.gradientStart = "#fafaf9";
      next.designTokens.gradientEnd = "#d6d3d1";
      next.designTokens.gradientStyle = "chrome";
      next.designTokens.buttonStyle = "chrome";
      next.designTokens.depthStyle = "cinematic-layered";
      next.designTokens.motionHint = "scroll-reveal";
    }
  } else if (c.mood === "web3-holographic" || c.mood === "futuristic") {
    next.designTokens.backgroundMode = "holographic-gradient";
    next.designTokens.gradientStart = next.designTokens.gradientStart || "#0f172a";
    next.designTokens.gradientEnd = next.designTokens.gradientEnd || "#581c87";
    next.designTokens.gradientStyle = "neon-radial";
    next.designTokens.depthStyle = "floating-panels";
    next.designTokens.buttonStyle = "glow";
    next.designTokens.motionHint = next.designTokens.motionHint || "floating-orbs";
  } else if (c.mood === "luxury" || c.mood === "minimal-cinematic") {
    next.designTokens.backgroundMode = "luxury-minimal";
    next.designTokens.gradientStyle = c.mood === "luxury" ? "chrome" : "soft-mesh";
    next.designTokens.depthStyle = "cinematic-layered";
    next.designTokens.buttonStyle = c.mood === "luxury" ? "chrome" : "bold-solid";
  } else if (c.isCinematic) {
    if (!next.designTokens.backgroundMode) {
      next.designTokens.backgroundMode = "abstract_gradients";
    }
    next.designTokens.gradientStyle = next.designTokens.gradientStyle || "aurora";
    next.designTokens.depthStyle = next.designTokens.depthStyle || "cinematic-layered";
    next.designTokens.buttonStyle = next.designTokens.buttonStyle || "glow";
    next.designTokens.motionHint = next.designTokens.motionHint || "subtle-parallax";
  }

  if (next.sectionPlan.length) {
    const first = { ...next.sectionPlan[0]! };
    if (forceLight) {
      if (vc > 1) {
        first.registryKey = vi % 2 === 0 ? "hero_white_editorial_bold" : "hero_cinematic_split";
      } else {
        first.registryKey = v.typographyMood === "bold" ? "hero_white_editorial_bold" : "hero_cinematic_split";
      }
    } else if (forceDark) {
      first.registryKey = "hero_holographic_depth";
    } else if (vc > 1 && c.isCinematic) {
      const m = vi % 3;
      if (m === 0) {
        first.registryKey = "hero_white_editorial_bold";
      } else if (m === 1) {
        first.registryKey = "hero_holographic_depth";
      } else {
        first.registryKey = "hero_cinematic_split";
      }
    } else if (c.mood === "web3-holographic" || c.mood === "futuristic") {
      first.registryKey = "hero_holographic_depth";
    } else if (c.isCinematic) {
      first.registryKey = "hero_cinematic_split";
    }
    next.sectionPlan[0] = first;
  }

  if (c.isCinematic) {
    const t = promptFingerprint(input, next);
    next.sectionPlan = next.sectionPlan.map((row) => {
      if (row.registryKey === "feature_grid") {
        return { ...row, registryKey: "feature_bento_glass" };
      }
      if (row.registryKey === "trust_strip") {
        return { ...row, registryKey: "trust_network_grid" };
      }
      if (row.registryKey === "mid_cta") {
        if (/\b(agent|chat|assistant|chatbot)\b/.test(t)) {
          return { ...row, registryKey: "agent_showcase_orb" };
        }
        if (/\b(pric|plan|tier|subscribe|billing)\b/.test(t)) {
          return { ...row, registryKey: "pricing_cinematic_cards" };
        }
        return { ...row, registryKey: "cta_glow_panel" };
      }
      if (row.registryKey === "social_proof" && /web3|blockchain|on-?chain|defi|protocol|network|node/.test(t)) {
        return { ...row, registryKey: "web3_proof_network" };
      }
      return row;
    });
  }

  mergeLayoutFamilyCinematicLayer(input, next);
  stampSectionRolesOnPlanner(next);
  return SitePlannerOutputSchema.parse(next);
}
