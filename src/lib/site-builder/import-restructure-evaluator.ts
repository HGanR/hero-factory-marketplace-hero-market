/**
 * Deterministic import-site restructuring audit — advisory layer over blueprint + route families.
 * Reuses agency launch companion hints and Brand Brain scorecard when present (no network).
 */

import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { inferRouteFamilyFromPath } from "@/lib/site-builder/site-import/route-family";
import type {
  ImportModernizationProfile,
  ImportRestructureQueueItem,
  ImportedSiteAudit,
  ImportedSiteAuditOpportunity,
} from "@/lib/site-builder/import-restructure-schema";

export type ImportRestructureEvalContext = {
  siteTypeHint?: string;
};

function primaryHome(doc: SiteSchemaDocumentType): SiteSchemaDocumentType["pages"][number] | undefined {
  const slash = doc.pages.find((p) => p.slug === "/" || p.slug === "");
  return slash ?? doc.pages[0];
}

/** Stable id for this audit shape — avoids rewriting metadata every tick when the document is unchanged. */
function importAuditEvaluatedAtKey(doc: SiteSchemaDocumentType): string {
  const home = primaryHome(doc);
  const types = (home?.blocks ?? []).map((b) => b.type).join(",");
  const slugs = doc.pages.map((p) => p.slug).join(",");
  const bbProof = doc.metadata?.brandBrain?.scorecard?.proofBalance ?? "";
  const alComp = doc.metadata?.agencyLaunch?.companionPageSuggestions?.length ?? "";
  const raw = `${slugs}|${types}|bb:${bbProof}|al:${alComp}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h = Math.imul(h ^ raw.charCodeAt(i), 16777619);
  }
  return `v1:${(h >>> 0).toString(16)}`.slice(0, 80);
}

function blockBodyLen(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): number {
  const c = block.content as Record<string, unknown> | undefined;
  if (!c) return 0;
  const body = c.body ?? c.subtitle ?? "";
  return String(body).trim().length;
}

function inferProfile(doc: SiteSchemaDocumentType, siteTypeHint?: string): ImportModernizationProfile {
  const hint = (siteTypeHint ?? "").trim().toLowerCase();
  const partial = Boolean(doc.metadata?.siteImport?.partialImport);
  const stubPages = doc.pages.filter((p) =>
    p.blocks.some((b) => String((b.content as Record<string, unknown>)?.aiRegistryKey) === "import_route_stub"),
  ).length;
  if (hint === "local_business" || hint === "landing") return "redesign_offer_leadgen";
  if (hint === "portfolio" || hint === "trust_operator") return "editorial_cleanup";
  if (partial || stubPages >= 4) return "simplify_and_tighten";
  if (hint === "saas" || hint === "web3_product") return "preserve_message_improve_conversion";
  return "preserve_structure_modernize_visuals";
}

function opportunity(
  o: Omit<ImportedSiteAuditOpportunity, "scope"> & { scope?: ImportedSiteAuditOpportunity["scope"] },
): ImportedSiteAuditOpportunity {
  return {
    code: o.code,
    severity: o.severity,
    scope: o.scope ?? "site",
    route: o.route,
    recommendation: o.recommendation,
    fixability: o.fixability,
  };
}

const _queueMetaMap: Record<string, Pick<ImportRestructureQueueItem, "type" | "priority">> = {
  import_hero_flat: { type: "content_focus", priority: "high" },
  import_cta_late: { type: "conversion_fix", priority: "high" },
  import_proof_late: { type: "conversion_fix", priority: "medium" },
  import_section_churn: { type: "structure_fix", priority: "medium" },
  import_missing_offer_page: { type: "page_addition", priority: "high" },
  import_missing_faq_page: { type: "page_addition", priority: "medium" },
  import_missing_contact_page: { type: "page_addition", priority: "high" },
  import_nav_dense: { type: "structure_fix", priority: "low" },
  import_route_stubs_heavy: { type: "structure_fix", priority: "medium" },
  import_visual_import_legacy: { type: "design_alignment", priority: "medium" },
  import_revenue_route_gap: { type: "page_addition", priority: "medium" },
};

/** Map audit codes → queue typing + default priority. */
export function importOpportunityQueueMeta(code: string): Pick<ImportRestructureQueueItem, "type" | "priority"> {
  return _queueMetaMap[code] ?? { type: "structure_fix", priority: "medium" };
}

export const IMPORT_RESTRUCTURE_CONSULTANT_LINES: Record<string, string> = {
  import_hero_flat: "I can modernize this hero without changing your core message.",
  import_cta_late: "This imported homepage needs a stronger next step—I can add a clearer CTA path.",
  import_proof_late: "I can move proof earlier so visitors trust you before the fold of long copy.",
  import_section_churn: "I can tighten a busy homepage into clearer sections without losing content.",
  import_missing_offer_page: "I can turn generic services copy into a clearer offer page.",
  import_missing_faq_page: "This site would benefit from a dedicated FAQ—want a starter page?",
  import_missing_contact_page: "A focused contact/booking route would strengthen conversion.",
  import_nav_dense: "I can simplify imported navigation so the story stays clear.",
  import_route_stubs_heavy: "Several imported routes are placeholders—I can align stubs to your real funnel.",
  import_visual_import_legacy: "I can align imported visuals to your design system tokens.",
  import_revenue_route_gap: "Your launch plan flags a missing companion page—I can add a focused stub to refine.",
};

export function evaluateImportedSiteRestructure(
  doc: SiteSchemaDocumentType,
  ctx?: ImportRestructureEvalContext,
): ImportedSiteAudit {
  const profile = inferProfile(doc, ctx?.siteTypeHint);
  const opportunities: ImportedSiteAuditOpportunity[] = [];
  const home = primaryHome(doc);
  const blocks = home?.blocks ?? [];
  const stubPagesCount = doc.pages.filter((p) =>
    p.blocks.some((b) => String((b.content as Record<string, unknown>)?.aiRegistryKey) === "import_route_stub"),
  ).length;
  const multiPageSignals = doc.pages.length >= 2 || stubPagesCount >= 1;

  const heroIdx = blocks.findIndex((b) => b.type === "hero");
  const hero = heroIdx >= 0 ? blocks[heroIdx]! : null;
  const titleLen = String((hero?.content as Record<string, unknown>)?.title ?? "").trim().length;
  const subLen = String((hero?.content as Record<string, unknown>)?.subtitle ?? "").trim().length;
  const vis = (hero?.content as Record<string, unknown>)?.visual as Record<string, unknown> | undefined;
  const grad = String(vis?.gradient ?? "");
  const heroFlat =
    !hero ||
    (titleLen < 12 && subLen < 20) ||
    (subLen < 12 && titleLen < 40) ||
    /import|135deg.*0f172a/i.test(grad);

  if (heroFlat) {
    opportunities.push(
      opportunity({
        code: "import_hero_flat",
        severity: "warn",
        scope: "route",
        route: "/",
        recommendation:
          "Hero reads like a lifted blueprint: strengthen hierarchy, subtitle support, and token-aware styling while preserving the headline intent.",
        fixability: "guided_apply",
      }),
    );
  }

  let firstCtaIdx = -1;
  for (let i = 0; i < blocks.length; i++) {
    const t = blocks[i]!.type;
    if (t === "button" || t === "call_to_action") {
      firstCtaIdx = i;
      break;
    }
  }
  if (firstCtaIdx < 0 || firstCtaIdx > 6) {
    opportunities.push(
      opportunity({
        code: "import_cta_late",
        severity: "warn",
        scope: "route",
        route: "/",
        recommendation:
          "Primary action is missing or buried deep—add or surface a single high-contrast next step earlier in the story.",
        fixability: firstCtaIdx < 0 ? "guided_apply" : "structural",
      }),
    );
  }

  let firstProofIdx = -1;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.type === "stat_band") {
      firstProofIdx = i;
      break;
    }
    if (b.type === "list" && (b.items?.length ?? 0) >= 4) {
      firstProofIdx = i;
      break;
    }
    if (b.type === "section") {
      const ttl = String((b.content as Record<string, unknown>)?.title ?? "").toLowerCase();
      if (/\b(client|logo|trusted|testimonial|case)\b/.test(ttl)) {
        firstProofIdx = i;
        break;
      }
    }
  }
  const sectionCount = blocks.filter((b) => b.type === "section").length;
  if ((firstProofIdx > 7 || firstProofIdx < 0) && sectionCount >= 4) {
    opportunities.push(
      opportunity({
        code: "import_proof_late",
        severity: "info",
        scope: "route",
        route: "/",
        recommendation: "Trust or proof signals appear late or not at all—moving proof earlier supports conversion.",
        fixability: "structural",
      }),
    );
  }

  const thinSections = blocks.filter(
    (b) => b.type === "section" && blockBodyLen(b) > 0 && blockBodyLen(b) < 140,
  ).length;
  if (thinSections >= 4 || sectionCount >= 9) {
    opportunities.push(
      opportunity({
        code: "import_section_churn",
        severity: "info",
        scope: "route",
        route: "/",
        recommendation:
          "Many short sections create choppy hierarchy—merge or sequence into clearer chapters with breathing room.",
        fixability: "structural",
      }),
    );
  }

  const routeFamilies = new Set(doc.pages.map((p) => inferRouteFamilyFromPath(p.slug)));
  if (!routeFamilies.has("services") && !routeFamilies.has("faq")) {
    const hasServicesCopy = blocks.some(
      (b) =>
        b.type === "section" &&
        /\b(service|solution|what we do|offer|program)\b/i.test(
          String((b.content as Record<string, unknown>)?.title ?? "") +
            String((b.content as Record<string, unknown>)?.body ?? ""),
        ),
    );
    if (hasServicesCopy) {
      opportunities.push(
        opportunity({
          code: "import_missing_offer_page",
          severity: "info",
          scope: "site",
          recommendation:
            "Services language lives on the homepage without a dedicated offer/services route—add a page to sharpen the pitch.",
          fixability: "structural",
        }),
      );
    }
  }
  if (!routeFamilies.has("faq") && multiPageSignals && sectionCount >= 4) {
    opportunities.push(
      opportunity({
        code: "import_missing_faq_page",
        severity: "info",
        scope: "site",
        recommendation: "No FAQ route detected—add a lightweight FAQ page to handle objections and support.",
        fixability: "structural",
      }),
    );
  }
  if (!routeFamilies.has("contact") && multiPageSignals && firstCtaIdx >= 0) {
    opportunities.push(
      opportunity({
        code: "import_missing_contact_page",
        severity: "warn",
        scope: "site",
        recommendation: "No clear contact/booking route—add a focused page so the CTA has a destination.",
        fixability: "structural",
      }),
    );
  }

  const footer = blocks.find((b) => b.type === "footer");
  if (footer) {
    const body = String((footer.content as Record<string, unknown>)?.body ?? "");
    const lineCount = body.split("\n").filter((l) => l.trim().length > 0).length;
    if (lineCount > 14 || (body.match(/•/g) ?? []).length > 12) {
      opportunities.push(
        opportunity({
          code: "import_nav_dense",
          severity: "info",
          scope: "route",
          route: "/",
          recommendation: "Footer/navigation mirror is verbose—trim duplicate links and group into fewer destinations.",
          fixability: "safe_auto",
        }),
      );
    }
  }

  const stubCount = doc.pages.filter((p) =>
    p.blocks.some((b) => String((b.content as Record<string, unknown>)?.aiRegistryKey) === "import_route_stub"),
  ).length;
  if (stubCount >= 3) {
    opportunities.push(
      opportunity({
        code: "import_route_stubs_heavy",
        severity: "info",
        scope: "site",
        recommendation:
          "Multiple routes are import placeholders—prioritize the few that match your funnel and consolidate the rest.",
        fixability: "guided_apply",
      }),
    );
  }

  if (
    !heroFlat &&
    doc.metadata?.theme?.name === "imported-blueprint" &&
    doc.metadata?.designSystem
  ) {
    opportunities.push(
      opportunity({
        code: "import_visual_import_legacy",
        severity: "info",
        scope: "site",
        recommendation:
          "Imported styling can be aligned to the builder design system for consistent spacing, type, and motion.",
        fixability: "safe_auto",
      }),
    );
  }

  const bb = doc.metadata?.brandBrain;
  if (bb && bb.scorecard.proofBalance < 45) {
    if (!opportunities.some((o) => o.code === "import_proof_late")) {
      opportunities.push(
        opportunity({
          code: "import_proof_late",
          severity: "warn",
          scope: "route",
          route: "/",
          recommendation: "Brand Brain signals weak proof balance—surface credibility earlier on the homepage.",
          fixability: "structural",
        }),
      );
    }
  }

  const companions = doc.metadata?.agencyLaunch?.companionPageSuggestions ?? [];
  const topCompanion = companions.find((c) => c.priority === "high") ?? companions[0];
  if (topCompanion) {
    opportunities.push(
      opportunity({
        code: "import_revenue_route_gap",
        severity: "warn",
        scope: "site",
        recommendation: topCompanion.rationale.slice(0, 500) || "Launch readiness suggests adding a companion page.",
        fixability: "structural",
      }),
    );
  }

  const profileHint =
    profile === "redesign_offer_leadgen"
      ? "Prioritize offer clarity and CTA paths while keeping your core message."
      : profile === "editorial_cleanup"
        ? "Favor whitespace, typographic hierarchy, and a calmer section rhythm."
        : profile === "simplify_and_tighten"
          ? "Reduce duplicate routes and tighten navigation to the few pages that matter."
          : profile === "preserve_message_improve_conversion"
            ? "Keep positioning copy; strengthen proof placement and next steps."
            : "Modernize visuals and tokens without rewriting your story.";

  const summaryParts = [
    `Imported blueprint audit (${opportunities.length} focus areas).`,
    profileHint,
  ];
  if (doc.metadata?.siteImport?.partialImport) {
    summaryParts.push("Partial import: verify media and gated content manually.");
  }

  return {
    summary: summaryParts.join(" "),
    modernizationProfile: profile,
    evaluatedAt: importAuditEvaluatedAtKey(doc),
    opportunities: opportunities.slice(0, 24),
  };
}
