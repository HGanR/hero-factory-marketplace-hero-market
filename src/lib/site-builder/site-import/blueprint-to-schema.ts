import { finalizeGenerationWithTroothertzAndBrandBrain } from "@/lib/site-builder/brand-brain-pipeline";
import { designSystemFromThemeSnapshot } from "@/lib/site-builder/design-system";
import { syncImportRestructureIntoDocument } from "@/lib/site-builder/import-restructure-sync";
import type { ImportBlueprint, ImportSection } from "@/lib/site-builder/site-import/import-blueprint";
import { reconstructHomeBlocksFromMetadata } from "@/lib/site-builder/site-import/semantic-reconstruction";
import {
  SiteSchemaDocument,
  type SiteSchemaDocumentType,
  type SiteWidgetIntegration,
} from "@/lib/site-builder/schema";

function firstHexColor(colors: string[] | undefined): string | undefined {
  if (!colors) return undefined;
  for (const c of colors) {
    const m = c.match(/#([0-9a-f]{3,8})\b/i);
    if (m) return m[0]!;
  }
  return undefined;
}

type MapHeroOpts = { heroBackgroundUrl?: string };

function mapSectionToBlocks(
  section: ImportSection,
  accent: string,
  heroOpts?: MapHeroOpts,
): SiteSchemaDocumentType["pages"][number]["blocks"] {
  const baseMeta = (registryKey: string) => ({ aiSectionId: section.id, aiRegistryKey: registryKey });
  if (section.kind === "hero") {
    const visual: Record<string, unknown> = {
      gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)",
      accent,
      gridOverlay: 0.04,
    };
    const bg = heroOpts?.heroBackgroundUrl?.trim();
    if (bg) {
      visual.background = {
        type: "image",
        value: bg,
        behavior: "scroll",
        fallbackColor: "#0f172a",
        importAssetRef: bg,
        importAssetPolicy: "hotlink_preview",
      };
    }
    return [
      {
        type: "hero" as const,
        content: {
          ...baseMeta("hero_primary"),
          title: (section.heading || "Welcome").slice(0, 200),
          subtitle: (section.bodyText || "").slice(0, 500),
          visual,
        },
      },
    ];
  }
  if (section.kind === "content") {
    return [
      {
        type: "section" as const,
        content: {
          ...baseMeta("paragraph_intro"),
          title: (section.heading || "Section").slice(0, 200),
          body: (section.bodyText || "").slice(0, 12000),
        },
      },
    ];
  }
  if (section.kind === "media" && section.imageUrls?.[0]) {
    return [
      {
        type: "image" as const,
        src: section.imageUrls[0]!.slice(0, 2000),
        content: {
          ...baseMeta("image_spotlight"),
          alt: (section.heading || "Image").slice(0, 200),
          importAssetRef: section.imageUrls[0]!.slice(0, 2000),
          importAssetPolicy: "hotlink_preview" as const,
        },
      },
    ];
  }
  if (section.kind === "cta" && section.linkHref) {
    return [
      {
        type: "button" as const,
        content: {
          ...baseMeta("mid_cta"),
          label: (section.linkLabel || "Learn more").slice(0, 120),
          href: section.linkHref.slice(0, 2000),
        },
      },
    ];
  }
  return [];
}

