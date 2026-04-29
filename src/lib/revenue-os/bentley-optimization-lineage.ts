/**
 * Optimization campaign lineage — depth limits prevent runaway variant chains.
 */

import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";

/** Number of hops from root (root = 0, first optimization child = 1). */
export async function countCampaignOptimizationLineageDepth(
  db: MySql2Database<typeof schema>,
  campaignId: string
): Promise<number> {
  let depth = 0;
  let cur: string | null = campaignId;
  const guardMax = 32;
  for (let i = 0; i < guardMax && cur; i++) {
    const rows = await db
      .select({ derivedFromCampaignId: schema.campaigns.derivedFromCampaignId })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, cur))
      .limit(1);
    const parent = rows[0]?.derivedFromCampaignId?.trim() ?? null;
    if (!parent) return depth;
    depth += 1;
    cur = parent;
  }
  return depth;
}

export function readMaxOptimizationLineageDepthEnv(): number {
  const raw = process.env.BENTLEY_OPTIMIZATION_MAX_LINEAGE_DEPTH?.trim();
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 1;
  return Math.min(n, 10);
}
