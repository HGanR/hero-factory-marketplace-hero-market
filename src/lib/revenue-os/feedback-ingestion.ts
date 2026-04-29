import crypto from "crypto";
import { getDb } from "@/lib/db";
import { contentFeedbackLog } from "@/lib/db/schema";

export type FeedbackIngestionEntry = {
  source?: string;
  campaignId?: string;
  platform?: string;
  sentiment?: "positive" | "negative" | "neutral" | string;
  scoreDelta?: number;
  notes?: string;
  rawPayload?: Record<string, unknown>;
};

export type RunFeedbackIngestionParams = {
  userId: string;
  clientId: string;
  trustId: string;
  entries: FeedbackIngestionEntry[];
};

/**
 * Persists operator or system feedback rows for Bentley to weight future decisions.
 */
export async function runFeedbackIngestion(params: RunFeedbackIngestionParams): Promise<{ inserted: number }> {
  const { userId, clientId, trustId, entries } = params;
  if (!entries.length) return { inserted: 0 };

  const db = await getDb();
  let inserted = 0;
  for (const e of entries) {
    await db.insert(contentFeedbackLog).values({
      id: crypto.randomUUID(),
      userId,
      clientId,
      trustId,
      source: (e.source ?? "manual").slice(0, 32),
      campaignId: e.campaignId,
      platform: e.platform?.slice(0, 64),
      sentiment: e.sentiment?.slice(0, 24),
      scoreDelta:
        e.scoreDelta != null && Number.isFinite(e.scoreDelta)
          ? String(e.scoreDelta)
          : null,
      rawPayload: e.rawPayload ?? null,
      notes: e.notes?.slice(0, 8000) ?? null,
    });
    inserted += 1;
  }
  return { inserted };
}
