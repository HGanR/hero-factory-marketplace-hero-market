/**
 * @jest-environment node
 */

import {
  fetchLinkedInPostPerformanceSnapshot,
  normalizeLinkedInSocialActionUrn,
} from "@/lib/social/adapters/linkedin-post-performance";
import { normalizePlatformPerformanceSnapshot } from "@/lib/social/sync-platform-post-performance";

describe("normalizeLinkedInSocialActionUrn", () => {
  it("accepts full ugcPost URN", () => {
    expect(normalizeLinkedInSocialActionUrn("urn:li:ugcPost:7096760097833439232")).toBe(
      "urn:li:ugcPost:7096760097833439232"
    );
  });

  it("accepts numeric ugcPost id only", () => {
    expect(normalizeLinkedInSocialActionUrn("7096760097833439232")).toBe("urn:li:ugcPost:7096760097833439232");
  });

  it("accepts URL-encoded URN", () => {
    expect(normalizeLinkedInSocialActionUrn("urn%3Ali%3AugcPost%3A7096760097833439232")).toBe(
      "urn:li:ugcPost:7096760097833439232"
    );
  });

  it("accepts share URN", () => {
    expect(normalizeLinkedInSocialActionUrn("urn:li:share:123456789")).toBe("urn:li:share:123456789");
  });

  it("returns null for garbage", () => {
    expect(normalizeLinkedInSocialActionUrn("not-a-urn")).toBeNull();
    expect(normalizeLinkedInSocialActionUrn("")).toBeNull();
  });
});

describe("fetchLinkedInPostPerformanceSnapshot", () => {
  const origFetch = global.fetch;

  afterEach(() => {
    global.fetch = origFetch;
    jest.resetAllMocks();
  });

  it("returns error when token missing", async () => {
    const r = await fetchLinkedInPostPerformanceSnapshot({
      accessToken: "  ",
      externalPostId: "urn:li:ugcPost:1",
      fetchImpl: jest.fn() as unknown as typeof fetch,
    });
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.message).toMatch(/missing access token/i);
  });

  it("returns error for missing remote id shape", async () => {
    const r = await fetchLinkedInPostPerformanceSnapshot({
      accessToken: "tok",
      externalPostId: "???",
      fetchImpl: jest.fn() as unknown as typeof fetch,
    });
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.message).toMatch(/platform_post_id/i);
  });

  it("returns permission-oriented error on 403", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: "Not enough permissions", status: 403 }),
    });
    const r = await fetchLinkedInPostPerformanceSnapshot({
      accessToken: "tok",
      externalPostId: "urn:li:ugcPost:7096760097833439232",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.status).toBe("error");
    if (r.status === "error") {
      expect(r.message).toMatch(/permission|Not enough permissions|socialActions/i);
      expect(r.message).toMatch(/w_member_social/i);
    }
  });

  it("maps socialActions summary to snapshot (no impressions)", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        likesSummary: { totalLikes: 4, aggregatedTotalLikes: 4 },
        commentsSummary: { aggregatedTotalComments: 2, totalFirstLevelComments: 2 },
        target: "urn:li:ugcPost:7096760097833439232",
      }),
    });
    const r = await fetchLinkedInPostPerformanceSnapshot({
      accessToken: "tok",
      externalPostId: "7096760097833439232",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.snapshot.platform).toBe("linkedin");
    expect(r.snapshot.impressions).toBeNull();
    expect(r.snapshot.comments).toBe(2);
    expect(r.snapshot.engagement).toBe(6);
    expect(r.snapshot.externalPostId).toBe("urn:li:ugcPost:7096760097833439232");

    const norm = normalizePlatformPerformanceSnapshot(r.snapshot, "linkedin");
    expect(norm.sourcePlatform).toBe("linkedin");
    expect(norm.impressions).toBeNull();
    expect(norm.engagement).toBe(6);
  });

  it("treats empty socialActions JSON as zero reactions", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    const r = await fetchLinkedInPostPerformanceSnapshot({
      accessToken: "tok",
      externalPostId: "urn:li:ugcPost:1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.snapshot.engagement).toBe(0);
      expect(r.snapshot.comments).toBe(0);
    }
  });
});
