import type { MeetAvatarNftItem, MeetAvatarNftSource } from "./types";
import { HERO_1155_CHAIN_ID, HERO_1155_CONTRACT } from "./constants";
import { normalizeIpfsToHttp } from "./metadata";

function stableId(
  source: MeetAvatarNftSource,
  chainId: number | null,
  contractAddress: string | null,
  tokenId: string | null
): string {
  const c = contractAddress?.toLowerCase() ?? "unknown";
  const t = tokenId ?? "unknown";
  const ch = chainId ?? "null";
  return `${source}:${ch}:${c}:${t}`;
}

/** Raw row from marketplace DB (wallet-nfts shape). */
export type MarketplaceNftRow = {
  tokenId?: string | null;
  name?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  image?: string | null;
  contractAddress?: string | null;
  chain?: string | null;
  metadataUrl?: string | null;
};

export function normalizeMarketplaceRowToItem(
  walletAddress: string,
  row: MarketplaceNftRow,
  sortOrderSeed: number
): MeetAvatarNftItem {
  const tokenId = row.tokenId != null ? String(row.tokenId) : null;
  const contractAddress =
    row.contractAddress != null ? String(row.contractAddress).toLowerCase() : null;
  const rawImg = String(row.imageUrl ?? row.image ?? "").trim();
  const image = rawImg ? normalizeIpfsToHttp(rawImg) : null;
  const name =
    (row.name && String(row.name).trim()) ||
    (tokenId != null ? `NFT #${tokenId}` : "NFT");

  const selectable = Boolean(image);
  return {
    id: stableId("marketplace", HERO_1155_CHAIN_ID, contractAddress, tokenId),
    source: "marketplace",
    chainId: HERO_1155_CHAIN_ID,
    walletAddress: walletAddress.toLowerCase(),
    walletType: "evm",
    contractAddress,
    tokenId,
    collectionName: null,
    name,
    image,
    animationUrl: null,
    externalUrl: null,
    description: row.description != null ? String(row.description) : null,
    balance: "1",
    isHero: false,
    heroSlot: null,
    selectable,
    selectableReason: selectable ? null : "No image URL in marketplace record",
    sortOrder: sortOrderSeed,
  };
}

export function normalizeHero1155ToItem(
  walletAddress: string,
  tokenId: bigint,
  balance: bigint,
  meta: {
    name: string;
    image: string | null;
    description: string | null;
    animationUrl: string | null;
    externalUrl: string | null;
  } | null,
  options: { metadataPartial: boolean; sortOrderSeed: number }
): MeetAvatarNftItem {
  const tid = tokenId.toString();
  const contractAddress = HERO_1155_CONTRACT.toLowerCase();
  const fallbackName = `Hero #${tid}`;
  const name = meta?.name?.trim() || fallbackName;
  const image = meta?.image ? normalizeIpfsToHttp(meta.image) : null;
  const selectable = Boolean(image);
  const heroSlot = Number(tokenId);

  let selectableReason: string | null = null;
  if (!selectable) {
    selectableReason = options.metadataPartial
      ? "Hero metadata did not include a usable image"
      : "No image resolved";
  }

  return {
    id: stableId("hero_erc1155", HERO_1155_CHAIN_ID, contractAddress, tid),
    source: "hero_erc1155",
    chainId: HERO_1155_CHAIN_ID,
    walletAddress: walletAddress.toLowerCase(),
    walletType: "evm",
    contractAddress,
    tokenId: tid,
    collectionName: "Hero",
    name,
    image,
    animationUrl: meta?.animationUrl ? normalizeIpfsToHttp(meta.animationUrl) : null,
    externalUrl: meta?.externalUrl,
    description: meta?.description,
    balance: balance.toString(),
    isHero: true,
    heroSlot: Number.isFinite(heroSlot) ? heroSlot : null,
    selectable,
    selectableReason,
    sortOrder: options.sortOrderSeed,
  };
}
