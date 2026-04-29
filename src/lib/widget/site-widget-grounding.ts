import { and, eq } from "drizzle-orm";
import { web3SiteVersions, web3Sites } from "@/lib/db/schema";
import { getOwnedSite } from "@/lib/site-builder/db";
import { buildSiteWidgetSummaryFromSchemaJson } from "@/lib/widget/site-schema-widget-summary";

type Db = Awaited<ReturnType<typeof import("@/lib/db").getDb>>;

/**
 * Load a short text summary of the site's current (or pinned) version for widget system prompts.
 */
export async function loadSiteSummaryTextForWidget(
  db: Db,
  userId: number,
  siteId: string,
  opts?: { versionId?: string | null },
): Promise<string | null> {
  const site = await getOwnedSite(db, userId, siteId);
  if (!site) return null;

  let versionId = opts?.versionId?.trim() || null;
  if (!versionId && site.currentVersionId) {
    versionId = String(site.currentVersionId);
  }
  if (!versionId) return null;

  const [row] = await db
    .select({ schemaJson: web3SiteVersions.schemaJson })
    .from(web3SiteVersions)
    .where(and(eq(web3SiteVersions.id, versionId), eq(web3SiteVersions.siteId, siteId)))
    .limit(1);

  if (!row?.schemaJson) return null;
  return buildSiteWidgetSummaryFromSchemaJson(row.schemaJson);
}
