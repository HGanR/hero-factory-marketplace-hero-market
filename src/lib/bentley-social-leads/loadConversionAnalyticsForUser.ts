/**
 * Shared loader for conversion analytics (Phase 4E/F) — single query + summary + hints.
 */

import { and, desc, eq, gte, lte } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { bentleyTrackedLeads } from "@/lib/db/schema.bentley-social-leads";
import { computeConversionSummary, type TrackedLeadForAnalytics } from "@/lib/bentley-social-leads/computeConversionSummary";
import { deriveConversionOutcomeHints } from "@/lib/bentley-social-leads/conversionOutcomeHints";

export type ConversionAnalyticsFilters = {
  from?: string;
  to?: string;
  source?: string;
  platform?: string;
  status?: string;
};

export function rowToAnalytics(r: typeof bentleyTrackedLeads.$inferSelect): TrackedLeadForAnalytics {
  return {
    id: r.id,
    platform: r.platform,
    status: r.status,
    source: r.source,
    painType: r.painType,
    intentScore: String(r.intentScore ?? "0"),
    commercialReadiness: r.commercialReadiness ?? null,
    contentDeploymentId: r.contentDeploymentId ?? null,
    analysisRunId: r.analysisRunId ?? null,
    uploadId: r.uploadId ?? null,
    estimatedValue: r.estimatedValue != null ? String(r.estimatedValue) : null,
    closedValue: r.closedValue != null ? String(r.closedValue) : null,
    attributionSnapshotJson: (r.attributionSnapshotJson ?? null) as Record<string, unknown> | null,
    createdAt: r.createdAt,
  };
}

export async function loadConversionAnalyticsForUser(userId: number, filters: ConversionAnalyticsFilters) {
  const db = await getDb();
  const conditions = [eq(bentleyTrackedLeads.userId, userId)];

  if (filters.from) {
    const d = new Date(filters.from);
    if (!Number.isNaN(d.getTime())) conditions.push(gte(bentleyTrackedLeads.createdAt, d));
  }
  if (filters.to) {
    const d = new Date(filters.to);
    if (!Number.isNaN(d.getTime())) conditions.push(lte(bentleyTrackedLeads.createdAt, d));
  }
  if (filters.source) conditions.push(eq(bentleyTrackedLeads.source, filters.source));
  if (filters.platform) conditions.push(eq(bentleyTrackedLeads.platform, filters.platform));
  if (filters.status) conditions.push(eq(bentleyTrackedLeads.status, filters.status));

  const rows = await db
    .select()
    .from(bentleyTrackedLeads)
    .where(and(...conditions))
    .orderBy(desc(bentleyTrackedLeads.updatedAt))
    .limit(2000);

  const analyticsRows = rows.map(rowToAnalytics);
  const summary = computeConversionSummary(analyticsRows);
  const hints = deriveConversionOutcomeHints(summary);

  return { rows, analyticsRows, summary, hints, rowCount: rows.length };
}
