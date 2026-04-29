/**
 * Queryable optimization memory (revenue_os_post_optimization_memory).
 */

import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  revenueOsPostOptimizationMemory,
  type RevenueOsPostOptimizationMemoryRow,
} from "@/lib/db/schema";
import type {
  RevenueOsOptimizationEvidence,
  RevenueOsOptimizationMemoryEntry,
  RevenueOsOptimizationMemorySource,
} from "@/lib/revenue-os/post-optimization-memory-types";
import {
  enrichOptimizationMemoryEntries,
  formatMemoryEntrySummary,
  summarizeOptimizationMemory,
} from "@/lib/revenue-os/build-post-optimization-memory";
import type { RevenueOsOptimizationMemorySummary } from "@/lib/revenue-os/post-optimization-memory-types";
import { buildDefaultMetricSyncContext } from "@/lib/revenue-os/platform-evidence-weighting";

function mergeEvidence(a: RevenueOsOptimizationEvidence, b: RevenueOsOptimizationEvidence): RevenueOsOptimizationEvidence {
  return {
    publishCount: (a.publishCount ?? 0) + (b.publishCount ?? 0),
    impressions: (a.impressions ?? 0) + (b.impressions ?? 0),
    clicks: (a.clicks ?? 0) + (b.clicks ?? 0),
    engagement: (a.engagement ?? 0) + (b.engagement ?? 0),
    leads: (a.leads ?? 0) + (b.leads ?? 0),
    failures: (a.failures ?? 0) + (b.failures ?? 0),
  };
}

function parseEvidence(raw: unknown): RevenueOsOptimizationEvidence {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const num = (k: string) => (typeof o[k] === "number" ? o[k] : undefined);
  return {
    publishCount: num("publishCount"),
    impressions: num("impressions"),
    clicks: num("clicks"),
    engagement: num("engagement"),
    leads: num("leads"),
    failures: num("failures"),
  };
}

