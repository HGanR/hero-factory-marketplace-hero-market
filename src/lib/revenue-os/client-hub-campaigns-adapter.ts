import { and, count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { campaignPosts, campaigns } from "@/lib/db/schema";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-queries";
import type { ClientCampaignListItem } from "@/lib/revenue-os/client-hub-types";

export type ClientCampaignsAdapterResult = {
  items: ClientCampaignListItem[];
  /**
   * When the list is empty, explains that `campaigns.client_id` must match this hub client
   * (legacy rows often use the default empty string and are not safely attributable).
   */
  adapterNote: string | null;
};

/**
 * Lists social campaigns for a client hub. Always checks `client_accounts.ownerUserId` first
 * via `getOwnedClientId` — never trust `clientId` from the URL alone.
 */
export async function listCampaignsForClientHub(
  userId: number,
  clientId: string,
): Promise<ClientCampaignsAdapterResult> {
  const owned = await getOwnedClientRow(userId, clientId);
  if (!owned) return { items: [], adapterNote: null };

  const db = await getDb();
  const rows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.userId, String(userId)), eq(campaigns.clientId, clientId)))
    .orderBy(desc(campaigns.updatedAt));

  if (rows.length === 0) {
    return {
      items: [],
      adapterNote:
        "No campaigns are linked to this client id yet. Campaigns must have `clientId` set to this client; older rows with an empty client id are not shown here.",
    };
  }

  const ids = rows.map((r) => r.id);
  const postAgg = await db
    .select({ campaignId: campaignPosts.campaignId, n: count() })
    .from(campaignPosts)
    .where(inArray(campaignPosts.campaignId, ids))
    .groupBy(campaignPosts.campaignId);
  const postedAgg = await db
    .select({ campaignId: campaignPosts.campaignId, n: count() })
    .from(campaignPosts)
    .where(and(inArray(campaignPosts.campaignId, ids), eq(campaignPosts.status, "POSTED")))
    .groupBy(campaignPosts.campaignId);
  const platforms = await db
    .select({ campaignId: campaignPosts.campaignId, platform: campaignPosts.platform })
    .from(campaignPosts)
    .where(inArray(campaignPosts.campaignId, ids));

  const nBy = new Map(postAgg.map((p) => [p.campaignId, Number(p.n)]));
  const postedBy = new Map(postedAgg.map((p) => [p.campaignId, Number(p.n)]));
  const platBy = new Map<string, string[]>();
  for (const p of platforms) {
    const k = p.campaignId;
    if (!platBy.has(k)) platBy.set(k, []);
    platBy.get(k)!.push(p.platform);
  }

  const items: ClientCampaignListItem[] = rows.map((r) => {
    const plats = platBy.get(r.id) ?? [];
    const platformLabel = plats.length ? Array.from(new Set(plats)).sort().join(", ") : "—";
    return {
      id: r.id,
      name: r.name,
      platform: platformLabel,
      status: r.status,
      postsCount: nBy.get(r.id) ?? 0,
      postedCount: postedBy.get(r.id) ?? 0,
      engagementHint: null,
      lastSyncAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
      dataSource: "campaigns",
      adapterNote: null,
    } satisfies ClientCampaignListItem;
  });

  return { items, adapterNote: null };
}
