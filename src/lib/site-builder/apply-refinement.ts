import { ensureDesignSystemOnDocument } from "@/lib/site-builder/design-system";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { SiteBuilderRefinementAnswers } from "@/lib/site-builder/refinement-schema";
import type { SiteBuilderAssetRecord } from "@/lib/site-builder/site-builder-asset";

function firstHeroBlock(doc: SiteSchemaDocumentType) {
  const blocks = doc.pages[0]?.blocks;
  if (!blocks) return null;
  return blocks.find((b) => String(b.type) === "hero") ?? null;
}

/** Merge guided-build answers into schema before / instead of raw generation-only defaults. */
export function applyRefinementToSchema(
  doc: SiteSchemaDocumentType,
  refinement: SiteBuilderRefinementAnswers | undefined,
): SiteSchemaDocumentType {
  if (!refinement) return doc;
  const next = JSON.parse(JSON.stringify(doc)) as SiteSchemaDocumentType;
  const prevMeta = (next.metadata ?? {}) as Partial<NonNullable<SiteSchemaDocumentType["metadata"]>>;
  const meta: NonNullable<SiteSchemaDocumentType["metadata"]> = {
    title: typeof prevMeta.title === "string" && prevMeta.title.trim() ? prevMeta.title : "Site",
    removeDefaultCss: prevMeta.removeDefaultCss ?? false,
    governance: prevMeta.governance ?? {},
    ...prevMeta,
  };
  const prevRef =
    meta.builderRefinement && typeof meta.builderRefinement === "object"
      ? { ...(meta.builderRefinement as Record<string, unknown>) }
      : {};
  const incoming = refinement as Record<string, unknown>;
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined) prevRef[k] = v;
  }
  meta.builderRefinement = prevRef;

  const theme = { ...(meta.theme ?? {}) };

  if (refinement.colorScheme === "light") {
    theme.gradientStart = theme.gradientStart ?? "#f8fafc";
    theme.gradientEnd = theme.gradientEnd ?? "#e2e8f0";
    theme.backgroundMode = "simple_gradients";
  } else if (refinement.colorScheme === "dark" || refinement.colorScheme === "dark_default") {
    theme.gradientStart = theme.gradientStart ?? "#0f172a";
    theme.gradientEnd = theme.gradientEnd ?? "#1e293b";
    theme.backgroundMode = theme.backgroundMode ?? "simple_gradients";
  }
  /* "custom" — keep planner / existing theme tokens */

  if (refinement.motionFeel === "reduced") {
    for (const page of next.pages) {
      for (const block of page.blocks) {
        if (String(block.type) !== "hero") continue;
        const c = block.content as Record<string, unknown>;
        const vis = { ...((c.visual as Record<string, unknown>) ?? {}) };
        vis.animateBackground = false;
        c.visual = vis;
        block.content = c;
      }
    }
  }

  const hbType = refinement.heroBackgroundType;
  const hbVal = refinement.heroBackgroundValue?.trim();
  const hbAssetId = refinement.heroBackgroundAssetId?.trim();
  const assetsMap = next.metadata?.siteBuilderAssets as Record<string, SiteBuilderAssetRecord> | undefined;
  const assetMeta = hbAssetId && assetsMap ? assetsMap[hbAssetId] : undefined;
  const resolvedMedia =
    hbType === "color" ? hbVal || "" : hbVal || (assetMeta?.publicUrl ? String(assetMeta.publicUrl) : "");
  const behavior = refinement.heroBackgroundBehavior ?? "scroll";
  const fallback = refinement.heroBackgroundFallbackColor?.trim() || "#0f172a";

  if (hbType && resolvedMedia) {
    const hero = firstHeroBlock(next);
    if (hero) {
      const c = hero.content as Record<string, unknown>;
      const vis = { ...((c.visual as Record<string, unknown>) ?? {}) };
      vis.background = {
        type: hbType,
        value: resolvedMedia,
        behavior,
        fallbackColor: fallback,
        ...(hbAssetId && (hbType === "image" || hbType === "video") ? { assetId: hbAssetId } : {}),
        ...(assetMeta?.mimeType && (hbType === "image" || hbType === "video") ? { mimeType: assetMeta.mimeType } : {}),
      };
      c.visual = vis;
      hero.content = c;
    }
    if (hbType === "image" || hbType === "video") {
      theme.backgroundMode = "custom_media";
      theme.mediaUrl = resolvedMedia;
      theme.mediaType = hbType === "video" ? "video" : "image";
    } else if (hbType === "color") {
      theme.backgroundMode = "custom_color";
      theme.backgroundColor = resolvedMedia;
    }
  }

  meta.theme = {
    backgroundMode: theme.backgroundMode ?? "simple_gradients",
    mediaType: theme.mediaType ?? "image",
    ...theme,
  };
  next.metadata = meta;

  if (refinement.colorScheme === "light") {
    const ds = ensureDesignSystemOnDocument(next);
    ds.colors.background = "#ffffff";
    ds.colors.surface = "#f8fafc";
    ds.colors.surfaceElevated = "#f1f5f9";
    ds.colors.text = "#0f172a";
    ds.colors.textMuted = "#64748b";
    ds.colors.border = "rgba(15,23,42,0.1)";
  }
  if (refinement.motionFeel === "reduced") {
    const ds = ensureDesignSystemOnDocument(next);
    ds.motion.intensity = Math.min(ds.motion.intensity, 26);
    ds.motion.durationBase = "0.22s";
  }

  return next;
}
