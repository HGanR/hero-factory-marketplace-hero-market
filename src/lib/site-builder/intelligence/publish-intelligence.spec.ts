import * as siteBuilderDb from "@/lib/site-builder/db";
import { markLatestSiteGenerationRunPublished } from "@/lib/site-builder/intelligence/publish-intelligence";

describe("markLatestSiteGenerationRunPublished", () => {
  beforeEach(() => {
    jest.spyOn(siteBuilderDb, "ensureSiteBuilderIntelligenceTables").mockResolvedValue(undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns true after SELECT id + UPDATE when a latest run exists", async () => {
    const db = {
      execute: jest
        .fn()
        .mockResolvedValueOnce([[{ id: "run-latest" }], []])
        .mockResolvedValueOnce([[], []]),
    } as never;
    const ok = await markLatestSiteGenerationRunPublished(db, {
      userId: 42,
      siteId: "550e8400-e29b-41d4-a716-446655440001",
      publishedVersionId: "ver-9",
      deployedUrl: "https://gateway.pinata.cloud/ipfs/QmTest",
    });
    expect(ok).toBe(true);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it("returns false when no intelligence run matches site", async () => {
    const db = {
      execute: jest.fn().mockResolvedValueOnce([[], []]),
    } as never;
    const ok = await markLatestSiteGenerationRunPublished(db, {
      userId: 1,
      siteId: "550e8400-e29b-41d4-a716-446655440002",
      publishedVersionId: null,
      deployedUrl: null,
    });
    expect(ok).toBe(false);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});
