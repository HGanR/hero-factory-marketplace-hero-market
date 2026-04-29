/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import {
  classifyEphemeralBentleyImageUrl,
  maybeUpgradeBentleyCampaignAssetToDurableStorage,
  resolveAssetDurableBadge,
  readBentleyDurableImageUpgradeEnv,
} from "@/lib/revenue-os/bentley-campaign-asset-durable";
import * as Pinata from "@/lib/marketplace/pinata";

jest.mock("@/lib/marketplace/pinata", () => ({
  uploadFileToIPFS: jest.fn(),
  getIPFSUrl: jest.fn((hash: string) => `https://gateway.pinata.cloud/ipfs/${hash}`),
}));

const mockUpload = jest.mocked(Pinata.uploadFileToIPFS);
const mockGateway = jest.mocked(Pinata.getIPFSUrl);

describe("classifyEphemeralBentleyImageUrl", () => {
  it("detects OpenAI blob URLs", () => {
    expect(
      classifyEphemeralBentleyImageUrl(
        "https://oaidalleapiprodscus.blob.core.windows.net/private/xyz.png"
      )
    ).toBe("openai");
  });

  it("detects Picsum", () => {
    expect(classifyEphemeralBentleyImageUrl("https://picsum.photos/seed/ab/1080/1080")).toBe("picsum");
  });

  it("returns null for IPFS gateway", () => {
    expect(classifyEphemeralBentleyImageUrl("https://gateway.pinata.cloud/ipfs/QmX")).toBe(null);
  });
});

describe("resolveAssetDurableBadge", () => {
  it("marks ephemeral as temporary", () => {
    expect(
      resolveAssetDurableBadge("https://picsum.photos/seed/x/1/1", { source: "bentley_auto" })
    ).toBe("temporary");
  });

  it("marks completed upgrade as stored", () => {
    expect(
      resolveAssetDurableBadge("https://gateway.pinata.cloud/ipfs/QmY", {
        durableUpgrade: "complete",
        storage: "pinata",
      })
    ).toBe("stored");
  });
});

describe("maybeUpgradeBentleyCampaignAssetToDurableStorage", () => {
  const origJwt = process.env.PINATA_JWT;
  const origSkip = process.env.BENTLEY_SKIP_DURABLE_IMAGE_UPGRADE;

  beforeEach(() => {
    process.env.PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.sig";
    delete process.env.BENTLEY_SKIP_DURABLE_IMAGE_UPGRADE;
    mockUpload.mockResolvedValue({ ipfsHash: "QmTestHash", ipfsUrl: "ipfs://QmTestHash" });
    mockGateway.mockReturnValue("https://gateway.pinata.cloud/ipfs/QmTestHash");
    const pngLike = new Uint8Array(64);
    pngLike.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "image/png" },
      arrayBuffer: async () => pngLike.buffer,
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env.PINATA_JWT = origJwt;
    process.env.BENTLEY_SKIP_DURABLE_IMAGE_UPGRADE = origSkip;
    jest.clearAllMocks();
  });

  it("upgrades OpenAI ephemeral URL to Pinata gateway", async () => {
    const row = {
      id: "asset-1",
      campaignId: "camp-1",
      storageUrl: "https://oaidalleapiprodscus.blob.core.windows.net/x/o.png",
      metadata: { source: "bentley_auto" },
    };
    const state = { row: { ...row, metadata: { ...row.metadata } as Record<string, unknown> } };
    const db = {
      update: () => ({
        set: (vals: Record<string, unknown>) => ({
          where: async () => {
            state.row = {
              ...state.row,
              storageUrl: String(vals.storageUrl ?? state.row.storageUrl),
              metadata: vals.metadata as Record<string, unknown>,
            };
          },
        }),
      }),
    };

    const r = await maybeUpgradeBentleyCampaignAssetToDurableStorage(db as never, row);
    expect(r.status).toBe("upgraded");
    if (r.status === "upgraded") {
      expect(r.durableHttpsUrl).toContain("gateway.pinata.cloud/ipfs/");
    }
    expect(mockUpload).toHaveBeenCalled();
    const meta = state.row.metadata as Record<string, unknown>;
    expect(meta.durableUpgrade).toBe("complete");
    expect(meta.upgradedFrom).toBe("openai");
    expect(meta.storage).toBe("pinata");
    expect(state.row.storageUrl).toContain("gateway.pinata.cloud/ipfs/");
  });

  it("upgrades Picsum URL", async () => {
    const row = {
      id: "asset-2",
      campaignId: "camp-1",
      storageUrl: "https://picsum.photos/seed/zz/100/100",
      metadata: { source: "bentley_auto" },
    };
    const db = {
      update: () => ({
        set: () => ({
          where: async () => {},
        }),
      }),
    };
    const r = await maybeUpgradeBentleyCampaignAssetToDurableStorage(db as never, row);
    expect(r.status).toBe("upgraded");
  });

  it("preserves original URL when upload fails", async () => {
    mockUpload.mockRejectedValueOnce(new Error("pinata down"));
    const row = {
      id: "asset-3",
      campaignId: "camp-1",
      storageUrl: "https://picsum.photos/seed/qq/10/10",
      metadata: { source: "bentley_auto" },
    };
    const db = {
      update: () => ({
        set: () => ({
          where: async () => {
            throw new Error("should not persist");
          },
        }),
      }),
    };
    const r = await maybeUpgradeBentleyCampaignAssetToDurableStorage(db as never, row);
    expect(r.status).toBe("failed");
  });

  it("does not overwrite manual / non-Bentley assets", async () => {
    const row = {
      id: "asset-4",
      campaignId: "camp-1",
      storageUrl: "https://picsum.photos/seed/manual/10/10",
      metadata: { source: "social_studio" },
    };
    const db = { update: () => ({ set: () => ({ where: async () => {} }) }) };
    const r = await maybeUpgradeBentleyCampaignAssetToDurableStorage(db as never, row);
    expect(r.status).toBe("skipped");
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("skips duplicate upgrade when already complete", async () => {
    const row = {
      id: "asset-5",
      campaignId: "camp-1",
      storageUrl: "https://picsum.photos/seed/dup/10/10",
      metadata: { source: "bentley_auto", durableUpgrade: "complete" },
    };
    const db = { update: () => ({ set: () => ({ where: async () => {} }) }) };
    const r = await maybeUpgradeBentleyCampaignAssetToDurableStorage(db as never, row);
    expect(r.status).toBe("skipped");
    if (r.status === "skipped") expect(r.reason).toBe("already_upgraded");
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("skips when BENTLEY_SKIP_DURABLE_IMAGE_UPGRADE is set", async () => {
    process.env.BENTLEY_SKIP_DURABLE_IMAGE_UPGRADE = "1";
    expect(readBentleyDurableImageUpgradeEnv()).toBe(false);
    const row = {
      id: "asset-6",
      campaignId: "camp-1",
      storageUrl: "https://picsum.photos/seed/skip/10/10",
      metadata: { source: "bentley_auto" },
    };
    const db = { update: () => ({ set: () => ({ where: async () => {} }) }) };
    const r = await maybeUpgradeBentleyCampaignAssetToDurableStorage(db as never, row);
    expect(r.status).toBe("skipped");
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
