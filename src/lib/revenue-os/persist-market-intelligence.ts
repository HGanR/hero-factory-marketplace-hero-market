import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { marketIntelligenceSnapshots } from "@/lib/db/schema";
import type { MarketSweepResult } from "@/lib/revenue-os/market-sweep-schema";

export function fingerprintMarketSweepQuery(
  industry: string,
  targetAudience: string,
  platforms: string[]
): string {
  const raw = `${industry.trim()}\n${targetAudience.trim()}\n${[...platforms].sort().join(",")}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/**
 * Most recent market intelligence snapshot for a workspace (any fingerprint).
 * Used for command center / dashboards without requiring a specific query fingerprint.
 */
export async function fetchLatestMarketSweepForWorkspace(params: {
  userId: string;
  clientId: string;
  trustId: string;
}): Promise<{ result: MarketSweepResult; createdAt: string } | null> {
  try {
    const db = await getDb();
    const row = await db
      .select({
        mergedResult: marketIntelligenceSnapshots.mergedResult,
        createdAt: marketIntelligenceSnapshots.createdAt,
      })
      .from(marketIntelligenceSnapshots)
      .where(
        and(
          eq(marketIntelligenceSnapshots.userId, params.userId),
          eq(marketIntelligenceSnapshots.clientId, params.clientId),
          eq(marketIntelligenceSnapshots.trustId, params.trustId)
        )
      )
      .orderBy(desc(marketIntelligenceSnapshots.createdAt))
      .limit(1);
    const raw = row[0]?.mergedResult;
    if (!raw || typeof raw !== "object") return null;
    const createdAt = row[0]?.createdAt;
    return {
      result: raw as MarketSweepResult,
      createdAt: createdAt instanceof Date ? createdAt.toISOString() : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Latest persisted sweep for this fingerprint (before a new insert). Used for diffs.
 * Returns null when unauthenticated context, DB error, or no row.
 */
export async function fetchLatestMarketSweepSnapshot(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queryFingerprint: string;
}): Promise<MarketSweepResult | null> {
  try {
    const db = await getDb();
    const row = await db
      .select({ mergedResult: marketIntelligenceSnapshots.mergedResult })
      .from(marketIntelligenceSnapshots)
      .where(
        and(
          eq(marketIntelligenceSnapshots.userId, params.userId),
          eq(marketIntelligenceSnapshots.clientId, params.clientId),
          eq(marketIntelligenceSnapshots.trustId, params.trustId),
          eq(marketIntelligenceSnapshots.queryFingerprint, params.queryFingerprint)
        )
      )
      .orderBy(desc(marketIntelligenceSnapshots.createdAt))
      .limit(1);
    const raw = row[0]?.mergedResult;
    if (!raw || typeof raw !== "object") return null;
    return raw as MarketSweepResult;
  } catch {
    return null;
  }
}

export async function persistMarketIntelligenceSnapshot(params: {
  userId: string;
  clientId: string;
  trustId: string;
  industry: string;
  targetAudience: string;
  queryFingerprint: string;
  realSignals: unknown;
  mergedResult: unknown;
  scoredSignals: unknown;
  decisionHint: string | null;
}): Promise<string> {
  const id = crypto.randomUUID();
  const db = await getDb();
  await db.insert(marketIntelligenceSnapshots).values({
    id,
    userId: params.userId,
    clientId: params.clientId,
    trustId: params.trustId,
    industry: params.industry.slice(0, 200),
    targetAudience: params.targetAudience.slice(0, 300),
    queryFingerprint: params.queryFingerprint,
    realSignals: params.realSignals,
    mergedResult: params.mergedResult,
    scoredSignals: params.scoredSignals,
    decisionHint: params.decisionHint,
  });
  return id;
}
