/**
 * @jest-environment node
 */

import { fetchInstagramPostPerformanceSnapshot } from "@/lib/social/adapters/instagram-post-performance";
import { normalizePlatformPerformanceSnapshot } from "@/lib/social/sync-platform-post-performance";

describe("fetchInstagramPostPerformanceSnapshot", () => {
  const origFetch = global.fetch;

  afterEach(() => {
    global.fetch = origFetch;
    jest.resetAllMocks();
  });

  it("returns error for non-numeric external post id (missing remote id)", async () => {
    const r = await fetchInstagramPostPerformanceSnapshot({
      accessToken: "t",
      externalPostId: "urn:li:ugcPost:1",
      fetchImpl: jest.fn() as unknown as typeof fetch,
    });
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.message).toMatch(/numeric/i);
  });

  it("normalizes a successful insights + media response", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ like_count: 3, comments_count: 1, media_product_type: "FEED" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { name: "impressions", values: [{ value: 900 }] },
            { name: "reach", values: [{ value: 700 }] },
            { name: "saved", values: [{ value: 2 }] },
            { name: "engagement", values: [{ value: 12 }] },
          ],
        }),
      });

    const r = await fetchInstagramPostPerformanceSnapshot({
      accessToken: "token",
      externalPostId: "17841400000000000",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.snapshot.impressions).toBe(900);
    expect(r.snapshot.comments).toBe(1);
    expect(r.snapshot.saves).toBe(2);

    const norm = normalizePlatformPerformanceSnapshot(r.snapshot, "instagram");
    expect(norm.impressions).toBe(900);
    expect(norm.sourcePlatform).toBe("instagram");
    expect(norm.syncedAt).toBe(r.snapshot.capturedAt);
  });

  it("returns normalized Graph error when media lookup fails", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Invalid OAuth", code: 190 } }),
    });

    const r = await fetchInstagramPostPerformanceSnapshot({
      accessToken: "bad",
      externalPostId: "17841400000000001",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.message).toMatch(/Instagram media fields/i);
  });
});
