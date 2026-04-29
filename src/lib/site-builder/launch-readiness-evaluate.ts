/**
 * Deterministic launch-readiness evaluation — schema + Brand Brain + conversion path.
 */

import type { BrandBrainState } from "@/lib/site-builder/brand-brain-schema";
import type {
  CompanionPageSuggestion,
  LaunchCheck,
  LaunchReadiness,
} from "@/lib/site-builder/agency-launch-schema";
import type { ConversionPathAnalysis } from "@/lib/site-builder/conversion-path";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function blockContent(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): Record<string, unknown> {
  const raw = block.content;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function headlineWeak(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 8) return true;
  if (/^(welcome|hello|hi|untitled|new site)/i.test(t)) return true;
  return false;
}

function genericCtaLabel(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "click here" || t === "learn more" || t === "submit" || t === "go" || t.length < 3;
}

export function suggestCompanionPages(
  doc: SiteSchemaDocumentType,
  path: ConversionPathAnalysis,
): CompanionPageSuggestion[] {
  const out: CompanionPageSuggestion[] = [];
  const slugs = doc.pages.map((p) => p.slug);
  const slugStr = slugs.join(" ");

  if (!path.hasContactLikeRoute && path.homeHasConversionSurface && doc.pages.length >= 1) {
    out.push({
      code: "companion_contact",
      suggestedSlug: "/contact",
      priority: "high",
      rationale: "A dedicated contact or book route gives a clear trust endpoint from primary CTAs.",
    });
  }

  if (!/\/about/i.test(slugStr) && doc.pages.length >= 2 && path.multiPage) {
    out.push({
      code: "companion_about",
      suggestedSlug: "/about",
      priority: "low",
      rationale: "Differentiation improves when story pages separate from the primary conversion path.",
    });
  }

  if (!/faq|help/i.test(slugStr) && (path.distinctCtaLabels >= 2 || !path.homeHasProof)) {
    out.push({
      code: "companion_faq",
      suggestedSlug: "/faq",
      priority: "medium",
      rationale: "FAQ or proof support answers objections before the final CTA.",
    });
  }

  if (doc.pages.length === 1 && doc.pages[0]!.blocks.length >= 7 && !path.hasOfferLikeRoute) {
    out.push({
      code: "companion_offer_variant",
      suggestedSlug: "/offer",
      priority: "medium",
      rationale: "A focused offer or waitlist page can carry conversion without bloating the home narrative.",
    });
  }

  out.sort((a, b) => {
    const p = (x: CompanionPageSuggestion) => (x.priority === "high" ? 0 : x.priority === "medium" ? 1 : 2);
    return p(a) - p(b) || a.code.localeCompare(b.code);
  });
  return out.slice(0, 8);
}

export function evaluateLaunchReadiness(
  doc: SiteSchemaDocumentType,
  path: ConversionPathAnalysis,
  brandBrain?: BrandBrainState | null,
): { readiness: LaunchReadiness; checks: LaunchCheck[] } {
  const checks: LaunchCheck[] = [];

  for (const issue of path.issues) {
    checks.push({
      code: issue.code,
      severity: issue.severity,
      scope: issue.scope,
      route: issue.route,
      recommendation: issue.recommendation,
    });
  }

  const home = doc.pages.find((p) => p.slug === "/") ?? doc.pages[0];
  if (home) {
    const hero = home.blocks.find((b) => String(b.type) === "hero");
    if (hero) {
      const title = String(blockContent(hero).title || "").trim();
      if (headlineWeak(title)) {
        checks.push({
          code: "headline_weak_home",
          severity: "warn",
          scope: "route",
          route: "/",
          recommendation: "Hero headline reads generic or thin — tighten promise and outcome before launch.",
        });
      }
    }
    const ctas = home.blocks.filter((b) => String(b.type) === "call_to_action");
    for (const c of ctas) {
      const lab = String(blockContent(c).label || blockContent(c).headline || "").trim();
      if (lab && genericCtaLabel(lab)) {
        checks.push({
          code: "cta_label_generic",
          severity: "info",
          scope: "section",
          route: "/",
          sectionId: String(blockContent(c).aiSectionId || ""),
          recommendation: "CTA label is placeholder-level — swap for a specific action visitors understand.",
        });
        break;
      }
    }
  }

  if (path.multiPage) {
    const lens = doc.pages.map((p) => p.blocks.length);
    const spread = Math.max(...lens) - Math.min(...lens);
    if (spread >= 6) {
      checks.push({
        code: "page_differentiation_weak",
        severity: "info",
        scope: "site",
        recommendation: "Routes differ a lot in depth — align hero/CTA roles so each page has a clear job.",
      });
    }
  }

  if (!path.hasOfferLikeRoute && path.homeHasConversionSurface && doc.pages.length >= 2) {
    checks.push({
      code: "offer_capture_cue_missing",
      severity: "info",
      scope: "site",
      recommendation: "Consider an offer, pricing, or signup route so conversion isn’t only on home.",
    });
  }

  if (brandBrain?.findings?.length) {
    for (const f of brandBrain.findings) {
      if (f.code === "narrative_weak_cta_placement" || f.code === "proof_underuse_home") {
        checks.push({
          code: `launch_brand_${f.code}`,
          severity: f.severity,
          scope: f.scope,
          route: f.route,
          sectionId: f.sectionId,
          recommendation: f.recommendation,
        });
      }
    }
  }

  const metaTitle = String(doc.metadata?.title || "").trim();
  if (!metaTitle || metaTitle.length < 3) {
    checks.push({
      code: "metadata_title_missing",
      severity: "warn",
      scope: "site",
      recommendation: "Site title metadata is empty — set a concise name for handoff and SEO context.",
    });
  }

  const dedup = new Map<string, LaunchCheck>();
  for (const c of checks) {
    const key = `${c.code}|${c.route ?? ""}|${c.sectionId ?? ""}`;
    if (!dedup.has(key)) dedup.set(key, c);
  }
  let finalChecks = [...dedup.values()];

  if (finalChecks.filter((c) => c.severity === "warn").length >= 2) {
    finalChecks.push({
      code: "export_ready_launch_support_gap",
      severity: "info",
      scope: "site",
      recommendation: "Export can ship, but launch narrative and conversion path still need tightening.",
    });
  }

  finalChecks.sort((a, b) => {
    const s = (x: LaunchCheck) => (x.severity === "warn" ? 0 : 1);
    const d = s(a) - s(b);
    if (d !== 0) return d;
    return a.code.localeCompare(b.code);
  });

  const warn = finalChecks.filter((c) => c.severity === "warn").length;
  const info = finalChecks.filter((c) => c.severity === "info").length;
  let readiness: LaunchReadiness;
  if (warn >= 3) readiness = "draft";
  else if (warn >= 1 || info >= 6) readiness = "needs_attention";
  else if (warn === 0 && info <= 2) readiness = "launch_ready";
  else readiness = "needs_attention";

  return { readiness, checks: finalChecks };
}
