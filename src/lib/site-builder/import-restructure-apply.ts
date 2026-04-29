/**
 * Guided apply for import restructuring opportunities — uses layout heuristic + token passes; preserves widget/import metadata.
 */

import { applyLayoutRestructureHeuristic } from "@/lib/site-builder/ai/layout-restructure-heuristic";
import {
  applyTroothertzVisualPostProcessToDocument,
  styleModeFromSiteDocument,
} from "@/lib/site-builder/ai/troothertz-visual-postprocess";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { inferRouteFamilyFromPath } from "@/lib/site-builder/site-import/route-family";
import type { ImportRestructureQueueItem } from "@/lib/site-builder/import-restructure-schema";

function primaryPageIndex(doc: SiteSchemaDocumentType): number {
  const i = doc.pages.findIndex((p) => p.slug === "/" || p.slug === "");
  return i >= 0 ? i : 0;
}

function ensureStubPage(doc: SiteSchemaDocumentType, slug: string, title: string, body: string): boolean {
  const norm = slug.startsWith("/") ? slug : `/${slug}`;
  if (doc.pages.some((p) => p.slug === norm)) return false;
  doc.pages.push({
    slug: norm,
    blocks: [
      {
        type: "paragraph",
        content: {
          aiSectionId: `import-stub-${norm.replace(/\W+/g, "-")}`,
          aiRegistryKey: "import_route_stub",
          body: `${title}\n\n${body}`,
        },
      },
    ],
  });
  if (doc.metadata?.siteImport) {
    const qr = doc.metadata.siteImport.queuedRoutes ?? [];
    if (!qr.includes(norm)) {
      doc.metadata.siteImport.queuedRoutes = [...qr, norm].slice(0, 30);
    }
    doc.metadata.siteImport.detectedPageCount = doc.pages.length;
  }
  return true;
}

function trimFooterNav(doc: SiteSchemaDocumentType, pageIdx: number): boolean {
  const blocks = doc.pages[pageIdx]?.blocks;
  if (!blocks) return false;
  const fi = blocks.findIndex((b) => b.type === "footer");
  if (fi < 0) return false;
  const f = blocks[fi]!;
  const c = f.content as Record<string, unknown>;
  const body = String(c.body ?? "");
  const lines = body.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length <= 10) return false;
  c.body = ["Imported navigation (trimmed for clarity):", "", ...lines.slice(0, 10)].join("\n");
  return true;
}

function insertCtaAfterHero(doc: SiteSchemaDocumentType, pageIdx: number): boolean {
  const page = doc.pages[pageIdx]!;
  const blocks = [...page.blocks];
  const heroIdx = blocks.findIndex((b) => b.type === "hero");
  if (heroIdx < 0) return false;
  const hasCta = blocks.some((b) => b.type === "call_to_action" || b.type === "button");
  if (hasCta) return false;
  const id = `import-cta-${Date.now().toString(36)}`;
  const insert: SiteSchemaDocumentType["pages"][number]["blocks"][number] = {
    type: "call_to_action",
    content: {
      title: "Ready for the next step?",
      body: "Keep your core message—add a single clear action visitors can take today.",
      label: "Get started",
      href: "#contact",
      aiSectionId: id,
      aiRegistryKey: "import_lift_cta",
      visual: { elevated: true },
    },
  };
  blocks.splice(heroIdx + 1, 0, insert);
  page.blocks = blocks;
  return true;
}

function modernizeHeroTokens(doc: SiteSchemaDocumentType, pageIdx: number): boolean {
  const page = doc.pages[pageIdx]!;
  const heroIdx = page.blocks.findIndex((b) => b.type === "hero");
  if (heroIdx < 0) return false;
  const hero = page.blocks[heroIdx]!;
  const c = (hero.content = (hero.content ?? {}) as Record<string, unknown>);
  const vis = { ...((c.visual as Record<string, unknown>) ?? {}) };
  const accent =
    String(vis.accent ?? doc.metadata?.designSystem?.colors?.accent ?? doc.metadata?.theme?.gradientStart ?? "#22d3ee").slice(
      0,
      80,
    );
  vis.accent = accent;
  vis.gridOverlay = Math.max(Number(vis.gridOverlay) || 0, 0.07);
  if (!vis.gradient || /135deg.*0f172a/i.test(String(vis.gradient))) {
    const g0 = String(doc.metadata?.theme?.gradientStart ?? "#0f172a").slice(0, 40);
    const g1 = String(doc.metadata?.theme?.gradientEnd ?? "#1e293b").slice(0, 40);
    vis.gradient = `linear-gradient(135deg, ${g0} 0%, ${g1} 52%, ${g0} 100%)`;
  }
  c.visual = vis;
  return true;
}

function insertMidVisualBreak(doc: SiteSchemaDocumentType, pageIdx: number): boolean {
  const page = doc.pages[pageIdx]!;
  const blocks = page.blocks;
  if (blocks.length < 6) return false;
  const mid = Math.floor(blocks.length / 2);
  if (blocks[mid]?.type === "visual_break") return false;
  const id = `import-break-${Date.now().toString(36)}`;
  const vb: SiteSchemaDocumentType["pages"][number]["blocks"][number] = {
    type: "visual_break",
    content: {
      aiSectionId: id,
      aiRegistryKey: "import_section_break",
      variant: "spacer",
    },
  };
  const next = [...blocks];
  next.splice(mid, 0, vb);
  page.blocks = next;
  return true;
}

