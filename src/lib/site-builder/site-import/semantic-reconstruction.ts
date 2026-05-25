/**
 * Semantic reconstruction: turn weak HTML blueprints into a minimum viable marketing structure
 * before mapping to SiteSchemaDocument. This is not cloning — it is builder-native reconstruction.
 */

import type { ImportBlueprint, ImportNavItem, ImportSection } from "@/lib/site-builder/site-import/import-blueprint";
import { ImportBlueprintSchema } from "@/lib/site-builder/site-import/import-blueprint";
import { logSiteImportStage } from "@/lib/site-builder/site-import/import-pipeline-log";

export type ReconstructionPath = NonNullable<ImportBlueprint["reconstruction"]>["path"];

export type SemanticSignals = NonNullable<ImportBlueprint["reconstruction"]>["signals"] & {
  sectionGroupsApprox: number;
};

function navPattern(nav: ImportNavItem[] | undefined): SemanticSignals["navPattern"] {
  const n = nav?.length ?? 0;
  if (n === 0) return "none";
  if (n <= 4) return "minimal";
  if (n <= 10) return "header_nav";
  return "dense";
}

function countCtaSections(sections: ImportSection[]): number {
  return sections.filter((s) => s.kind === "cta").length;
}

function countHeroSections(sections: ImportSection[]): number {
  return sections.filter((s) => s.kind === "hero").length;
}

function avgConfidence(sections: ImportSection[]): number {
  if (!sections.length) return 0;
  const sum = sections.reduce((a, s) => a + (s.confidence ?? 0.5), 0);
  return sum / sections.length;
}

function marketingStructureScore(blueprint: ImportBlueprint, signals: Omit<SemanticSignals, "sectionGroupsApprox"> & { sectionGroupsApprox: number }): number {
  let score = 0;
  if (countHeroSections(blueprint.sections) > 0) score += 0.35;
  if (countCtaSections(blueprint.sections) > 0) score += 0.25;
  if (blueprint.sections.some((s) => s.kind === "content")) score += 0.2;
  if (blueprint.sections.some((s) => s.kind === "media")) score += 0.1;
  if ((blueprint.nav?.length ?? 0) > 0) score += 0.1;
  score += Math.min(0.15, signals.sectionGroupsApprox * 0.03);
  return Math.min(1, score);
}

function pickPrimaryHeadline(blueprint: ImportBlueprint): string {
  const og = blueprint.ogTitle?.trim();
  const t = blueprint.title?.trim();
  if (og && og.length > 2) return og.slice(0, 200);
  if (t && t.length > 2) return t.slice(0, 200);
  return "Your story, rebuilt for the web";
}

function pickSubtitle(blueprint: ImportBlueprint): string {
  const d = blueprint.metaDescription?.trim();
  if (d && d.length > 8) return d.slice(0, 500);
  const first = blueprint.sections.find((s) => s.bodyText?.trim());
  if (first?.bodyText) return first.bodyText.trim().slice(0, 500);
  return "Imported as an editable blueprint — refine copy, layout, and CTAs in the builder.";
}

function pickCtaFromNav(nav: ImportNavItem[] | undefined): { href: string; label: string } | null {
  if (!nav?.length) return null;
  const contact = nav.find((n) => /contact|book|schedule|get started|sign up|demo/i.test(`${n.text} ${n.href}`));
  if (contact) return { href: contact.href.slice(0, 2000), label: contact.text.slice(0, 120) || "Contact" };
  return { href: nav[0]!.href.slice(0, 2000), label: nav[0]!.text.slice(0, 120) || "Learn more" };
}

/** Rank images: hero_candidate > section > logo > social > decorative */
function rankScore(role: ImportSection["imageRole"]): number {
  switch (role) {
    case "hero_candidate":
      return 5;
    case "section":
      return 3;
    case "logo":
      return 2;
    case "social":
      return 1;
    case "decorative":
      return 0;
    default:
      return 2;
  }
}

