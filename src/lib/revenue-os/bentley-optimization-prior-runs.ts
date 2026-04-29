/**
 * Load prior optimization runs for feedback into diagnosis (avoid repeat failures).
 */

import { desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import type {
  BentleyOptimizationPriorHints,
  BentleyOptimizationPrimaryDriver,
  BentleyOptimizationResult,
} from "@/lib/revenue-os/bentley-optimization";

function parsePrimaryDriver(raw: unknown): BentleyOptimizationPrimaryDriver | null {
  const r = raw as BentleyOptimizationResult | undefined;
  const d = r?.primaryDriver;
  if (!d || typeof d !== "string") return null;
  return d as BentleyOptimizationPrimaryDriver;
}

function improvementScoreNumber(row: { improvementScore: string | null }): number | null {
  if (row.improvementScore == null || row.improvementScore === "") return null;
  const n = Number.parseFloat(String(row.improvementScore));
  return Number.isFinite(n) ? n : null;
}

/**
 * Summarize recent runs on this campaign (same `campaign_id` as the parent being optimized).
 */
export async function loadBentleyOptimizationPriorHints(
  db: MySql2Database<typeof schema>,
  campaignId: string,
  opts?: { limit?: number }
): Promise<BentleyOptimizationPriorHints> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
  const rows = await db
    .select({
      resultJson: schema.bentleyOptimizationRuns.resultJson,
      childCampaignId: schema.bentleyOptimizationRuns.childCampaignId,
      winningVariant: schema.bentleyOptimizationRuns.winningVariant,
      improvementScore: schema.bentleyOptimizationRuns.improvementScore,
    })
    .from(schema.bentleyOptimizationRuns)
    .where(eq(schema.bentleyOptimizationRuns.campaignId, campaignId))
    .orderBy(desc(schema.bentleyOptimizationRuns.createdAt))
    .limit(limit);

  const losing = new Set<BentleyOptimizationPrimaryDriver>();
  const winning = new Set<BentleyOptimizationPrimaryDriver>();

  for (const row of rows) {
    if (!row.childCampaignId?.trim()) continue;
    const driver = parsePrimaryDriver(row.resultJson);
    if (!driver) continue;

    const score = improvementScoreNumber(row);
    const wv = row.winningVariant;

    if (wv === true || (score != null && score > 0.05)) {
      winning.add(driver);
    }
    if (wv === false || (score != null && score < -0.02)) {
      losing.add(driver);
    }
  }

  return {
    losingPrimaryDrivers: [...losing],
    winningPrimaryDrivers: [...winning],
  };
}
