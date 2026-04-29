/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { CampaignPublishingAnalyticsSummary } from "./CampaignPublishingAnalyticsSummary";

const CAMP = "22222222-2222-4222-8222-222222222222";

describe("CampaignPublishingAnalyticsSummary", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("renders nothing when campaignId empty", async () => {
    await act(async () => {
      root.render(<CampaignPublishingAnalyticsSummary campaignId="" />);
    });
    expect(container.querySelector('[data-testid="planner-campaign-analytics-summary"]')).toBeNull();
  });

  it("shows error when API fails", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ message: "nope" }),
    })) as unknown as typeof fetch;

    await act(async () => {
      root.render(<CampaignPublishingAnalyticsSummary campaignId={CAMP} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="planner-campaign-analytics-error"]')?.textContent).toContain("nope");
  });

  it("batch refresh shows result and calls onBatchAnalyticsComplete", async () => {
    const onDone = jest.fn();
    global.fetch = jest.fn(async (input: RequestInfo, init?: RequestInit) => {
      const u = typeof input === "string" ? input : input.url;
      if (u.includes("/campaign-analytics?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            campaignId: CAMP,
            campaignSummary: {
              governedPostCount: 1,
              publishedPostCount: 1,
              postsWithLatestSnapshot: 0,
              postsPublishedNeverSynced: 0,
              postsMissingRemotePostId: 0,
              postsUnsupportedForLiveSync: 0,
            },
            aggregateMetrics: {},
            providerSummaries: [],
            coverage: { code: "partial_sync", headline: "H", notes: [] },
            freshness: { freshestSnapshotAt: null, stalestSnapshotAt: null },
            liveAdapterProviders: ["linkedin"],
          }),
        } as Response;
      }
      if (u.includes("/campaign-analytics/refresh") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            succeededCount: 2,
            failedCount: 1,
            skippedCount: 3,
            attemptedCount: 3,
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<CampaignPublishingAnalyticsSummary campaignId={CAMP} onBatchAnalyticsComplete={onDone} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const btn = container.querySelector('[data-testid="planner-campaign-analytics-batch-refresh"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    await act(async () => {
      btn.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(onDone).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="planner-campaign-analytics-batch-result"]')?.textContent).toContain(
      "2 succeeded"
    );
  });

  it("disables batch refresh when no live adapters", async () => {
    global.fetch = jest.fn(async (input: RequestInfo) => {
      const u = typeof input === "string" ? input : input.url;
      if (u.includes("/campaign-analytics?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            campaignId: CAMP,
            campaignSummary: {
              governedPostCount: 0,
              publishedPostCount: 0,
              postsWithLatestSnapshot: 0,
              postsPublishedNeverSynced: 0,
              postsMissingRemotePostId: 0,
              postsUnsupportedForLiveSync: 0,
            },
            aggregateMetrics: {},
            providerSummaries: [],
            coverage: { code: "no_governed_posts", headline: "None", notes: [] },
            freshness: { freshestSnapshotAt: null, stalestSnapshotAt: null },
            liveAdapterProviders: [],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<CampaignPublishingAnalyticsSummary campaignId={CAMP} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const btn = container.querySelector('[data-testid="planner-campaign-analytics-batch-refresh"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