export function markImportRestructureQueueStatus(
  doc: SiteSchemaDocumentType,
  opportunityCode: string,
  status: ImportRestructureQueueItem["status"],
): void {
  if (!doc.metadata?.importRestructureQueue) return;
  doc.metadata.importRestructureQueue = doc.metadata.importRestructureQueue.map((q) =>
    q.opportunityCode === opportunityCode ? { ...q, status } : q,
  );
}

export function applyImportRestructureOpportunity(
  doc: SiteSchemaDocumentType,
  opportunityCode: string,
): { doc: SiteSchemaDocumentType; applied: boolean; kind: string } {
  const pageIdx = primaryPageIndex(doc);
  let applied = false;
  let kind = "noop";

  const widgetBackup = doc.metadata?.widgetIntegration;
  const importBackup = doc.metadata?.siteImport;

  switch (opportunityCode) {
    case "import_hero_flat": {
      const heroTouch = modernizeHeroTokens(doc, pageIdx);
      const sm = styleModeFromSiteDocument(doc);
      applyTroothertzVisualPostProcessToDocument(doc, sm);
      applied = true;
      kind = heroTouch ? "hero_token_upgrade" : "troothertz_pass";
      break;
    }
    case "import_cta_late": {
      const page = doc.pages[pageIdx]!;
      const hasCta = page.blocks.some((b) => b.type === "call_to_action" || b.type === "button");
      if (!hasCta) {
        if (insertCtaAfterHero(doc, pageIdx)) {
          applied = true;
          kind = "cta_inserted";
          break;
        }
      }
      const r = applyLayoutRestructureHeuristic(doc, "put cta right after hero", [], pageIdx);
      if (r.applied) {
        applied = true;
        kind = r.kind ?? "cta_resequence";
      }
      break;
    }
    case "import_proof_late": {
      const r = applyLayoutRestructureHeuristic(doc, "move proof higher", [], pageIdx);
      if (r.applied) {
        applied = true;
        kind = r.kind ?? "proof_resequence";
      }
      break;
    }
    case "import_section_churn": {
      if (insertMidVisualBreak(doc, pageIdx)) {
        applied = true;
        kind = "visual_break_inserted";
      }
      break;
    }
    case "import_nav_dense": {
      if (trimFooterNav(doc, pageIdx)) {
        applied = true;
        kind = "footer_trimmed";
      }
      break;
    }
    case "import_visual_import_legacy": {
      const sm = styleModeFromSiteDocument(doc);
      applyTroothertzVisualPostProcessToDocument(doc, sm);
      applied = true;
      kind = "troothertz_pass";
      break;
    }
    case "import_missing_offer_page": {
      if (
        ensureStubPage(
          doc,
          "/offer",
          "Offer & services",
          "Starter page from import restructuring—replace with your real offer narrative and proof.",
        )
      ) {
        applied = true;
        kind = "page_offer_stub";
      }
      break;
    }
    case "import_missing_faq_page": {
      if (
        ensureStubPage(
          doc,
          "/faq",
          "FAQ",
          "Starter FAQ from import restructuring—add the questions your prospects actually ask.",
        )
      ) {
        applied = true;
        kind = "page_faq_stub";
      }
      break;
    }
    case "import_missing_contact_page": {
      if (
        ensureStubPage(
          doc,
          "/contact",
          "Contact",
          "Starter contact page—add your preferred booking link, form embed, or calendar.",
        )
      ) {
        applied = true;
        kind = "page_contact_stub";
      }
      break;
    }
    case "import_revenue_route_gap": {
      const sug = doc.metadata?.agencyLaunch?.companionPageSuggestions?.find((c) => c.priority === "high") ??
        doc.metadata?.agencyLaunch?.companionPageSuggestions?.[0];
      const slug = sug?.suggestedSlug?.trim() || "/resources";
      const label = slug.replace(/^\//, "") || "page";
      if (ensureStubPage(doc, slug, label, sug?.rationale?.slice(0, 400) || "Companion page suggested from launch readiness—refine copy here.")) {
        applied = true;
        kind = "page_companion_stub";
      }
      break;
    }
    case "import_route_stubs_heavy": {
      if (insertMidVisualBreak(doc, pageIdx)) {
        applied = true;
        kind = "visual_break_for_stubs";
      }
      break;
    }
    default:
      break;
  }

  if (widgetBackup) doc.metadata!.widgetIntegration = widgetBackup;
  if (importBackup) doc.metadata!.siteImport = importBackup;

  if (applied) {
    markImportRestructureQueueStatus(doc, opportunityCode, "applied");
  }

  const parsed = SiteSchemaDocument.parse(doc);
  return { doc: parsed, applied, kind };
}

/** Pick top open suggestions for Refine UI (deterministic). */
export function pickImportRestructureSuggestionsForUi(
  doc: SiteSchemaDocumentType,
  limit = 4,
): ImportRestructureQueueItem[] {
  if (!doc.metadata?.siteImport || !doc.metadata.importRestructureQueue?.length) return [];
  const pri = { high: 0, medium: 1, low: 2 } as const;
  const open = doc.metadata.importRestructureQueue.filter((q) => q.status === "suggested" || q.status === "accepted");
  return [...open]
    .sort((a, b) => pri[a.priority] - pri[b.priority] || a.opportunityCode.localeCompare(b.opportunityCode))
    .slice(0, limit);
}

/** Route-family coverage for tests / analytics (no PII). */
export function importRouteFamilySummary(doc: SiteSchemaDocumentType): string {
  const fams = [...new Set(doc.pages.map((p) => inferRouteFamilyFromPath(p.slug)))].sort().join(",");
  return fams.slice(0, 120);
}
