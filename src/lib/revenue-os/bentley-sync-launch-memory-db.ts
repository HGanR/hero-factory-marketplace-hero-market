/**
 * In-memory Drizzle-shaped DB for Bentley sync-launch integration tests.
 * Supports only the query shapes used by `syncBentleyCampaignPostsAndSchedule`.
 */

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";

function collectParamValues(node: unknown): unknown[] {
  const out: unknown[] = [];
  const visit = (x: unknown): void => {
    if (x == null || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    if ("value" in o && "encoder" in o) {
      out.push(o.value);
      return;
    }
    if (Array.isArray(o.queryChunks)) {
      for (const c of o.queryChunks as unknown[]) visit(c);
    }
  };
  visit(node);
  return out;
}

export type MemoryCampaignRow = {
  id: string;
  userId: string;
  bentleyGenerationJson: unknown;
  name?: string;
  clientId?: string;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type MemoryCampaignPostRow = {
  id: string;
  campaignId: string;
  platform: string;
  scheduledAt: Date | null;
  status: string;
  caption?: string | null;
  assetId?: string | null;
  utmParams?: unknown;
  scheduledPublishMeta?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
};

export type MemoryCampaignAssetRow = {
  id: string;
  campaignId: string;
  creativeType: string;
  storageUrl: string | null;
  metadata?: unknown;
  createdAt?: Date;
};

export function createBentleySyncLaunchMemoryDb(initial: {
  campaign: MemoryCampaignRow;
  posts?: MemoryCampaignPostRow[];
}): {
  db: MySql2Database<typeof schema>;
  getPosts: () => MemoryCampaignPostRow[];
  getAssets: () => MemoryCampaignAssetRow[];
  getCampaign: () => MemoryCampaignRow;
} {
  const campaign: MemoryCampaignRow = {
    name: "Test",
    clientId: "cl-test",
    status: "DRAFT",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...initial.campaign,
  };
  const posts: MemoryCampaignPostRow[] = (initial.posts ?? []).map((p) => ({ ...p }));
  const assets: MemoryCampaignAssetRow[] = [];

  const db = {
    select: () => ({
      from: (tbl: unknown) => ({
        where: (cond: unknown) => {
          if (tbl === schema.campaignPosts) {
            const params = collectParamValues(cond);
            const campaignId = String(params[params.length - 1] ?? "");
            return Promise.resolve(posts.filter((p) => p.campaignId === campaignId));
          }
          if (tbl === schema.campaigns) {
            return {
              limit: async (_n: number) => {
                const params = collectParamValues(cond);
                const id = String(params[0] ?? "");
                const uid = String(params[1] ?? "");
                if (id === campaign.id && uid === String(campaign.userId)) return [campaign];
                return [];
              },
            };
          }
          if (tbl === schema.campaignAssets) {
            return {
              limit: async (_n: number) => {
                const params = collectParamValues(cond).map((x) => String(x));
                if (params.length >= 2) {
                  const hit = assets.find((a) => params.includes(a.id) && params.includes(a.campaignId));
                  return hit ? [{ ...hit }] : [];
                }
                if (params.length === 1) {
                  const cid = params[0]!;
                  return assets.filter((a) => a.campaignId === cid).map((a) => ({ ...a }));
                }
                return [];
              },
            };
          }
          return Promise.resolve([]);
        },
      }),
    }),
    insert: (tbl: unknown) => ({
      values: (row: Record<string, unknown>) => {
        const now = new Date();
        if (tbl === schema.campaignAssets) {
          assets.push({
            id: String(row.id),
            campaignId: String(row.campaignId),
            creativeType: String(row.creativeType ?? "IMAGE"),
            storageUrl: row.storageUrl != null ? String(row.storageUrl) : null,
            metadata: row.metadata,
            createdAt: (row.createdAt as Date | undefined) ?? now,
          });
          return Promise.resolve();
        }
        if (tbl === schema.campaignPosts) {
          posts.push({
            id: String(row.id),
            campaignId: String(row.campaignId),
            platform: String(row.platform),
            scheduledAt: (row.scheduledAt as Date | null | undefined) ?? null,
            status: String(row.status ?? "DRAFT"),
            caption: row.caption != null ? String(row.caption) : null,
            assetId: row.assetId != null && String(row.assetId) ? String(row.assetId) : null,
            utmParams: row.utmParams,
            scheduledPublishMeta: row.scheduledPublishMeta,
            createdAt: (row.createdAt as Date | undefined) ?? now,
            updatedAt: (row.updatedAt as Date | undefined) ?? now,
          });
          return Promise.resolve();
        }
        throw new Error("unexpected insert table");
      },
    }),
    update: (tbl: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: async (cond: unknown) => {
          if (tbl === schema.campaignAssets) {
            const params = collectParamValues(cond).map((x) => String(x));
            const idx = assets.findIndex((a) => params.includes(a.id) && params.includes(a.campaignId));
            if (idx < 0) return;
            const cur = assets[idx]!;
            assets[idx] = {
              ...cur,
              ...vals,
              storageUrl: vals.storageUrl != null ? String(vals.storageUrl) : cur.storageUrl,
              metadata: vals.metadata !== undefined ? vals.metadata : cur.metadata,
            } as MemoryCampaignAssetRow;
            return;
          }
          if (tbl === schema.campaignPosts) {
            const params = collectParamValues(cond);
            const id = String(params[0] ?? "");
            const idx = posts.findIndex((p) => p.id === id);
            if (idx < 0) return;
            const cur = posts[idx]!;
            posts[idx] = {
              ...cur,
              ...vals,
              updatedAt: new Date(),
            } as MemoryCampaignPostRow;
          }
        },
      }),
    }),
  };

  return {
    db: db as unknown as MySql2Database<typeof schema>,
    getPosts: () => posts.map((p) => ({ ...p })),
    getAssets: () => assets.map((a) => ({ ...a })),
    getCampaign: () => ({ ...campaign }),
  };
}
