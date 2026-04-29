import {
  cacheRowToResolved,
  isMeetAvatarMetadataCacheFreshFailure,
  isMeetAvatarMetadataCacheFreshSuccess,
  isStaleSuccessWithinFallbackWindow,
  resolveCachedMeetAvatarMetadata,
  upsertMeetAvatarMetadataCacheSuccess,
} from "./cache";
import * as metadata from "./metadata";
import { MEET_AVATAR_METADATA_FAILURE_TTL_MS, MEET_AVATAR_METADATA_SUCCESS_TTL_MS } from "./cache-constants";
import { getDb } from "@/lib/db";

jest.mock("@/lib/db");

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;

function futureDate(ms: number) {
  return new Date(Date.now() + ms);
}
function pastDate(ms: number) {
  return new Date(Date.now() - ms);
}

describe("cache row classification", () => {
  const base = {
    id: "1",
    chainId: 137,
    contractAddress: "0xabc",
    tokenId: "0",
    source: "hero_erc1155" as const,
    metadataUrl: "ipfs://x/{id}.json",
    fetchError: null,
    rawMetadataJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    animationUrl: null,
    externalUrl: null,
  };

  it("fresh success cache is detected", () => {
    const row = {
      ...base,
      fetchStatus: "success" as const,
      name: "H",
      image: "https://img.png",
      description: null,
      fetchedAt: new Date(),
      expiresAt: futureDate(MEET_AVATAR_METADATA_SUCCESS_TTL_MS),
    };
    expect(isMeetAvatarMetadataCacheFreshSuccess(row)).toBe(true);
    expect(cacheRowToResolved(row)?.image).toBe("https://img.png");
  });

  it("fresh failure cache suppresses immediate refetch path", () => {
    const row = {
      ...base,
      fetchStatus: "failure" as const,
      name: null,
      image: null,
      description: null,
      fetchedAt: new Date(),
      expiresAt: futureDate(MEET_AVATAR_METADATA_FAILURE_TTL_MS),
      fetchError: "bad",
    };
    expect(isMeetAvatarMetadataCacheFreshFailure(row)).toBe(true);
  });

  it("stale success within 7d window", () => {
    const row = {
      ...base,
      fetchStatus: "success" as const,
      name: "H",
      image: "https://old.png",
      description: null,
      fetchedAt: pastDate(25 * 60 * 60 * 1000),
      expiresAt: pastDate(1000),
    };
    expect(isMeetAvatarMetadataCacheFreshSuccess(row, new Date())).toBe(false);
    expect(isStaleSuccessWithinFallbackWindow(row, new Date())).toBe(true);
  });

  it("stale success older than 7d is not in fallback window", () => {
    const row = {
      ...base,
      fetchStatus: "success" as const,
      name: "H",
      image: "https://old.png",
      description: null,
      fetchedAt: pastDate(8 * 24 * 60 * 60 * 1000),
      expiresAt: pastDate(7 * 24 * 60 * 60 * 1000),
    };
    expect(isStaleSuccessWithinFallbackWindow(row, new Date())).toBe(false);
  });
});

