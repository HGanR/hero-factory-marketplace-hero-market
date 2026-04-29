import { fetchMarketplaceAvatarNfts } from "./fetch-marketplace";
import { fetchHero1155AvatarNfts } from "./fetch-hero";
import {
  dedupeAvatarItems,
  sortAvatarItems,
  renumberSortOrder,
  applyLimitWithTruncation,
} from "./merge";
import type { MeetAvatarNftItem, MeetAvatarNftWarning, MeetAvatarNftsResponse } from "./types";

export type GetMeetAvatarNftsParams = {
  walletAddress: string;
  walletType: "evm" | "phantom";
  limit: number;
  includeHero: boolean;
  includeMarketplace: boolean;
};

export async function getMeetAvatarNfts(params: GetMeetAvatarNftsParams): Promise<MeetAvatarNftsResponse> {
  const { walletAddress, walletType, limit, includeHero, includeMarketplace } = params;

  if (walletType === "phantom") {
    return {
      items: [],
      warnings: [
        {
          code: "solana_unsupported",
          message: "Solana wallet NFT avatars are not supported in Meet.",
          source: "solana",
        },
      ],
      partialFailure: false,
      sourcesAttempted: [],
      sourcesSucceeded: [],
      solanaAvatarUnsupported: true,
      truncated: false,
      limit,
    };
  }

  const warnings: MeetAvatarNftWarning[] = [];
  const pushWarningUnique = (w: MeetAvatarNftWarning) => {
    if (!warnings.some((x) => x.code === w.code)) warnings.push(w);
  };
  const sourcesAttempted: Array<"marketplace" | "hero"> = [];
  const sourcesSucceeded: Array<"marketplace" | "hero"> = [];
  const rawItems: MeetAvatarNftItem[] = [];

  if (includeMarketplace) {
    sourcesAttempted.push("marketplace");
    const m = await fetchMarketplaceAvatarNfts(walletAddress);
    if (m.ok) {
      sourcesSucceeded.push("marketplace");
      rawItems.push(...m.items);
      for (const w of m.cacheWarnings ?? []) pushWarningUnique(w);
    } else {
      pushWarningUnique({
        code: "marketplace_fetch_failed",
        message: "Could not load marketplace wallet NFTs from the database.",
        source: "marketplace",
      });
    }
  }

  if (includeHero) {
    sourcesAttempted.push("hero");
    const addr = walletAddress.startsWith("0x") ? (walletAddress as `0x${string}`) : null;
    if (!addr) {
      pushWarningUnique({
        code: "hero_fetch_failed",
        message: "Hero on-chain lookup requires an EVM 0x address.",
        source: "hero",
      });
    } else {
      const h = await fetchHero1155AvatarNfts(addr);
      if (h.ok) {
        sourcesSucceeded.push("hero");
        rawItems.push(...h.items);
        for (const w of h.cacheWarnings ?? []) pushWarningUnique(w);
        if (h.metadataPartial) {
          pushWarningUnique({
            code: "hero_metadata_partial",
            message: "Some Hero tokens are missing full metadata or image URLs.",
            source: "hero",
          });
        }
      } else {
        pushWarningUnique({
          code: "hero_fetch_failed",
          message: "Could not load Hero ERC-1155 balances or metadata from Polygon.",
          source: "hero",
        });
      }
    }
  }

  const deduped = dedupeAvatarItems(rawItems);
  const sorted = sortAvatarItems(deduped);
  const numbered = renumberSortOrder(sorted);
  const { items: limited, truncated, warning: truncWarn } = applyLimitWithTruncation(numbered, limit);
  if (truncWarn) pushWarningUnique(truncWarn);

  const partialFailure =
    sourcesAttempted.length > 0 && sourcesSucceeded.length !== sourcesAttempted.length;

  return {
    items: limited,
    warnings,
    partialFailure,
    sourcesAttempted,
    sourcesSucceeded,
    solanaAvatarUnsupported: false,
    truncated,
    limit,
  };
}
