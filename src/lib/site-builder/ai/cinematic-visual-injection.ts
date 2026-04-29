import {
  getCinematicStylePresetForLayoutFamily,
  type CinematicTypographyTonePreset,
} from "@/lib/site-builder/ai/cinematic-styles";
import type { SitePlannerInput, SitePlannerOutput } from "@/lib/site-builder/ai/schemas";
import type { SiteSchemaDocumentType, SiteVisualMetaV2 } from "@/lib/site-builder/schema";

function headlineScaleForTone(tone: CinematicTypographyTonePreset): "hero-md" | "hero-lg" | "hero-xl" {
  if (tone === "minimal") return "hero-md";
  if (tone === "editorial") return "hero-lg";
  return "hero-xl";
}

function cinematicMotionForTone(tone: CinematicTypographyTonePreset): {
  type: "parallax" | "fade" | "slide";
  intensity: number;
} {
  if (tone === "futuristic") return { type: "parallax", intensity: 0.72 };
  if (tone === "bold") return { type: "slide", intensity: 0.62 };
  if (tone === "editorial") return { type: "fade", intensity: 0.48 };
  return { type: "fade", intensity: 0.38 };
}

/**
 * Ensures the hero is never a flat color wash: layered gradients, depth read, CTA emphasis, scaled headline intent.
 */
export function ensureHeroCinematicQuality(
  block: SiteSchemaDocumentType["pages"][number]["blocks"][number],
  opts?: { typographyTone?: CinematicTypographyTonePreset },
): void {
  if (String(block.type) !== "hero") return;
  const raw = block.content;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const content = { ...(raw as Record<string, unknown>) };
  const visual =
    content.visual && typeof content.visual === "object" && !Array.isArray(content.visual)
      ? { ...(content.visual as Record<string, unknown>) }
      : {};
  const tone = opts?.typographyTone ?? "editorial";
  const g = String(visual.gradient || "");
  const looksPlain =
    !g ||
    g.length < 28 ||
    /^#([0-9a-f]{3,8})$/i.test(g.trim()) ||
    (!g.includes("gradient") && !g.includes("rgba"));
  if (looksPlain) {
    visual.gradient =
      "linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.92) 45%, rgba(59,130,246,0.22) 100%), radial-gradient(circle at 18% 22%, rgba(34,211,238,0.32), transparent 46%)";
  } else if (!/radial-gradient/i.test(g)) {
    visual.gradient = `${g}, radial-gradient(circle at 88% 8%, rgba(255,255,255,0.09), transparent 44%)`;
  }
  visual.cinematicBackdrop =
    String(visual.cinematicBackdrop || "") ||
    "radial-gradient(circle at 50% 118%, rgba(99,102,241,0.28), transparent 58%)";
  visual.heroSurface = visual.heroSurface || "layered-gradient";
  visual.ctaEmphasis = true;
  content.headlineScale = content.headlineScale ?? headlineScaleForTone(tone);
  const motionRaw = content.motion && typeof content.motion === "object" && !Array.isArray(content.motion) ? content.motion : {};
  const motion = { ...(motionRaw as Record<string, unknown>) };
  motion.cinematic = motion.cinematic ?? cinematicMotionForTone(tone);
  content.visual = visual;
  content.motion = motion;
  (block as { content: unknown }).content = content;
}

export function buildSiteVisualMetaFromPlannerInput(input: SitePlannerInput): SiteVisualMetaV2 | null {
  const id = input.layoutFamilyId?.trim();
  if (!id) return null;
  const preset = getCinematicStylePresetForLayoutFamily(id);
  if (!preset) return null;
  return {
    layoutFamilyId: id,
    gradientStyle: preset.gradientStyle,
    backgroundStyle: preset.backgroundStyle,
    lightingStyle: preset.lightingStyle,
  };
}

export function applyPlannerSectionSpacingFromRows(
  blocks: SiteSchemaDocumentType["pages"][number]["blocks"],
  planner: SitePlannerOutput,
): void {
  for (const block of blocks) {
    const raw = block.content;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const content = raw as Record<string, unknown>;
    const sid = typeof content.aiSectionId === "string" ? content.aiSectionId.trim() : "";
    if (!sid) continue;
    const row = planner.sectionPlan.find((s) => s.id === sid);
    const sp = row?.spacingScale;
    if (sp !== "tight" && sp !== "balanced" && sp !== "spacious") continue;
    const pad = sp === "tight" ? 10 : sp === "spacious" ? 22 : 14;
    const style =
      content.style && typeof content.style === "object" && !Array.isArray(content.style)
        ? { ...(content.style as Record<string, unknown>) }
        : {};
    style.padding = pad;
    (block as { content: unknown }).content = { ...content, style };
  }
}

export function injectCinematicVisualMetadata(doc: SiteSchemaDocumentType, plannerInput?: SitePlannerInput): void {
  const vm = buildSiteVisualMetaFromPlannerInput(
    plannerInput ?? { userPrompt: doc.metadata?.title?.trim() || " ", siteType: "auto" },
  );
  if (!vm) return;
  doc.metadata = { ...(doc.metadata ?? {}), visualMeta: vm };
}

function typographyToneFromVisualMeta(vm: SiteVisualMetaV2 | undefined): CinematicTypographyTonePreset {
  if (!vm?.layoutFamilyId) return "editorial";
  return getCinematicStylePresetForLayoutFamily(vm.layoutFamilyId)?.typographyTone ?? "editorial";
}

export function reinforceCinematicHeroesOnDocument(doc: SiteSchemaDocumentType): void {
  const tone = typographyToneFromVisualMeta(doc.metadata?.visualMeta);
  for (const page of doc.pages) {
    for (const block of page.blocks) {
      if (String(block.type) === "hero") {
        ensureHeroCinematicQuality(block, { typographyTone: tone });
      }
    }
  }
}
