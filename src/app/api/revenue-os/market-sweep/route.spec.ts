/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { POST } from "./route";
import * as pipeline from "@/lib/revenue-os/market-sweep-pipeline";
import { getAuthedUserId } from "@/lib/api/auth";

jest.mock("@/lib/revenue-os-api-access", () => ({
  enforceRevenueOsApiAccess: async () => null,
}));

jest.mock("@/lib/revenue-os/bentley-correlation-server", () => ({
  logBentleyCorrelationEvent: jest.fn(),
}));

jest.mock("@/lib/revenue-os/market-sweep-pipeline");

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));

const mockAuth = jest.mocked(getAuthedUserId);
const mockPipeline = pipeline.runMarketIntelligenceSweepPipeline as jest.MockedFunction<
  typeof pipeline.runMarketIntelligenceSweepPipeline
>;

describe("POST /api/revenue-os/market-sweep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue("user-1");
    mockPipeline.mockResolvedValue({
      result: {
        trendingTopics: ["a", "b"],
        viralHooks: ["h1"],
        painPoints: ["p1"],
        buyingSignals: ["b1"],
        commentInsights: ["c1"],
        competitorAngles: ["x"],
        contentGaps: ["g"],
        nextAction: { action: "continue_pipeline", reason: "test", priority: 1 },
        contentGenerationMode: "balanced",
        growthGuidance: {
          recommendedNextMove: "m",
          why: "w",
          risingTopics: ["a"],
          weakAngles: [],
          bestHookDirection: "POV",
        },
        intelligenceDiff: {
          hasPrior: false,
          newTopics: [],
          droppedTopics: [],
          strengthenedHooks: [],
          weakenedHooks: [],
          summary: "baseline",
        },
      } as import("@/lib/revenue-os/market-sweep-schema").MarketSweepResult,
      connectedIntegrations: ["reddit"],
      llmUsed: true,
    });
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/revenue-os/market-sweep", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects short industry", async () => {
    const req = new NextRequest("http://localhost/api/revenue-os/market-sweep", {
      method: "POST",
      body: JSON.stringify({ industry: "x", targetAudience: "y" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error?: string };
    expect(j.error).toBe("INVALID_REQUEST");
  });

  it("returns 200 with sweep payload", async () => {
    const req = new NextRequest("http://localhost/api/revenue-os/market-sweep", {
      method: "POST",
      body: JSON.stringify({
        industry: "SaaS",
        targetAudience: "Founders",
        platforms: ["LinkedIn"],
        clientId: "c",
        trustId: "t",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { trendingTopics?: string[]; sweepMeta?: { llmUsed?: boolean } };
    expect(j.trendingTopics?.length).toBeGreaterThan(0);
    expect(j.sweepMeta?.llmUsed).toBe(true);
    expect(mockPipeline).toHaveBeenCalled();
  });
});
