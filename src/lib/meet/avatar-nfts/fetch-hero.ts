import { createPublicClient, fallback, http } from "viem";
import { polygon } from "viem/chains";
import {
  ERC1155_BALANCE_URI_ABI,
  HERO_1155_CONTRACT,
  HERO_1155_TOKEN_IDS,
  HERO_1155_CHAIN_ID,
  POLYGON_RPC_CANDIDATES,
} from "./constants";
import { normalizeHero1155ToItem } from "./normalize";
import type { MeetAvatarNftItem } from "./types";
import type { MeetAvatarNftWarning } from "./types";
import { resolveCachedMeetAvatarMetadata } from "./cache";
import { mapWithConcurrency } from "./concurrency";
import { MEET_AVATAR_METADATA_FETCH_CONCURRENCY } from "./cache-constants";

export type FetchHeroResult = {
  items: MeetAvatarNftItem[];
  ok: boolean;
  metadataPartial: boolean;
  cacheWarnings: MeetAvatarNftWarning[];
};

function publicClient() {
  return createPublicClient({
    chain: polygon,
    transport: fallback(POLYGON_RPC_CANDIDATES.map((url) => http(url))),
  });
}

type OwnedTask = { id: bigint; balance: bigint; index: number };

export async function fetchHero1155AvatarNfts(walletAddress: `0x${string}`): Promise<FetchHeroResult> {
  const client = publicClient();

  const owned: OwnedTask[] = [];
  try {
    for (let i = 0; i < HERO_1155_TOKEN_IDS.length; i++) {
      const id = HERO_1155_TOKEN_IDS[i];
      let balance = 0n;
      try {
        balance = (await client.readContract({
          address: HERO_1155_CONTRACT,
          abi: ERC1155_BALANCE_URI_ABI,
          functionName: "balanceOf",
          args: [walletAddress, id],
        })) as bigint;
      } catch {
        return { items: [], ok: false, metadataPartial: false, cacheWarnings: [] as MeetAvatarNftWarning[] };
      }
      if (balance > 0n) owned.push({ id, balance, index: i });
    }
  } catch (e) {
    console.error("[avatar-nfts] hero fetch unexpected:", e);
    return { items: [], ok: false, metadataPartial: false, cacheWarnings: [] as MeetAvatarNftWarning[] };
  }

  const results = await mapWithConcurrency(
    owned,
    MEET_AVATAR_METADATA_FETCH_CONCURRENCY,
    async (t) => {
      let uriResult = "";
      try {
        uriResult = (await client.readContract({
          address: HERO_1155_CONTRACT,
          abi: ERC1155_BALANCE_URI_ABI,
          functionName: "uri",
          args: [t.id],
        })) as string;
      } catch {
        return {
          item: normalizeHero1155ToItem(walletAddress, t.id, t.balance, null, {
            metadataPartial: true,
            sortOrderSeed: 100 + t.index,
          }),
          metadataPartial: true,
          staleUsed: false,
          cachedFailureSkip: false,
        };
      }

      if (!uriResult?.trim()) {
        return {
          item: normalizeHero1155ToItem(walletAddress, t.id, t.balance, null, {
            metadataPartial: true,
            sortOrderSeed: 100 + t.index,
          }),
          metadataPartial: true,
          staleUsed: false,
          cachedFailureSkip: false,
        };
      }

      const resolved = await resolveCachedMeetAvatarMetadata({
        chainId: HERO_1155_CHAIN_ID,
        contractAddress: HERO_1155_CONTRACT,
        tokenId: t.id.toString(),
        source: "hero_erc1155",
        uriTemplate: uriResult,
        idForUriSubstitution: t.id,
        fallbackName: `Hero #${t.id}`,
      });

      const meta = resolved.metadata;
      const partial = Boolean(!meta?.image);
      return {
        item: normalizeHero1155ToItem(walletAddress, t.id, t.balance, meta, {
          metadataPartial: partial,
          sortOrderSeed: 100 + t.index,
        }),
        metadataPartial: partial,
        staleUsed: resolved.staleUsed,
        cachedFailureSkip: resolved.cachedFailureSkip,
      };
    }
  );

  const items = results.map((r) => r.item);
  const metadataPartial = results.some((r) => r.metadataPartial);

  const cacheWarnings: MeetAvatarNftWarning[] = [];
  if (results.some((r) => r.staleUsed)) {
    cacheWarnings.push({
      code: "metadata_cache_stale_used",
      message: "Some Hero avatar images were served from cached metadata because live refresh failed.",
      source: "hero",
    });
  }
  if (results.some((r) => r.cachedFailureSkip)) {
    cacheWarnings.push({
      code: "metadata_fetch_cached_failure",
      message:
        "Some Hero tokens used a recent cached fetch failure; live refresh was skipped until the cache TTL expires.",
      source: "hero",
    });
  }

  return { items, ok: true, metadataPartial, cacheWarnings };
}
