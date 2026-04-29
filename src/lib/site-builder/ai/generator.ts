import { getRegistryEntry } from "@/lib/site-builder/ai/block-registry";
import { buildVisualDirectionRecord } from "@/lib/site-builder/ai/cinematic-planner-layer";
import { getCinematicStylePresetForLayoutFamily } from "@/lib/site-builder/ai/cinematic-styles";
import {
  applyPlannerSectionSpacingFromRows,
  ensureHeroCinematicQuality,
  injectCinematicVisualMetadata,
} from "@/lib/site-builder/ai/cinematic-visual-injection";
import { applySeoIntelligenceToDocument } from "@/lib/site-builder/seo/seo-intelligence";
import type { SitePlannerInput, SitePlannerOutput } from "@/lib/site-builder/ai/schemas";
import { PageBlueprintSchema, type PageBlueprint } from "@/lib/site-builder/ai/schemas";
import { composeAuxiliaryPagePlan } from "@/lib/site-builder/ai/section-composition";
import { applyTroothertzVisualPostProcessToBlocks } from "@/lib/site-builder/ai/troothertz-visual-postprocess";
import { effectiveStyleModeFromPlanner } from "@/lib/site-builder/ai/visual-tokens";
import { applyVisualDifferentiationPass } from "@/lib/site-builder/visual-differentiation";
import { applyDesignSystemLockToDocument } from "@/lib/site-builder/design-system-lock";
import { buildDesignSystemFromPlanner, hydrateDesignSystemBindingsOnDocument } from "@/lib/site-builder/design-system";
import { SiteSchemaDocument, type SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function titleFromPlanner(planner: SitePlannerOutput): string {
  const t = planner.sitemap[0]?.title?.trim();
  if (t) return t.slice(0, 200);
  const b = planner.normalizedBrief.slice(0, 80).trim();
  return b || "Generated site";
}

function descriptionFromPlanner(planner: SitePlannerOutput): string {
  return planner.normalizedBrief.slice(0, 300);
}

export function buildPageBlueprint(planner: SitePlannerOutput): PageBlueprint {
  const sectionIds = planner.sectionPlan.map((s) => s.id);
  return PageBlueprintSchema.parse({
    version: 1,
    primaryPageSlug: "/",
    planner,
    sectionIds,
  });
}

function buildBlocksForSectionPlan(
  planner: SitePlannerOutput,
  rows: ReadonlyArray<{ id: string; registryKey: string; headline?: string; purpose?: string }>,
  seedPrefix: string,
): SiteSchemaDocumentType["pages"][number]["blocks"] {
  const blocks: SiteSchemaDocumentType["pages"][number]["blocks"] = [];
  for (const row of rows) {
    const entry = getRegistryEntry(row.registryKey);
    if (!entry) continue;
    blocks.push(
      entry.build({
        planner,
        sectionId: row.id,
        seed: `${seedPrefix}:${row.id}:${row.registryKey}`,
        sectionHeadline: row.headline,
      }),
    );
  }
  return blocks;
}

function sitePlannerInputForVisuals(
  planner: SitePlannerOutput,
  opts?: { plannerInput?: SitePlannerInput },
): SitePlannerInput {
  if (opts?.plannerInput) return opts.plannerInput;
  return {
    userPrompt: planner.normalizedBrief || " ",
    siteType: "auto",
    styleIntensity: 55,
    web3VisualMode: false,
  };
}

export function generateSiteSchemaFromPlanner(
  planner: SitePlannerOutput,
  seed = "v1",
  opts?: { plannerInput?: SitePlannerInput },
): SiteSchemaDocumentType {
  const styleMode = effectiveStyleModeFromPlanner(planner);
  const heroTypographyTone =
    getCinematicStylePresetForLayoutFamily(opts?.plannerInput?.layoutFamilyId)?.typographyTone ?? "editorial";

  const finalizeBlocks = (blocks: SiteSchemaDocumentType["pages"][number]["blocks"]) => {
    applyPlannerSectionSpacingFromRows(blocks, planner);
    applyTroothertzVisualPostProcessToBlocks(blocks, styleMode, planner);
    for (const b of blocks) {
      if (String(b.type) === "hero") {
        ensureHeroCinematicQuality(b, { typographyTone: heroTypographyTone });
      }
    }
  };

  const pages: SiteSchemaDocumentType["pages"] = [];
  const homeBlocks = buildBlocksForSectionPlan(planner, planner.sectionPlan, `${seed}:home`);
  finalizeBlocks(homeBlocks);
  pages.push({ slug: "/", blocks: homeBlocks });

  for (const nav of planner.sitemap) {
    if (nav.slug === "/") continue;
    const auxPlan = composeAuxiliaryPagePlan(nav.slug, nav.purpose || "", planner, styleMode, seed);
    const auxBlocks = buildBlocksForSectionPlan(planner, auxPlan, `${seed}:${nav.slug}`);
    finalizeBlocks(auxBlocks);
    pages.push({ slug: nav.slug, blocks: auxBlocks });
  }

  const title = titleFromPlanner(planner);
  const description = descriptionFromPlanner(planner);
  const dt = planner.designTokens;

  const designSystem = buildDesignSystemFromPlanner(planner);

  const vInput = sitePlannerInputForVisuals(planner, opts);
  const visualDirection = buildVisualDirectionRecord(vInput, planner);

  const metadata: NonNullable<SiteSchemaDocumentType["metadata"]> = {
    title,
    description,
    visualDirection,
    theme: {
      name: `${planner.intent}-ai`,
      backgroundMode: dt.backgroundMode ?? (planner.designTokens.motionIntensity && planner.designTokens.motionIntensity > 60 ? "abstract_gradients" : "simple_gradients"),
      gradientStart: dt.gradientStart ?? "#0f172a",
      gradientEnd: dt.gradientEnd ?? "#1e293b",
      styleMode,
      gradientStyle: dt.gradientStyle,
      buttonStyle: dt.buttonStyle,
      depthStyle: dt.depthStyle,
      motionHint: dt.motionHint,
    },
    designSystem,
  };

  const doc: SiteSchemaDocumentType = {
    pages,
    metadata,
  };

  injectCinematicVisualMetadata(doc, opts?.plannerInput);

  let parsed = SiteSchemaDocument.parse(doc);
  hydrateDesignSystemBindingsOnDocument(parsed);
  const seoInput = sitePlannerInputForVisuals(planner, opts);
  parsed = SiteSchemaDocument.parse(applySeoIntelligenceToDocument(parsed, seoInput));
  hydrateDesignSystemBindingsOnDocument(parsed);
  applyDesignSystemLockToDocument(parsed, planner);
  applyVisualDifferentiationPass(parsed, opts?.plannerInput?.layoutFamilyId);
  return SiteSchemaDocument.parse(parsed);
}
