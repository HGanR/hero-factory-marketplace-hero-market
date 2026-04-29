/**
 * Durable storage for Bentley auto-generated campaign images (Pinata IPFS).
 * Ephemeral sources: OpenAI temporary URLs, Picsum placeholders.
 */

import type { MySql2Database } from "drizzle-orm/mysql2";
import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { uploadFileToIPFS, getIPFSUrl } from "@/lib/marketplace/pinata";

const FETCH_TIMEOUT_MS = 45_000;
const STORAGE_URL_MAX = 512;

export type EphemeralImageKind = "openai" | "picsum";

/** Pinata file upload + gateway URL (HTTPS) for adapters. */
export type BentleyDurableUploadResult = {
  durableHttpsUrl: string;
  ipfsUri: string;
  ipfsHash: string;
  storage: "pinata";
};

export function isPinataFileUploadConfigured(): boolean {
  const jwt = (process.env.PINATA_JWT || "").trim();
  if (jwt) return true;
  const k = (process.env.PINATA_API_KEY || "").trim();
  const s = (process.env.PINATA_SECRET_KEY || "").trim();
  return Boolean(k && s);
}

export function readBentleyDurableImageUpgradeEnv(): boolean {
  const v = (process.env.BENTLEY_SKIP_DURABLE_IMAGE_UPGRADE || "").trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return false;
  return true;
}

export function classifyEphemeralBentleyImageUrl(url: string): EphemeralImageKind | null {
  const u = url.trim().toLowerCase();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return null;
  if (u.includes("picsum.photos")) return "picsum";
  if (
    u.includes("oaidalleapiprodscus.blob.core.windows.net") ||
    u.includes("openaiusercontent.com") ||
    u.includes("dalleprodsec.blob.core.windows.net")
  ) {
    return "openai";
  }
  return null;
}

export function isBentleyAutoEphemeralAssetUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return classifyEphemeralBentleyImageUrl(url) !== null;
}

function mergeMetadata(prev: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev) ? { ...(prev as Record<string, unknown>) } : {};
  return { ...base, ...patch };
}

/**
 * Fetch bytes from a remote image URL and upload to Pinata IPFS.
 */
export async function uploadBentleyAssetToStorage(args: {
  imageUrl: string;
  fileName: string;
  metadata?: Record<string, unknown>;
}): Promise<BentleyDurableUploadResult> {
  const imageUrl = args.imageUrl.trim();
  if (!imageUrl) throw new Error("imageUrl required");

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(imageUrl, { signal: ac.signal, redirect: "follow" });
  } finally {
    clearTimeout(to);
  }
  if (!res.ok) {
    throw new Error(`fetch image failed: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32) {
    throw new Error("image body too small");
  }

  const ct = res.headers.get("content-type")?.split(";")[0]?.trim();
  const mime = ct && ct.startsWith("image/") ? ct : "image/png";

  const { ipfsHash, ipfsUrl } = await uploadFileToIPFS(buf, args.fileName, mime);
  const durableHttpsUrl = getIPFSUrl(ipfsHash);
  if (durableHttpsUrl.length > STORAGE_URL_MAX) {
    throw new Error("gateway URL exceeds storage_url column limit");
  }

  void args.metadata;

  return {
    durableHttpsUrl,
    ipfsUri: ipfsUrl,
    ipfsHash,
    storage: "pinata",
  };
}

export type UpgradeBentleyAssetResult =
  | { status: "upgraded"; durableHttpsUrl: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

/**
 * Idempotent: upgrades one `campaign_assets` row from ephemeral URL to Pinata gateway URL.
 * Does not modify manual / non–bentley_auto assets. Preserves `campaign_posts.assetId`.
 */
export async function maybeUpgradeBentleyCampaignAssetToDurableStorage(
  db: MySql2Database<typeof schema>,
  row: Pick<typeof schema.campaignAssets.$inferSelect, "id" | "campaignId" | "storageUrl" | "metadata">
): Promise<UpgradeBentleyAssetResult> {
  const url = row.storageUrl?.trim() ?? "";
  if (!url) {
    return { status: "skipped", reason: "no_storage_url" };
  }

  const meta = row.metadata as Record<string, unknown> | null | undefined;
  if (meta?.source !== "bentley_auto") {
    return { status: "skipped", reason: "not_bentley_auto" };
  }

  if (meta?.durableUpgrade === "complete") {
    return { status: "skipped", reason: "already_upgraded" };
  }

  if (!isBentleyAutoEphemeralAssetUrl(url)) {
    return { status: "skipped", reason: "not_ephemeral_url" };
  }

  if (!readBentleyDurableImageUpgradeEnv()) {
    return { status: "skipped", reason: "upgrade_disabled_by_env" };
  }

  if (!isPinataFileUploadConfigured()) {
    return { status: "skipped", reason: "pinata_not_configured" };
  }

  const ephemeralKind = classifyEphemeralBentleyImageUrl(url) ?? "picsum";

  try {
    const fileName = `bentley-${row.campaignId.slice(0, 8)}-${row.id.slice(0, 8)}.png`;
    const up = await uploadBentleyAssetToStorage({
      imageUrl: url,
      fileName,
      metadata: { campaignId: row.campaignId, assetId: row.id },
    });

    const nextMeta = mergeMetadata(row.metadata, {
      source: "bentley_auto",
      storage: up.storage,
      durableUpgrade: "complete",
      upgradedFrom: ephemeralKind === "openai" ? "openai" : "picsum",
      ipfsHash: up.ipfsHash,
      ipfsUri: up.ipfsUri,
      durableAt: new Date().toISOString(),
    });

    await db
      .update(schema.campaignAssets)
      .set({
        storageUrl: up.durableHttpsUrl,
        metadata: nextMeta,
      })
      .where(and(eq(schema.campaignAssets.id, row.id), eq(schema.campaignAssets.campaignId, row.campaignId)));

    return { status: "upgraded", durableHttpsUrl: up.durableHttpsUrl };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.warn("[bentley-campaign-asset-durable] upgrade failed:", row.id, reason);
    return { status: "failed", reason };
  }
}

export type UpgradeCampaignAssetsSummary = { upgraded: number; skipped: number; failed: number };

/**
 * Batch upgrade for a campaign (operator / background). Skips completed & manual assets.
 */
export async function upgradeBentleyAssetsForCampaign(
  db: MySql2Database<typeof schema>,
  campaignId: string
): Promise<UpgradeCampaignAssetsSummary> {
  const rows = await db
    .select()
    .from(schema.campaignAssets)
    .where(eq(schema.campaignAssets.campaignId, campaignId));

  const summary: UpgradeCampaignAssetsSummary = { upgraded: 0, skipped: 0, failed: 0 };

  for (const r of rows) {
    const res = await maybeUpgradeBentleyCampaignAssetToDurableStorage(db, r);
    if (res.status === "upgraded") summary.upgraded += 1;
    else if (res.status === "failed") summary.failed += 1;
    else summary.skipped += 1;
  }

  return summary;
}

export type AssetDurableBadge = "temporary" | "stored" | "optimized";

export function resolveAssetDurableBadge(
  storageUrl: string | null | undefined,
  metadata: unknown
): AssetDurableBadge | null {
  if (!storageUrl?.trim()) return null;
  const m = metadata as Record<string, unknown> | null | undefined;
  if (m?.bentleyBadge === "optimized") return "optimized";
  if (m?.durableUpgrade === "complete" || m?.storage === "pinata") return "stored";
  if (isBentleyAutoEphemeralAssetUrl(storageUrl)) return "temporary";
  return "stored";
}
