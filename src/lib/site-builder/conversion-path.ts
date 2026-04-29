/**
 * Lightweight conversion-path coherence — schema/content only (not traffic analytics).
 */

import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { ConversionPathIssue } from "@/lib/site-builder/agency-launch-schema";

function blockContent(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): Record<string, unknown> {
  const raw = block.content;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function isProofBlock(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): boolean {
  const t = String(block.type);
  if (t === "stat_band") return true;
  if (t === "image_grid") return true;
  if (t === "list") return String(blockContent(block).variant || "") === "trust_strip";
  return false;
}

function hasConversionSurface(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): boolean {
  const t = String(block.type);
  if (t === "call_to_action") return true;
  if (t === "footer") return true;
  if (t === "button" && String(block.href || blockContent(block).href || "").trim()) return true;
  if (t === "big_link" || t === "internal_big_link") return true;
  return false;
}

function collectInternalTargets(
  blocks: SiteSchemaDocumentType["pages"][number]["blocks"],
): Set<string> {
  const out = new Set<string>();
  for (const block of blocks) {
    const c = blockContent(block);
    const href = String(block.href || c.href || c.url || "").trim();
    if (!href.startsWith("/")) continue;
    const path = href.split(/[?#]/)[0] ?? href;
    if (path && path !== "/") out.add(path);
  }
  return out;
}

function ctaLabelSample(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  const c = blockContent(block);
  const label = String(c.label || c.headline || c.title || c.primaryLabel || "").trim().toLowerCase();
  return label.slice(0, 80);
}

export type ConversionPathAnalysis = {
  issues: ConversionPathIssue[];
  homeHasProof: boolean;
  homeHasConversionSurface: boolean;
  hasContactLikeRoute: boolean;
  hasOfferLikeRoute: boolean;
  multiPage: boolean;
  deadEndRoutes: string[];
  distinctCtaLabels: number;
};

export function analyzeConversionPath(doc: SiteSchemaDocumentType): ConversionPathAnalysis {
  const issues: ConversionPathIssue[] = [];
  const slugs = new Set(doc.pages.map((p) => p.slug));
  const multiPage = doc.pages.length > 1;

  const contactLike = (s: string) => /contact|book|demo|get-?in-?touch|schedule|call/i.test(s);
  const offerLike = (s: string) => /offer|pricing|plans|buy|signup|waitlist|join/i.test(s);

  let hasContactLikeRoute = false;
  let hasOfferLikeRoute = false;
  for (const s of slugs) {
    if (contactLike(s)) hasContactLikeRoute = true;
    if (offerLike(s)) hasOfferLikeRoute = true;
  }

  const home = doc.pages.find((p) => p.slug === "/") ?? doc.pages[0];
  const homeBlocks = home?.blocks ?? [];
  const homeHasProof = homeBlocks.some(isProofBlock);
  const homeHasConversionSurface = homeBlocks.some(hasConversionSurface);

  const labels = new Set<string>();
  for (const page of doc.pages) {
    for (const b of page.blocks) {
      if (String(b.type) === "call_to_action" || String(b.type) === "hero") {
        const lab = ctaLabelSample(b);
        if (lab) labels.add(lab);
      }
    }
  }

  if (!homeHasConversionSurface) {
    issues.push({
      code: "cta_path_weak",
      severity: "warn",
      scope: "route",
      route: "/",
      recommendation: "Home has no obvious conversion surface (CTA, footer action, or primary link) — add a clear next step.",
    });
  }

  if (multiPage && !hasContactLikeRoute && homeHasConversionSurface) {
    issues.push({
      code: "conversion_no_contact_route",
      severity: "info",
      scope: "site",
      recommendation: "Multiple routes exist but none look like contact/book — visitors may lack a dedicated trust path.",
    });
  }

  if (!homeHasProof && homeBlocks.length >= 4) {
    issues.push({
      code: "conversion_proof_home_weak",
      severity: "info",
      scope: "route",
      route: "/",
      recommendation: "Home story runs long without a proof moment — a metrics strip or trust line would support conversion.",
    });
  }

  if (labels.size >= 4) {
    issues.push({
      code: "conversion_cta_label_divergent",
      severity: "info",
      scope: "site",
      recommendation: "Many distinct CTA phrases appear — consider harmonizing the primary action story.",
    });
  }

  const deadEndRoutes: string[] = [];
  for (const page of doc.pages) {
    const targets = collectInternalTargets(page.blocks);
    const hasOut = targets.size > 0;
    const localCta = page.blocks.some(hasConversionSurface);
    if (!hasOut && !localCta && page.blocks.length >= 2) {
      deadEndRoutes.push(page.slug);
    }
  }
  for (const slug of deadEndRoutes.slice(0, 3)) {
    issues.push({
      code: "conversion_dead_end_route",
      severity: "info",
      scope: "route",
      route: slug,
      recommendation: "This route ends without an internal next step or CTA — bridge to contact, offer, or home.",
    });
  }

  return {
    issues,
    homeHasProof,
    homeHasConversionSurface,
    hasContactLikeRoute,
    hasOfferLikeRoute,
    multiPage,
    deadEndRoutes,
    distinctCtaLabels: labels.size,
  };
}