export function rowToOptimizationMemoryEntry(row: RevenueOsPostOptimizationMemoryRow): RevenueOsOptimizationMemoryEntry {
  return {
    id: row.id,
    userId: row.userId,
    clientId: row.clientId,
    trustId: row.trustId ?? null,
    platform: row.platform,
    contentType: row.contentType ?? null,
    hook: row.hookText ?? null,
    angle: row.angleText ?? null,
    cta: row.ctaText ?? null,
    source: row.source as RevenueOsOptimizationMemoryEntry["source"],
    outcomeKind: row.outcomeKind as RevenueOsOptimizationMemoryEntry["outcomeKind"],
    evidence: parseEvidence(row.evidenceJson),
    summary: row.summaryText,
    patternKey: row.patternKey,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveOptimizationMemoryEntriesForUser(
  db: any,
  userId: string,
  entries: RevenueOsOptimizationMemoryEntry[],
  clientId: string
): Promise<void> {
  const cid = clientId ?? "";
  for (const e of entries) {
    if (!e.patternKey) continue;
    await upsertOptimizationMemoryEntry(db, { ...e, userId, clientId: cid });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function upsertOptimizationMemoryEntry(
  db: any,
  entry: RevenueOsOptimizationMemoryEntry & { userId: string; clientId: string }
): Promise<string> {
  const patternKey = entry.patternKey ?? "";
  if (!patternKey) {
    throw new Error("patternKey required");
  }
  const cid = entry.clientId ?? "";
  const uid = String(entry.userId);

  const existing: RevenueOsPostOptimizationMemoryRow[] = await db
    .select()
    .from(revenueOsPostOptimizationMemory)
    .where(
      and(
        eq(revenueOsPostOptimizationMemory.userId, uid),
        eq(revenueOsPostOptimizationMemory.clientId, cid),
        eq(revenueOsPostOptimizationMemory.patternKey, patternKey)
      )
    )
    .limit(1);

  const evidenceNew = entry.evidence;
  const trustId = entry.trustId?.trim() || null;
  const now = new Date();

  if (existing[0]) {
    const merged = mergeEvidence(parseEvidence(existing[0].evidenceJson), evidenceNew);
    const plat = String(entry.platform ?? existing[0].platform ?? "unknown");
    const hook = entry.hook ?? existing[0].hookText ?? null;
    const { outcomeKind, summary } = formatMemoryEntrySummary(plat, merged, hook);
    await db
      .update(revenueOsPostOptimizationMemory)
      .set({
        outcomeKind,
        summaryText: summary.slice(0, 4000),
        evidenceJson: merged,
        hookText: entry.hook ?? existing[0].hookText,
        angleText: entry.angle ?? existing[0].angleText,
        ctaText: entry.cta ?? existing[0].ctaText,
        platform: plat.slice(0, 24),
        contentType: entry.contentType ?? existing[0].contentType,
        source: entry.source,
        trustId: trustId ?? existing[0].trustId,
        updatedAt: now,
      })
      .where(eq(revenueOsPostOptimizationMemory.id, existing[0].id));
    return existing[0].id;
  }

  const id = crypto.randomUUID();
  await db.insert(revenueOsPostOptimizationMemory).values({
    id,
    userId: uid,
    clientId: cid,
    trustId,
    patternKey,
    platform: String(entry.platform ?? "unknown").slice(0, 24),
    contentType: entry.contentType?.slice(0, 80) ?? null,
    hookText: entry.hook ?? null,
    angleText: entry.angle ?? null,
    ctaText: entry.cta ?? null,
    source: entry.source,
    outcomeKind: entry.outcomeKind,
    summaryText: entry.summary.slice(0, 4000),
    evidenceJson: evidenceNew,
  });
  return id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listOptimizationMemoryForUser(
  db: any,
  userId: string,
  opts?: { clientId?: string; limit?: number }
): Promise<RevenueOsOptimizationMemoryEntry[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 120);
  const cid = opts?.clientId?.trim();

  const conds = [eq(revenueOsPostOptimizationMemory.userId, String(userId))];
  if (cid !== undefined && cid !== "") {
    conds.push(eq(revenueOsPostOptimizationMemory.clientId, cid));
  }

  const rows: RevenueOsPostOptimizationMemoryRow[] = await db
    .select()
    .from(revenueOsPostOptimizationMemory)
    .where(and(...conds))
    .orderBy(desc(revenueOsPostOptimizationMemory.updatedAt))
    .limit(limit);

  return rows.map(rowToOptimizationMemoryEntry);
}

export async function getOptimizationMemorySummaryForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  opts?: { clientId?: string; limit?: number }
): Promise<{ summary: RevenueOsOptimizationMemorySummary; entries: RevenueOsOptimizationMemoryEntry[] }> {
  const raw = await listOptimizationMemoryForUser(db, userId, opts);
  const ctx = buildDefaultMetricSyncContext();
  const entries = enrichOptimizationMemoryEntries(raw, ctx);
  return {
    entries,
    summary: summarizeOptimizationMemory(entries, { metricSyncContext: ctx }),
  };
}

/** Row count + latest `updated_at` for debug panels and refresh UX. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOptimizationMemoryStatsForUser(
  db: any,
  userId: string,
  opts?: { clientId?: string }
): Promise<{ entryCount: number; latestUpdatedAt: string | null }> {
  const conds = [eq(revenueOsPostOptimizationMemory.userId, String(userId))];
  const cid = opts?.clientId?.trim();
  if (cid !== undefined && cid !== "") {
    conds.push(eq(revenueOsPostOptimizationMemory.clientId, cid));
  }
  const whereClause = and(...conds);

  const [cntRow] = await db
    .select({ c: sql<number>`count(*)` })
    .from(revenueOsPostOptimizationMemory)
    .where(whereClause);

  const [latestRow] = await db
    .select({ updatedAt: revenueOsPostOptimizationMemory.updatedAt })
    .from(revenueOsPostOptimizationMemory)
    .where(whereClause)
    .orderBy(desc(revenueOsPostOptimizationMemory.updatedAt))
    .limit(1);

  const entryCount = Number(cntRow?.c ?? 0);
  const u = latestRow?.updatedAt;
  const latestUpdatedAt = u ? new Date(u as string | number | Date).toISOString() : null;
  return { entryCount, latestUpdatedAt };
}

/** Distinct user ids with deployment feedback (for cron sweep). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listDistinctUserIdsFromDeploymentFeedback(db: any, limit = 20): Promise<string[]> {
  const { revenueOsDeploymentFeedback } = await import("@/lib/db/schema");
  const rows = await db
    .select({ userId: revenueOsDeploymentFeedback.userId })
    .from(revenueOsDeploymentFeedback)
    .groupBy(revenueOsDeploymentFeedback.userId)
    .limit(Math.min(Math.max(limit, 1), 50));
  return rows.map((r: { userId: string }) => r.userId).filter(Boolean);
}
