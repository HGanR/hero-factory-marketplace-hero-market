import { getDb } from "@/lib/db";
import { fetchMarketplaceAvatarNfts } from "./fetch-marketplace";
import { resolveCachedMeetAvatarMetadata } from "./cache";
import { HERO_1155_CHAIN_ID } from "./constants";

jest.mock("@/lib/db");
jest.mock("./cache", () => ({
  resolveCachedMeetAvatarMetadata: jest.fn(),
}));

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;

describe("fetchMarketplaceAvatarNfts", () => {
  beforeEach(() => {
    jest.mocked(resolveCachedMeetAvatarMetadata).mockReset();
  });

  function mockWalletRows(rows: Record<string, unknown>[]) {
    mockGetDb.mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(rows),
        }),
      }),
    } as never);
  }

  it("calls cache resolver when metadataUrl present and image missing", async () => {
    mockWalletRows([
      {
        tokenId: "5",
        name: "Listed",
        description: null,
        imageUrl: "",
        contractAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        chain: "polygon",
        metadataUrl: "https://api.example/meta/5",
      },
    ]);
    jest.mocked(resolveCachedMeetAvatarMetadata).mockResolvedValue({
      metadata: {
        name: "Enriched",
        image: "ipfs://QmEnriched",
        description: "d",
        animationUrl: null,
        externalUrl: null,
      },
      staleUsed: false,
      cachedFailureSkip: false,
    });

    const r = await fetchMarketplaceAvatarNfts("0xcccccccccccccccccccccccccccccccccccccccc");

    expect(r.ok).toBe(true);
    expect(resolveCachedMeetAvatarMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: HERO_1155_CHAIN_ID,
        contractAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        tokenId: "5",
        source: "marketplace",
        uriTemplate: "https://api.example/meta/5",
      })
    );
    expect(r.items[0].name).toBe("Enriched");
    expect(r.items[0].image).toBeTruthy();
  });

  it("triggers enrichment for placeholder-like image and surfaces stale cache warning", async () => {
    mockWalletRows([
      {
        tokenId: "1",
        name: "P",
        description: null,
        imageUrl: "https://via.placeholder.com/1",
        contractAddress: "0xdddddddddddddddddddddddddddddddddddddddd",
        chain: "polygon",
        metadataUrl: "https://m.json",
      },
    ]);
    jest.mocked(resolveCachedMeetAvatarMetadata).mockResolvedValue({
      metadata: {
        name: "P",
        image: "https://real.png",
        description: null,
        animationUrl: null,
        externalUrl: null,
      },
      staleUsed: true,
      cachedFailureSkip: false,
    });

    const r = await fetchMarketplaceAvatarNfts("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");

    expect(resolveCachedMeetAvatarMetadata).toHaveBeenCalled();
    expect(r.cacheWarnings.some((w) => w.code === "metadata_cache_stale_used")).toBe(true);
  });

  it("complete metadata miss with cached failure emits metadata_fetch_cached_failure", async () => {
    mockWalletRows([
      {
        tokenId: "2",
        name: "N",
        description: null,
        imageUrl: "",
        contractAddress: "0xffffffffffffffffffffffffffffffffffffffff",
        chain: "polygon",
        metadataUrl: "ipfs://bad",
      },
    ]);
    jest.mocked(resolveCachedMeetAvatarMetadata).mockResolvedValue({
      metadata: null,
      staleUsed: false,
      cachedFailureSkip: true,
    });

    const r = await fetchMarketplaceAvatarNfts("0x1111111111111111111111111111111111111111");

    expect(r.cacheWarnings.some((w) => w.code === "metadata_fetch_cached_failure")).toBe(true);
  });

  it("skips cache when row already has non-placeholder image", async () => {
    mockWalletRows([
      {
        tokenId: "3",
        name: "HasImg",
        description: null,
        imageUrl: "https://cdn.example/a.png",
        contractAddress: "0x2222222222222222222222222222222222222222",
        chain: "polygon",
        metadataUrl: "https://ignored.json",
      },
    ]);

    const r = await fetchMarketplaceAvatarNfts("0x3333333333333333333333333333333333333333");

    expect(resolveCachedMeetAvatarMetadata).not.toHaveBeenCalled();
    expect(r.items[0].image).toContain("cdn.example");
  });
});
