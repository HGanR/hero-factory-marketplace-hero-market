import { sql } from "drizzle-orm";
import type { DbClient } from "@/lib/site-builder/intelligence/repository";
import { ensureSiteBuilderIntelligenceTables, mysqlRows } from "@/lib/site-builder/db";

export type MarkPublishedParams = {
  userId: number;
  siteId: string;
  publishedVersionId: string | null;
  deployedUrl: string | null;
};

/**
 * After a successful deploy, mark the latest intelligence run for this site as published.
 * Does not throw — callers should not fail deploy on intelligence errors.
 */
export async function markLatestSiteGenerationRunPublished(db: DbClient, p: MarkPublishedParams): Promise<boolean> {
  try {
    await ensureSiteBuilderIntelligenceTables(db);
    const sid = p.siteId.trim();
    if (!sid) return false;
    const raw = await db.execute(sql`
      SELECT id FROM site_generation_runs
      WHERE userId = ${p.userId} AND siteId = ${sid}
      ORDER BY createdAt DESC
      LIMIT 1
    `);
    const rows = mysqlRows(raw);
    const id = rows[0]?.id != null ? String(rows[0].id) : null;
    if (!id) return false;
    const deployedUrl =
      p.deployedUrl != null && p.deployedUrl.length > 512 ? p.deployedUrl.slice(0, 512) : p.deployedUrl;
    await db.execute(sql`
      UPDATE site_generation_runs
      SET publishStatus = 'PUBLISHED',
          publishedAt = NOW(),
          publishedVersionId = ${p.publishedVersionId},
          deployedUrl = ${deployedUrl},
          updatedAt = NOW()
      WHERE id = ${id} AND userId = ${p.userId}
    `);
    return true;
  } catch {
    return false;
  }
}
