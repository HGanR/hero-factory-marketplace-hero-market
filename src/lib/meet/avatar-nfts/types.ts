export type MeetAvatarNftSource = "marketplace" | "hero_erc1155";

export type MeetAvatarNftWarningCode =
  | "marketplace_fetch_failed"
  | "hero_fetch_failed"
  | "hero_metadata_partial"
  | "solana_unsupported"
  | "results_truncated"
  | "metadata_cache_stale_used"
  | "metadata_fetch_cached_failure";

export interface MeetAvatarNftItem {
  id: string;
  source: MeetAvatarNftSource;
  chainId: number | null;
  walletAddress: string;
  walletType: "evm" | "phantom";
  contractAddress: string | null;
  tokenId: string | null;
  collectionName: string | null;
  name: string;
  image: string | null;
  animationUrl: string | null;
  externalUrl: string | null;
  description: string | null;
  balance: string | null;
  isHero: boolean;
  heroSlot: number | null;
  selectable: boolean;
  selectableReason: string | null;
  sortOrder: number;
}

export interface MeetAvatarNftWarning {
  code: MeetAvatarNftWarningCode;
  message: string;
  source: "marketplace" | "hero" | "solana";
}

export interface MeetAvatarNftsResponse {
  items: MeetAvatarNftItem[];
  warnings: MeetAvatarNftWarning[];
  partialFailure: boolean;
  sourcesAttempted: Array<"marketplace" | "hero">;
  sourcesSucceeded: Array<"marketplace" | "hero">;
  solanaAvatarUnsupported: boolean;
  truncated: boolean;
  limit: number;
}