function buildFooterBlock(blueprint: ImportBlueprint): SiteSchemaDocumentType["pages"][number]["blocks"][number] | null {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const n of [...(blueprint.nav ?? []), ...(blueprint.footerLinks ?? [])].slice(0, 24)) {
    const key = `${n.text}:${n.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`• ${n.text} — ${n.href}`);
  }
  if (!lines.length) return null;
  return {
    type: "footer",
    content: {
      aiSectionId: "import-footer",
      aiRegistryKey: "footer_standard",
      body: ["Imported navigation (editable blueprint):", "", ...lines].join("\n"),
    },
  };
}

function stubPage(slug: string, sourceUrl: string): SiteSchemaDocumentType["pages"][number] {
  return {
    slug,
    blocks: [
      {
        type: "paragraph",
        content: {
          aiSectionId: `import-stub-${slug.replace(/\W+/g, "-")}`,
          aiRegistryKey: "import_route_stub",
          body: `This route was detected in navigation during import from ${sourceUrl}. Replace with your real content — structure is a placeholder only.`,
        },
      },
    ],
  };
}

export type ImportConversionOptions = {
  widgetKey?: string;
  widgetPlacement?: SiteWidgetIntegration["placement"];
  loaderOrigin?: string;
};

export function importBlueprintToSiteSchema(
  blueprint: ImportBlueprint,
  opts?: ImportConversionOptions,
): SiteSchemaDocumentType {
  const hex = firstHexColor(blueprint.brand?.colors);
  const accent = hex || "#22d3ee";
  const gradientStart = hex || "#0f172a";
  const gradientEnd = firstHexColor(blueprint.brand?.colors?.filter((c) => c !== hex)) || "#1e293b";

  const homeBlocks: SiteSchemaDocumentType["pages"][number]["blocks"] = [];
  let sorted = [...blueprint.sections].sort((a, b) => {
    const order = (k: ImportSection["kind"]) =>
      k === "hero" ? 0 : k === "content" ? 1 : k === "media" ? 2 : k === "cta" ? 3 : 4;
    return order(a.kind) - order(b.kind);
  });

  const heroBgUrl = blueprint.heroBackgroundImageUrl?.trim();
  let heroBackgroundConsumed = false;

  const mapOne = (sec: ImportSection) => {
    if (sec.kind === "hero" && heroBgUrl && !heroBackgroundConsumed) {
      heroBackgroundConsumed = true;
      return mapSectionToBlocks(sec, accent, { heroBackgroundUrl: heroBgUrl });
    }
    return mapSectionToBlocks(sec, accent);
  };

  for (const sec of sorted.slice(0, 48)) {
    homeBlocks.push(...mapOne(sec));
  }
  const foot = buildFooterBlock(blueprint);
  if (foot) homeBlocks.push(foot);

  let emptyStructureFallback = false;
  let reconstructionMeta = blueprint.reconstruction;

  /** Guaranteed render contract: never ship an empty home page. */
  if (homeBlocks.length === 0) {
    emptyStructureFallback = true;
    sorted = reconstructHomeBlocksFromMetadata(blueprint);
    for (const sec of sorted) {
      homeBlocks.push(...mapOne(sec));
    }
    const invNote = "Invariant repair: zero blocks after mapping — inserted MVP hero, body, and CTA from metadata and URL.";
    reconstructionMeta = {
      path: "invariant_repair",
      signals: reconstructionMeta?.signals,
      notes: [...(reconstructionMeta?.notes ?? []), invNote],
    };
  }

  const pages: SiteSchemaDocumentType["pages"] = [{ slug: "/", blocks: homeBlocks }];

  for (const route of blueprint.queuedRoutes ?? []) {
    if (!route || route === "/") continue;
    const slug = route.startsWith("/") ? route : `/${route}`;
    if (pages.some((p) => p.slug === slug)) continue;
    pages.push(stubPage(slug, blueprint.sourceUrl));
    if (pages.length >= 20) break;
  }

  const designSystem = designSystemFromThemeSnapshot({
    styleMode: "corporate",
    gradientStart,
    gradientEnd,
  });
  if (hex) {
    designSystem.colors.accent = hex.slice(0, 80);
    designSystem.colors.primary = hex.slice(0, 80);
  }
  if (blueprint.brand?.fontFamilies?.[0]) {
    const f = blueprint.brand.fontFamilies[0]!.slice(0, 200);
    designSystem.typography.fontSans = `${f}, ${designSystem.typography.fontSans}`;
  }

  const metaNotes = [...(blueprint.notes ?? [])];
  metaNotes.push("Imported as an editable blueprint — not a pixel-perfect copy.");
  if (blueprint.partial) metaNotes.push("Partial import: review media, scripts, and gated content manually.");
  if (reconstructionMeta?.notes?.length) {
    metaNotes.push(...reconstructionMeta.notes.slice(0, 12));
  }

  const doc: SiteSchemaDocumentType = {
    pages,
    metadata: {
      title: (blueprint.title || "Imported site").slice(0, 200),
      description: (blueprint.metaDescription || "").slice(0, 2000) || undefined,
      theme: {
        name: "imported-blueprint",
        backgroundMode: "simple_gradients",
        gradientStart,
        gradientEnd,
        styleMode: "corporate",
      },
      designSystem,
      siteImport: {
        version: 1,
        sourceUrl: blueprint.sourceUrl,
        importedAt: new Date().toISOString(),
        primaryLang: blueprint.lang,
        detectedPageCount: pages.length,
        queuedRoutes: blueprint.queuedRoutes,
        extractionNotes: metaNotes.slice(0, 50),
        partialImport: Boolean(blueprint.partial),
        emptyStructureFallback: emptyStructureFallback || undefined,
        reconstruction: reconstructionMeta,
      },
    },
  };

  if (opts?.widgetKey?.trim()) {
    doc.metadata!.widgetIntegration = {
      widgetKey: opts.widgetKey.trim().slice(0, 80),
      placement: opts.widgetPlacement ?? "body_end",
      loaderOrigin: opts.loaderOrigin?.trim() || undefined,
    };
  }

  const parsed = SiteSchemaDocument.parse(doc);
  return parsed;
}

export function finalizeImportedSiteDocument(doc: SiteSchemaDocumentType): SiteSchemaDocumentType {
  finalizeGenerationWithTroothertzAndBrandBrain(doc);
  const { doc: merged } = syncImportRestructureIntoDocument(doc);
  return SiteSchemaDocument.parse(merged);
}
