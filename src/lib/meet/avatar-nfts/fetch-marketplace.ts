import { getDb } from "@/lib/db";
import { nfts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { MarketplaceNftRow } from "./normalize";
import { normalizeMarketplaceRowToItem } from "./normalize";
import type { MeetAvatarNftItem } from "./types";
import type { MeetAvatarNftWarning } from "./types";
import { HERO_1155_CHAIN_ID } from "./constants";
import { resolveCachedMeetAvatarMetadata } from "./cache";
import { mapWithConcurrency } from "./concurrency";
import { MEET_AVATAR_METADATA_FETCH_CONCURRENCY } from "./cache-constants";

export type FetchMarketplaceResult = {
  items: MeetAvatarNftItem[];
  ok: boolean;
  cacheWarnings: MeetAvatarNftWarning[];
};

function needsMarketplaceMetadataResolution(row: MarketplaceNftRow): boolean {
  const mu = row.metadataUrl?.trim();
  if (!mu) return false;
  const img = String(row.imageUrl ?? "").trim();
  if (!img) return true;
  if (/placeholder|via\.placeholder/i.test(img)) return true;
  return false;
}

/**
 * Reads Polygon marketplace NFT rows for wallet from DB (same source as GET wallet-nfts).
 * Optionally resolves remote metadata (cached) when image is missing or placeholder-like.
 */
export async function fetchMarketplaceAvatarNfts(walletAddress: string): Promise<FetchMarketplaceResult> {
  const normalizedAddress = walletAddress.toLowerCase();
  const cacheWarnings: MeetAvatarNftWarning[] = [];

  try {
    const db = await getDb();
    const walletNfts = await db
      .select()
      .from(nfts)
      .where(and(eq(nfts.ownerAddress, normalizedAddress), eq(nfts.chain, "polygon")));

    let rows: MarketplaceNftRow[] = walletNfts.map((nft) => ({
      tokenId: nft.tokenId,
      name: nft.name,
      description: nft.description,
      imageUrl: nft.imageUrl,
      contractAddress: nft.contractAddress,
      chain: nft.chain,
      metadataUrl: nft.metadataUrl,
    }));

    const enrichTasks = rows
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => needsMarketplaceMetadataResolution(row));

    if (enrichTasks.length > 0) {
      const staleFlags: boolean[] = [];
      const failFlags: boolean[] = [];

      const enrichedByIdx = await mapWithConcurrency(
        enrichTasks,
        MEET_AVATAR_METADATA_FETCH_CONCURRENCY,
        async ({ row, idx }) => {
          const tokenId = row.tokenId != null ? String(row.tokenId) : "";
          const contract = row.contractAddress != null ? String(row.contractAddress).toLowerCase() : "";
          const metaUrl = row.metadataUrl?.trim() ?? "";
          if (!tokenId || !contract || !metaUrl) {
            return { idx, row, staleUsed: false, cachedFailureSkip: false };
          }

          const fallbackName =
            (row.name && String(row.name).trim()) || `NFT #${tokenId}`;
          const resolved = await resolveCachedMeetAvatarMetadata({
            chainId: HERO_1155_CHAIN_ID,
            contractAddress: contract,
            tokenId,
            source: "marketplace",
            uriTemplate: metaUrl,
            idForUriSubstitution: 0n,
            fallbackName,
          });

          const merged: MarketplaceNftRow = { ...row };
          if (resolved.metadata?.image?.trim()) {
            merged.imageUrl = resolved.metadata.image.trim();
          }
          if (resolved.metadata?.name?.trim()) {
            merged.name = resolved.metadata.name.trim();
          }
          if (resolved.metadata?.description) {
            merged.description = resolved.metadata.description;
          }

          return {
            idx,
            row: merged,
            staleUsed: resolved.staleUsed,
            cachedFailureSkip: resolved.cachedFailureSkip,
          };
        }
      );

      for (const e of enrichedByIdx) {
        rows[e.idx] = e.row;
        staleFlags.push(e.staleUsed);
        failFlags.push(e.cachedFailureSkip);
      }

      if (staleFlags.some(Boolean)) {
        cacheWarnings.push({
          code: "metadata_cache_stale_used",
          message: "Some marketplace avatar images were served from cached metadata because live refresh failed.",
          source: "marketplace",
        });
      }
      if (failFlags.some(Boolean)) {
        cacheWarnings.push({
          code: "metadata_fetch_cached_failure",
          message:
            "Some marketplace tokens used a recent cached fetch failure; live refresh was skipped until the cache TTL expires.",
          source: "marketplace",
        });
      }
    }

    const items = rows.map((row, i) => normalizeMarketplaceRowToItem(normalizedAddress, row, i));
    return { items, ok: true, cacheWarnings };
  } catch (e) {
    console.error("[avatar-nfts] marketplace DB fetch failed:", e);
    return { items: [], ok: false, cacheWarnings: [] };
  }
}
