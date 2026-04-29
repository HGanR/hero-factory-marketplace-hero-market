import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { web3SiteVersions, web3Sites } from "@/lib/db/schema";
import { hashSiteSchema } from "@/lib/site-builder/hash";
import { RequiredRecordsPayloadSchema } from "@/lib/site-builder/domain-connection-shared";
import type { SiteDomainConnectionRow } from "@/lib/site-builder/site-domain-connections-repository";
import { SiteSchemaDocument, type SiteMetadataDomainConnection } from "@/lib/site-builder/schema";

type Db = Awaited<ReturnType<typeof getDb>>;

export function domainConnectionRowToMetadata(row: SiteDomainConnectionRow): SiteMetadataDomainConnection {
  let instructions: string | undefined;
  let records: SiteMetadataDomainConnection["requiredRecords"];
  if (row.requiredRecordsJson?.trim()) {
    try {
      const p = RequiredRecordsPayloadSchema.safeParse(JSON.parse(row.requiredRecordsJson));
      if (p.success) {
        records = p.data.records;
        instructions = p.data.instructionsMarkdown;
      }
    } catch {
      /* ignore */
    }
  }
  return {
    enabled: true,
    domain: row.domain,
    domainType: row.domainType,
    provider: row.provider,
    targetUrl: row.targetUrl,
    status: row.status,
    requiredRecords: records,
    setupInstructionsMarkdown: instructions,
    lastCheckedAt: row.lastCheckedAt
      ? new Date(row.lastCheckedAt as string).toISOString()
      : undefined,
  };
}

/**
 * Merges `metadata.domainConnection` on the site’s **current** version (if any).
 */
export async function mergeDomainConnectionIntoCurrentSiteVersion(
  db: Db,
  userId: number,
  siteId: string,
  row: SiteDomainConnectionRow,
): Promise<void> {
  const [site] = await db
    .select({ currentVersionId: web3Sites.currentVersionId })
    .from(web3Sites)
    .where(and(eq(web3Sites.id, siteId), eq(web3Sites.userId, userId)))
    .limit(1);
  const vid = site?.currentVersionId;
  if (!vid) return;

  const [ver] = await db
    .select({ schemaJson: web3SiteVersions.schemaJson })
    .from(web3SiteVersions)
    .where(and(eq(web3SiteVersions.id, vid), eq(web3SiteVersions.siteId, siteId)))
    .limit(1);
  if (!ver?.schemaJson) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(ver.schemaJson);
  } catch {
    return;
  }
  const doc = SiteSchemaDocument.safeParse(parsed);
  if (!doc.success) return;

  const next = { ...doc.data, metadata: { ...doc.data.metadata, title: doc.data.metadata?.title ?? "Site" } };
  if (!next.metadata) {
    return;
  }
  next.metadata.domainConnection = domainConnectionRowToMetadata(row);

  const hash = hashSiteSchema(next);
  await db
    .update(web3SiteVersions)
    .set({ schemaJson: JSON.stringify(next), schemaHash: hash })
    .where(eq(web3SiteVersions.id, vid));
}