describe("resolveCachedMeetAvatarMetadata (mock db)", () => {
  let selectResult: unknown[] = [];
  const inserted: unknown[] = [];

  beforeEach(() => {
    selectResult = [];
    inserted.length = 0;
    jest.spyOn(metadata, "resolveUriToMetadata").mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function setupDbMock() {
    mockGetDb.mockImplementation(
      async () =>
        ({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve(selectResult),
              }),
            }),
          }),
          insert: () => ({
            values: (v: Record<string, unknown>) => {
              inserted.push(v);
              return {
                onDuplicateKeyUpdate: () => Promise.resolve(),
              };
            },
          }),
        }) as never
    );
  }

  it("fresh success cache hit uses DB row and skips live fetch", async () => {
    setupDbMock();
    selectResult = [
      {
        id: "x",
        chainId: 137,
        contractAddress: "0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a",
        tokenId: "0",
        source: "hero_erc1155",
        metadataUrl: "u",
        name: "Cached",
        image: "https://cached.png",
        animationUrl: null,
        externalUrl: null,
        description: null,
        rawMetadataJson: null,
        fetchStatus: "success",
        fetchError: null,
        fetchedAt: new Date(),
        expiresAt: futureDate(60_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const spy = jest.spyOn(metadata, "resolveUriToMetadata").mockResolvedValue(null);
    const r = await resolveCachedMeetAvatarMetadata({
      chainId: 137,
      contractAddress: "0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a",
      tokenId: "0",
      source: "hero_erc1155",
      uriTemplate: "ipfs://x",
      idForUriSubstitution: 0n,
      fallbackName: "Hero #0",
    });
    expect(r.metadata?.image).toBe("https://cached.png");
    expect(r.staleUsed).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fresh failure cache skips live fetch", async () => {
    setupDbMock();
    selectResult = [
      {
        id: "x",
        chainId: 137,
        contractAddress: "0xab",
        tokenId: "1",
        source: "marketplace",
        metadataUrl: "u",
        name: null,
        image: null,
        animationUrl: null,
        externalUrl: null,
        description: null,
        rawMetadataJson: null,
        fetchStatus: "failure",
        fetchError: "nope",
        fetchedAt: new Date(),
        expiresAt: futureDate(60_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const spy = jest.spyOn(metadata, "resolveUriToMetadata").mockResolvedValue({ name: "L", image: "x", description: null, animationUrl: null, externalUrl: null });
    const r = await resolveCachedMeetAvatarMetadata({
      chainId: 137,
      contractAddress: "0xab",
      tokenId: "1",
      source: "marketplace",
      uriTemplate: "https://meta.json",
      idForUriSubstitution: 0n,
      fallbackName: "NFT #1",
    });
    expect(r.metadata).toBeNull();
    expect(r.cachedFailureSkip).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it("success upsert writes normalized fields (via insert mock)", async () => {
    setupDbMock();
    selectResult = [];
    jest.spyOn(metadata, "resolveUriToMetadata").mockResolvedValue({
      name: "Live",
      image: "ipfs://QmX",
      description: "d",
      animationUrl: null,
      externalUrl: null,
    });
    await resolveCachedMeetAvatarMetadata({
      chainId: 137,
      contractAddress: "0xcc",
      tokenId: "2",
      source: "marketplace",
      uriTemplate: "https://json",
      idForUriSubstitution: 0n,
      fallbackName: "NFT",
    });
    expect(inserted.length).toBeGreaterThan(0);
    const v = inserted[0] as { fetchStatus: string; image: string };
    expect(v.fetchStatus).toBe("success");
    expect(v.image).toContain("gateway.pinata.cloud");
  });

  it("stale success + live fetch fail returns cached row within 7d window", async () => {
    setupDbMock();
    selectResult = [
      {
        id: "x",
        chainId: 137,
        contractAddress: "0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a",
        tokenId: "0",
        source: "hero_erc1155",
        metadataUrl: "u",
        name: "StaleName",
        image: "https://stale.png",
        animationUrl: null,
        externalUrl: null,
        description: null,
        rawMetadataJson: null,
        fetchStatus: "success",
        fetchError: null,
        fetchedAt: pastDate(25 * 60 * 60 * 1000),
        expiresAt: pastDate(60_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const spy = jest.spyOn(metadata, "resolveUriToMetadata").mockResolvedValue(null);
    const r = await resolveCachedMeetAvatarMetadata({
      chainId: 137,
      contractAddress: "0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a",
      tokenId: "0",
      source: "hero_erc1155",
      uriTemplate: "ipfs://x",
      idForUriSubstitution: 0n,
      fallbackName: "Hero #0",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(r.metadata?.name).toBe("StaleName");
    expect(r.metadata?.image).toBe("https://stale.png");
    expect(r.staleUsed).toBe(true);
    expect(r.cachedFailureSkip).toBe(false);
  });

  it("stale success older than 7d + live fail does not use cache; records failure", async () => {
    setupDbMock();
    selectResult = [
      {
        id: "x",
        chainId: 137,
        contractAddress: "0xab",
        tokenId: "9",
        source: "marketplace",
        metadataUrl: "u",
        name: "Old",
        image: "https://too-old.png",
        animationUrl: null,
        externalUrl: null,
        description: null,
        rawMetadataJson: null,
        fetchStatus: "success",
        fetchError: null,
        fetchedAt: pastDate(8 * 24 * 60 * 60 * 1000),
        expiresAt: pastDate(7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    jest.spyOn(metadata, "resolveUriToMetadata").mockResolvedValue(null);
    const r = await resolveCachedMeetAvatarMetadata({
      chainId: 137,
      contractAddress: "0xab",
      tokenId: "9",
      source: "marketplace",
      uriTemplate: "https://meta",
      idForUriSubstitution: 0n,
      fallbackName: "NFT",
    });
    expect(r.metadata).toBeNull();
    expect(r.staleUsed).toBe(false);
    const failureInsert = inserted.find((v) => (v as { fetchStatus: string }).fetchStatus === "failure");
    expect(failureInsert).toBeDefined();
  });
});

describe("upsertMeetAvatarMetadataCacheSuccess unique key", () => {
  let selectResult: unknown[] = [];
  const updates: unknown[] = [];

  beforeEach(() => {
    selectResult = [];
    updates.length = 0;
  });

  it("onDuplicateKeyUpdate path runs when row exists", async () => {
    selectResult = [
      {
        id: "existing-id",
        chainId: 137,
        contractAddress: "0xdd",
        tokenId: "3",
        source: "hero_erc1155",
        metadataUrl: null,
        name: "Old",
        image: "https://old",
        animationUrl: null,
        externalUrl: null,
        description: null,
        rawMetadataJson: null,
        fetchStatus: "success",
        fetchError: null,
        fetchedAt: new Date(),
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockGetDb.mockImplementation(
      async () =>
        ({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve(selectResult),
              }),
            }),
          }),
          insert: () => ({
            values: () => ({
              onDuplicateKeyUpdate: (opts: { set: Record<string, unknown> }) => {
                updates.push(opts.set);
                return Promise.resolve();
              },
            }),
          }),
        }) as never
    );

    await upsertMeetAvatarMetadataCacheSuccess({
      chainId: 137,
      contractAddress: "0xdd",
      tokenId: "3",
      source: "hero_erc1155",
      metadataUrl: "u",
      metadata: {
        name: "New",
        image: "https://new.png",
        description: null,
        animationUrl: null,
        externalUrl: null,
      },
    });
    expect(updates.length).toBe(1);
    expect((updates[0] as { name: string }).name).toBe("New");
  });
});