function pickHeroBackgroundUrl(sections: ImportSection[]): string | undefined {
  const media = sections.filter((s) => s.kind === "media" && s.imageUrls?.[0]);
  if (!media.length) return undefined;
  const sorted = [...media].sort((a, b) => {
    const d = rankScore(b.imageRole) - rankScore(a.imageRole);
    if (d !== 0) return d;
    if (a.fromOpenGraph && !b.fromOpenGraph) return -1;
    if (!a.fromOpenGraph && b.fromOpenGraph) return 1;
    return 0;
  });
  return sorted[0]?.imageUrls?.[0]?.slice(0, 2000);
}

function injectMvpSections(blueprint: ImportBlueprint, notes: string[]): ImportSection[] {
  const out: ImportSection[] = [...blueprint.sections];
  const stamp = `recon-${Date.now().toString(36)}`;

  const hasHero = out.some((s) => s.kind === "hero");
  const hasCta = out.some((s) => s.kind === "cta");
  const hasSubstantialContent = out.some((s) => s.kind === "content" && (s.bodyText?.length ?? 0) > 80);

  if (!hasHero) {
    notes.push("Reconstruction: injected hero from title/meta — not a clone of original layout.");
    out.unshift({
      id: `${stamp}-hero`,
      kind: "hero",
      heading: pickPrimaryHeadline(blueprint),
      bodyText: pickSubtitle(blueprint),
      confidence: 0.55,
    });
  }

  if (!hasSubstantialContent) {
    const body = [
      blueprint.metaDescription?.trim(),
      blueprint.ogTitle && blueprint.ogTitle !== blueprint.title ? `Also known as: ${blueprint.ogTitle}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();
    if (body.length > 20 || !hasSubstantialContent) {
      notes.push("Reconstruction: added intro section from meta and visible signals.");
      out.push({
        id: `${stamp}-intro`,
        kind: "content",
        heading: "Overview",
        bodyText: (body || pickSubtitle(blueprint)).slice(0, 12000),
        confidence: 0.48,
      });
    }
  }

  if (!hasCta) {
    const cta = pickCtaFromNav(blueprint.nav);
    if (cta) {
      notes.push("Reconstruction: primary CTA inferred from navigation.");
      out.push({
        id: `${stamp}-cta`,
        kind: "cta",
        linkHref: cta.href,
        linkLabel: cta.label,
        heading: cta.label,
        confidence: 0.45,
      });
    } else {
      notes.push("Reconstruction: default CTA — replace with your real conversion link.");
      out.push({
        id: `${stamp}-cta-fallback`,
        kind: "cta",
        linkHref: blueprint.sourceUrl.slice(0, 2000),
        linkLabel: "Visit source",
        heading: "Next step",
        confidence: 0.35,
      });
    }
  }

  return out.slice(0, 120);
}

function needsSemanticEnrichment(blueprint: ImportBlueprint, signals: SemanticSignals): boolean {
  if (blueprint.sections.length === 0) return true;
  if (signals.weakExtraction) return true;
  if (countHeroSections(blueprint.sections) === 0 && countCtaSections(blueprint.sections) === 0) return true;
  if ((signals.marketingStructureScore ?? 0) < 0.35) return true;
  return false;
}

/**
 * Enrich blueprint with MVP marketing structure and image ranking metadata.
 */
export function analyzeImportedBlueprint(blueprint: ImportBlueprint): ImportBlueprint {
  const sectionGroupsApprox = blueprint.sections.filter((s) => s.kind === "content").length;
  const ctaDensity = countCtaSections(blueprint.sections) + (blueprint.nav?.filter((n) => /contact|buy|sign|start|book/i.test(n.text)).length ?? 0);
  const imageClusterCount = blueprint.sections.filter((s) => s.kind === "media").length;
  const navP = navPattern(blueprint.nav);
  const weakExtraction =
    blueprint.sections.length === 0 ||
    avgConfidence(blueprint.sections) < 0.42 ||
    (blueprint.sections.length === 1 && (blueprint.sections[0]?.confidence ?? 0) < 0.4);

  const baseSignals: SemanticSignals = {
    sectionGroupsApprox,
    heroIntent: countHeroSections(blueprint.sections) > 0 || /\b(hero|banner|jumbotron)\b/i.test(JSON.stringify(blueprint.notes ?? [])),
    weakExtraction,
    navPattern: navP,
    ctaDensity,
    imageClusterCount,
    marketingStructureScore: 0,
  };
  baseSignals.marketingStructureScore = marketingStructureScore(blueprint, baseSignals);
  baseSignals.heroIntent = baseSignals.heroIntent || countHeroSections(blueprint.sections) > 0;

  const reconNotes: string[] = [...(blueprint.reconstruction?.notes ?? [])];
  let sections = [...blueprint.sections];
  let path: ReconstructionPath = "native";

  const heroBg = pickHeroBackgroundUrl(sections);
  let heroBackgroundImageUrl = blueprint.heroBackgroundImageUrl ?? heroBg;

  if (needsSemanticEnrichment({ ...blueprint, sections }, baseSignals)) {
    sections = injectMvpSections({ ...blueprint, sections }, reconNotes);
    path = weakExtraction ? "metadata_mvp" : "semantic_enriched";
    if (!heroBackgroundImageUrl) heroBackgroundImageUrl = pickHeroBackgroundUrl(sections);
  }

  // Re-rank: decorative images last (trim very end only if overcrowded)
  const nonDecorative = sections.filter((s) => !(s.kind === "media" && s.imageRole === "decorative"));
  const decorative = sections.filter((s) => s.kind === "media" && s.imageRole === "decorative");
  sections = [...nonDecorative, ...decorative].slice(0, 120);

  const merged: ImportBlueprint = {
    ...blueprint,
    sections,
    heroBackgroundImageUrl,
    reconstruction: {
      path,
      signals: {
        heroIntent: baseSignals.heroIntent,
        weakExtraction: baseSignals.weakExtraction,
        navPattern: baseSignals.navPattern,
        ctaDensity: baseSignals.ctaDensity,
        imageClusterCount: baseSignals.imageClusterCount,
        marketingStructureScore: baseSignals.marketingStructureScore,
      },
      notes: reconNotes.length ? reconNotes : undefined,
    },
  };

  logSiteImportStage("semantic_reconstruction", {
    path,
    sectionCount: merged.sections.length,
    weakExtraction,
    marketingStructureScore: baseSignals.marketingStructureScore,
    heroBackground: Boolean(heroBackgroundImageUrl),
  });

  return ImportBlueprintSchema.parse(merged);
}

/** Last-resort blocks if mapping ever yields zero (should not happen after reconstruction). */
export function reconstructHomeBlocksFromMetadata(blueprint: ImportBlueprint): ImportBlueprint["sections"] {
  const headline = pickPrimaryHeadline(blueprint);
  const sub = pickSubtitle(blueprint);
  const cta = pickCtaFromNav(blueprint.nav);
  return [
    {
      id: "invariant-hero",
      kind: "hero" as const,
      heading: headline,
      bodyText: sub,
      confidence: 0.4,
    },
    {
      id: "invariant-body",
      kind: "content" as const,
      heading: "Rebuild & redesign",
      bodyText: [
        sub,
        "",
        `Source URL: ${blueprint.sourceUrl}`,
        "",
        "Invariant repair: the importer could not map HTML sections — this MVP page is intentional so the preview is never empty.",
      ].join("\n"),
      confidence: 0.35,
    },
    {
      id: "invariant-cta",
      kind: "cta" as const,
      linkHref: cta?.href ?? blueprint.sourceUrl.slice(0, 2000),
      linkLabel: cta?.label ?? "Continue",
      heading: cta?.label ?? "Next step",
      confidence: 0.35,
    },
  ];
}
