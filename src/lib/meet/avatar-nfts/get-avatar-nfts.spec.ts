import { getMeetAvatarNfts } from "./get-avatar-nfts";
import { fetchMarketplaceAvatarNfts } from "./fetch-marketplace";
import { fetchHero1155AvatarNfts } from "./fetch-hero";
import type { MeetAvatarNftItem } from "./types";
import { HERO_1155_CONTRACT, HERO_1155_CHAIN_ID } from "./constants";

jest.mock("./fetch-marketplace");
jest.mock("./fetch-hero");

const mockMarketplace = fetchMarketplaceAvatarNfts as jest.MockedFunction<typeof fetchMarketplaceAvatarNfts>;
const mockHero = fetchHero1155AvatarNfts as jest.MockedFunction<typeof fetchHero1155AvatarNfts>;

const heroC = HERO_1155_CONTRACT.toLowerCase();

function mk(p: Partial<MeetAvatarNftItem> & Pick<MeetAvatarNftItem, "id" | "source" | "name">): MeetAvatarNftItem {
  return {
    chainId: HERO_1155_CHAIN_ID,
    walletAddress: "0xabc",
    walletType: "evm",
    contractAddress: heroC,
    tokenId: "0",
    collectionName: null,
    image: "https://img.png",
    animationUrl: null,
    externalUrl: null,
    description: null,
    balance: "1",
    isHero: p.source === "hero_erc1155",
    heroSlot: p.source === "hero_erc1155" ? 0 : null,
    selectable: true,
    selectableReason: null,
    sortOrder: 0,
    ...p,
  } as MeetAvatarNftItem;
}

describe("getMeetAvatarNfts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Phantom: empty items + solana_unsupported", async () => {
    const r = await getMeetAvatarNfts({
      walletAddress: "SoL",
      walletType: "phantom",
      limit: 20,
      includeHero: true,
      includeMarketplace: true,
    });
    expect(r.items).toEqual([]);
    expect(r.solanaAvatarUnsupported).toBe(true);
    expect(r.partialFailure).toBe(false);
    expect(r.warnings.some((w) => w.code === "solana_unsupported")).toBe(true);
    expect(mockMarketplace).not.toHaveBeenCalled();
    expect(mockHero).not.toHaveBeenCalled();
  });

  it("EVM: marketplace + Hero success", async () => {
    mockMarketplace.mockResolvedValue({
      ok: true,
      items: [mk({ id: "m:1", source: "marketplace", name: "M", tokenId: "99", contractAddress: "0x99" })],
      cacheWarnings: [],
    });
    mockHero.mockResolvedValue({
      items: [mk({ id: "h:0", source: "hero_erc1155", name: "H" })],
      ok: true,
      metadataPartial: false,
      cacheWarnings: [],
    });
    const r = await getMeetAvatarNfts({
      walletAddress: "0xabc",
      walletType: "evm",
      limit: 20,
      includeHero: true,
      includeMarketplace: true,
    });
    expect(r.partialFailure).toBe(false);
    expect(r.sourcesSucceeded).toEqual(["marketplace", "hero"]);
    expect(r.items.length).toBe(2);
  });

  it("EVM: marketplace fails + Hero succeeds", async () => {
    mockMarketplace.mockResolvedValue({ ok: false, items: [], cacheWarnings: [] });
    mockHero.mockResolvedValue({
      items: [mk({ id: "h:0", source: "hero_erc1155", name: "H" })],
      ok: true,
      metadataPartial: false,
      cacheWarnings: [],
    });
    const r = await getMeetAvatarNfts({
      walletAddress: "0xabc",
      walletType: "evm",
      limit: 20,
      includeHero: true,
      includeMarketplace: true,
    });
    expect(r.partialFailure).toBe(true);
    expect(r.warnings.some((w) => w.code === "marketplace_fetch_failed")).toBe(true);
    expect(r.items.length).toBeGreaterThanOrEqual(1);
  });

  it("EVM: Hero fails + marketplace succeeds", async () => {
    mockMarketplace.mockResolvedValue({
      ok: true,
      items: [mk({ id: "m:1", source: "marketplace", name: "M", tokenId: "1", contractAddress: "0xaa" })],
      cacheWarnings: [],
    });
    mockHero.mockResolvedValue({ items: [], ok: false, metadataPartial: false, cacheWarnings: [] });
    const r = await getMeetAvatarNfts({
      walletAddress: "0xabc",
      walletType: "evm",
      limit: 20,
      includeHero: true,
      includeMarketplace: true,
    });
    expect(r.partialFailure).toBe(true);
    expect(r.warnings.some((w) => w.code === "hero_fetch_failed")).toBe(true);
    expect(r.items.length).toBe(1);
  });

  it("truncation warning when over limit", async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      mk({
        id: `m:${i}`,
        source: "marketplace",
        name: `N${i}`,
        tokenId: `${i}`,
        contractAddress: `0x${(1000 + i).toString(16)}`,
      })
    );
    mockMarketplace.mockResolvedValue({ ok: true, items: many, cacheWarnings: [] });
    mockHero.mockResolvedValue({ items: [], ok: true, metadataPartial: false, cacheWarnings: [] });
    const r = await getMeetAvatarNfts({
      walletAddress: "0xabc",
      walletType: "evm",
      limit: 5,
      includeHero: false,
      includeMarketplace: true,
    });
    expect(r.truncated).toBe(true);
    expect(r.items.length).toBe(5);
    expect(r.warnings.some((w) => w.code === "results_truncated")).toBe(true);
  });

  it("dedupe prefers Hero row for same NFT key", async () => {
    mockMarketplace.mockResolvedValue({
      ok: true,
      items: [
        mk({
          id: "m",
          source: "marketplace",
          name: "Listed",
          tokenId: "0",
          contractAddress: heroC,
          image: "https://m.png",
        }),
      ],
      cacheWarnings: [],
    });
    mockHero.mockResolvedValue({
      items: [
        mk({
          id: "h",
          source: "hero_erc1155",
          name: "Hero #0",
          tokenId: "0",
          contractAddress: heroC,
          image: "https://h.png",
        }),
      ],
      ok: true,
      metadataPartial: false,
      cacheWarnings: [],
    });
    const r = await getMeetAvatarNfts({
      walletAddress: "0xabc",
      walletType: "evm",
      limit: 20,
      includeHero: true,
      includeMarketplace: true,
    });
    const token0 = r.items.filter((i) => i.tokenId === "0" && (i.contractAddress ?? "").toLowerCase() === heroC);
    expect(token0).toHaveLength(1);
    expect(token0[0].source).toBe("hero_erc1155");
  });

  it("merges cache warnings once per code (hero + marketplace)", async () => {
    const w = {
      code: "metadata_cache_stale_used" as const,
      message: "stale",
      source: "hero" as const,
    };
    mockMarketplace.mockResolvedValue({
      ok: true,
      items: [mk({ id: "m:1", source: "marketplace", name: "M", tokenId: "9", contractAddress: "0x99" })],
      cacheWarnings: [w],
    });
    mockHero.mockResolvedValue({
      items: [mk({ id: "h:0", source: "hero_erc1155", name: "H" })],
      ok: true,
      metadataPartial: false,
      cacheWarnings: [w],
    });
    const r = await getMeetAvatarNfts({
      walletAddress: "0xabc",
      walletType: "evm",
      limit: 20,
      includeHero: true,
      includeMarketplace: true,
    });
    expect(r.warnings.filter((x) => x.code === "metadata_cache_stale_used")).toHaveLength(1);
  });
});
