import { createPublicClient } from "viem";
import { fetchHero1155AvatarNfts } from "./fetch-hero";
import { resolveCachedMeetAvatarMetadata } from "./cache";
import { HERO_1155_CONTRACT, HERO_1155_CHAIN_ID } from "./constants";

jest.mock("viem", () => ({
  createPublicClient: jest.fn(),
  fallback: jest.fn((arr: unknown[]) => (Array.isArray(arr) ? arr[0] : arr)),
  http: jest.fn(() => ({})),
}));

jest.mock("./cache", () => ({
  resolveCachedMeetAvatarMetadata: jest.fn(),
}));

const WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;

describe("fetchHero1155AvatarNfts", () => {
  let readContract: jest.Mock;

  beforeEach(() => {
    readContract = jest.fn();
    (createPublicClient as jest.Mock).mockReturnValue({ readContract });
    jest.mocked(resolveCachedMeetAvatarMetadata).mockReset();
  });

  function stubBalanceAndUri() {
    readContract.mockImplementation(async ({ functionName, args }: { functionName: string; args: unknown[] }) => {
      if (functionName === "balanceOf") {
        const id = args[1] as bigint;
        return id === 0n ? 1n : 0n;
      }
      if (functionName === "uri") {
        return "ipfs://hero/{id}.json";
      }
      return null;
    });
  }

  it("resolves metadata through cache for owned token with uri", async () => {
    stubBalanceAndUri();
    jest.mocked(resolveCachedMeetAvatarMetadata).mockResolvedValue({
      metadata: {
        name: "Hero Zero",
        image: "https://img.example/h.png",
        description: null,
        animationUrl: null,
        externalUrl: null,
      },
      staleUsed: false,
      cachedFailureSkip: false,
    });

    const r = await fetchHero1155AvatarNfts(WALLET);

    expect(r.ok).toBe(true);
    expect(resolveCachedMeetAvatarMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: HERO_1155_CHAIN_ID,
        contractAddress: HERO_1155_CONTRACT,
        tokenId: "0",
        source: "hero_erc1155",
        uriTemplate: "ipfs://hero/{id}.json",
        idForUriSubstitution: 0n,
      })
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0].image).toBeTruthy();
    expect(r.metadataPartial).toBe(false);
  });

  it("emits metadata_cache_stale_used when cache layer serves stale success", async () => {
    stubBalanceAndUri();
    jest.mocked(resolveCachedMeetAvatarMetadata).mockResolvedValue({
      metadata: {
        name: "H",
        image: "https://stale.png",
        description: null,
        animationUrl: null,
        externalUrl: null,
      },
      staleUsed: true,
      cachedFailureSkip: false,
    });

    const r = await fetchHero1155AvatarNfts(WALLET);

    expect(r.cacheWarnings.some((w) => w.code === "metadata_cache_stale_used")).toBe(true);
    expect(r.items[0].image).toContain("stale");
  });

  it("emits metadata_fetch_cached_failure when cache suppresses refetch", async () => {
    stubBalanceAndUri();
    jest.mocked(resolveCachedMeetAvatarMetadata).mockResolvedValue({
      metadata: null,
      staleUsed: false,
      cachedFailureSkip: true,
    });

    const r = await fetchHero1155AvatarNfts(WALLET);

    expect(r.cacheWarnings.some((w) => w.code === "metadata_fetch_cached_failure")).toBe(true);
    expect(r.metadataPartial).toBe(true);
  });

  it("live miss with no stale fallback yields partial metadata and no stale warning", async () => {
    stubBalanceAndUri();
    jest.mocked(resolveCachedMeetAvatarMetadata).mockResolvedValue({
      metadata: null,
      staleUsed: false,
      cachedFailureSkip: false,
    });

    const r = await fetchHero1155AvatarNfts(WALLET);

    expect(r.metadataPartial).toBe(true);
    expect(r.items[0].selectable).toBe(false);
    expect(r.cacheWarnings.some((w) => w.code === "metadata_cache_stale_used")).toBe(false);
    expect(r.cacheWarnings.some((w) => w.code === "metadata_fetch_cached_failure")).toBe(false);
  });
});
