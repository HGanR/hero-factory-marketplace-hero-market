/**
 * Merge fresh audit into schema metadata and reconcile the import restructuring queue.
 */

import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import {
  evaluateImportedSiteRestructure,
  importOpportunityQueueMeta,
  IMPORT_RESTRUCTURE_CONSULTANT_LINES,
} from "@/lib/site-builder/import-restructure-evaluator";
import type { ImportRestructureQueueItem, ImportedSiteAudit } from "@/lib/site-builder/import-restructure-schema";

function queueScopeFromAudit(scope: ImportedSiteAudit["opportunities"][number]["scope"]): ImportRestructureQueueItem["scope"] {
  return scope === "route" ? "route" : "site";
}

function derivedSourcesForCode(code: string): string[] {
  if (code === "import_revenue_route_gap") return ["site_import", "revenue_readiness"];
  if (code === "import_proof_late") return ["site_import", "brand_brain"];
  return ["site_import"];
}

export function buildQueueItemFromOpportunity(
  o: ImportedSiteAudit["opportunities"][number],
  _audit: ImportedSiteAudit,
): ImportRestructureQueueItem {
  const meta = importOpportunityQueueMeta(o.code);
  return {
    id: `import-opp-${o.code}`,
    opportunityCode: o.code,
    type: meta.type,
    priority: meta.priority,
    scope: queueScopeFromAudit(o.scope),
    status: "suggested",
    derivedFrom: derivedSourcesForCode(o.code),
    recommendation: o.recommendation,
    consultantLine: IMPORT_RESTRUCTURE_CONSULTANT_LINES[o.code] ?? o.recommendation.slice(0, 200),
    route: o.route,
  };
}

/** Updates `metadata.importedSiteAudit` and reconciles `metadata.importRestructureQueue`. Returns whether JSON changed. */
export function syncImportRestructureIntoDocument(
  doc: SiteSchemaDocumentType,
  opts?: { siteTypeHint?: string },
): { doc: SiteSchemaDocumentType; changed: boolean } {
  if (!doc.metadata?.siteImport) return { doc, changed: false };

  const prevSnap = JSON.stringify({
    audit: doc.metadata.importedSiteAudit,
    queue: doc.metadata.importRestructureQueue,
  });

  const audit = evaluateImportedSiteRestructure(doc, { siteTypeHint: opts?.siteTypeHint });
  const codesInAudit = new Set(audit.opportunities.map((x) => x.code));

  doc.metadata.importedSiteAudit = audit;

  const existing = doc.metadata.importRestructureQueue ?? [];
  const byCode = new Map(existing.map((q) => [q.opportunityCode, q]));
  const next: ImportRestructureQueueItem[] = [];

  for (const q of existing) {
    if (q.status === "applied" || q.status === "dismissed") {
      next.push(q);
      continue;
    }
    if (q.status === "accepted") {
      if (codesInAudit.has(q.opportunityCode)) next.push(q);
      continue;
    }
    if (codesInAudit.has(q.opportunityCode)) next.push(q);
  }

  for (const o of audit.opportunities) {
    if (!byCode.has(o.code) && !next.some((q) => q.opportunityCode === o.code)) {
      next.push(buildQueueItemFromOpportunity(o, audit));
    }
  }

  doc.metadata.importRestructureQueue = next.slice(0, 48);

  const afterSnap = JSON.stringify({
    audit: doc.metadata.importedSiteAudit,
    queue: doc.metadata.importRestructureQueue,
  });

  const changed = prevSnap !== afterSnap;
  const parsed = SiteSchemaDocument.parse(doc);
  return { doc: parsed, changed };
}
