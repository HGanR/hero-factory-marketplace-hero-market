/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { MetaMarketingApiError } from "@/lib/social/paid-social-meta-marketing-api";
import { classifyMetaSyncFailure, readMetaPaidCampaignBundle } from "@/lib/social/paid-social-meta-sync";

function jsonRes(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

describe("classifyMetaSyncFailure", () => {
  it("classifies throttle codes", () => {
    expect(classifyMetaSyncFailure(new MetaMarketingApiError("x", { metaCode: 4 })).kind).toBe("throttled");
  });

  it("classifies auth-ish messages", () => {
    expect(classifyMetaSyncFailure(new MetaMarketingApiError("OAuth token", { metaCode: 190 })).kind).toBe("auth");
  });
});

describe("readMetaPaidCampaignBundle", () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  it("returns normalized metrics and runtime when all calls succeed", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonRes({ name: "c", status: "PAUSED", effective_status: "CAMPAIGN_PAUSED" }))
      .mockResolvedValueOnce(jsonRes({ name: "a", status: "PAUSED", effective_status: "PAUSED" }))
      .mockResolvedValueOnce(jsonRes({ name: "ad", effective_status: "ACTIVE", status: "ACTIVE" }))
      .mockResolvedValueOnce(
        jsonRes({
          data: [{ impressions: "10", clicks: "2", spend: "1.50", reach: "9", cpc: "0.75", cpm: "15", ctr: "0.2" }],
        })
      );

    const out = await readMetaPaidCampaignBundle("tok", {
      remoteCampaignId: "c1",
      remoteAdsetId: "as1",
      remoteAdId: "ad1",
    });

    expect(out.runtimeStatus).toBe("active");
    expect(out.normalizedMetrics?.impressions).toBe(10);
    expect(out.normalizedMetrics?.spendMinor).toBe(150);
    expect(out.errors).toHaveLength(0);
  });

  it("continues when one phase fails", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(jsonRes({ effective_status: "PAUSED" }))
      .mockResolvedValueOnce(jsonRes({ effective_status: "ACTIVE" }))
      .mockResolvedValueOnce(jsonRes({ data: [] }));

    const out = await readMetaPaidCampaignBundle("tok", {
      remoteCampaignId: "c1",
      remoteAdsetId: "as1",
      remoteAdId: "ad1",
    });

    expect(out.errors.some((e) => e.phase === "campaign")).toBe(true);
    expect(out.runtimeStatus).toBe("active");
  });

  it("falls back to ad set insights when ad insights are empty", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonRes({ name: "c", status: "ACTIVE", effective_status: "ACTIVE" }))
      .mockResolvedValueOnce(jsonRes({ name: "a", status: "ACTIVE", effective_status: "ACTIVE" }))
      .mockResolvedValueOnce(jsonRes({ name: "ad", effective_status: "ACTIVE", status: "ACTIVE" }))
      .mockResolvedValueOnce(jsonRes({ data: [] }))
      .mockResolvedValueOnce(
        jsonRes({
          data: [{ impressions: "5", clicks: "1", spend: "0.50", reach: "4", cpc: "0.5", cpm: "10", ctr: "0.2" }],
        })
      );

    const out = await readMetaPaidCampaignBundle("tok", {
      remoteCampaignId: "c1",
      remoteAdsetId: "as1",
      remoteAdId: "ad1",
    });

    expect(out.insightsSource).toBe("adset");
    expect(out.normalizedMetrics?.impressions).toBe(5);
    expect(out.sourceNotes.length).toBeGreaterThan(0);
    expect(out.metricsCompleteness).toBe("partial_early_delivery");
  });

  it("does not fall back when ad insights fail with throttle", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonRes({ name: "c" }))
      .mockResolvedValueOnce(jsonRes({ name: "a" }))
      .mockResolvedValueOnce(jsonRes({ name: "ad" }))
      .mockRejectedValueOnce(new MetaMarketingApiError("limit", { metaCode: 4 }));

    const out = await readMetaPaidCampaignBundle("tok", {
      remoteCampaignId: "c1",
      remoteAdsetId: "as1",
      remoteAdId: "ad1",
    });

    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(out.insightsSource).toBeNull();
    expect(out.errors.some((e) => e.phase === "insights_ad")).toBe(true);
  });
});
