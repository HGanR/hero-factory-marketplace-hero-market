/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import type { RevenueOsDashboardFormValues } from "@/lib/revenue-os/run-revenue-os-analysis";
import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";

jest.mock("@/lib/revenue-os/bentley-continuity-log", () => ({
  bentleyContinuityLog: jest.fn(),
}));

jest.mock("@/lib/revenue-os/bentley-first-campaign-asset", () => ({
  buildFirstCampaignDraft: () => ({
    captionForPublish: "Prefilled caption body",
    preview: [{ label: "Post text", body: "Prefilled caption body" }],
  }),
  focusKeyFromAnalysis: () => "traffic",
  selectPrimaryPostingPlatform: () => "linkedin" as const,
}));

import { BentleyFirstCampaignAssetCard } from "@/components/revenue-os/BentleyFirstCampaignAssetCard";

describe("BentleyFirstCampaignAssetCard launch continuity logs", () => {
  let container: HTMLDivElement;
  let root: Root;

  const form: RevenueOsDashboardFormValues = {
    businessName: "Bn",
    businessType: "Consulting",
    targetAudience: "Founders",
    market: "US",
    currentMonthlyRevenue: 0,
    targetMonthlyRevenue: 0,
    avgOrderValue: 0,
    grossMarginPct: 50,
    monthlyTraffic: 1000,
    conversionRatePct: 1,
    cac: 100,
    ltv: 500,
    coreOffer: "Core",
    transformation: "Grow",
    platforms: [],
    postingPlatforms: ["linkedin"],
    tone: "Pro",
    contentTypeFocus: "Post",
    imageStyle: "clean",
    notes: "",
  };

  const res = { kpis: {} } as unknown as RevenueOsAnalyzeResponse;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    jest.mocked(bentleyContinuityLog).mockClear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.replaceChildren();
  });

  it("emits launch_card_hydrated then launch_card_ready with identical payload shape", async () => {
    await act(async () => {
      root.render(
        <BentleyFirstCampaignAssetCard
          res={res}
          form={form}
          postingPlatforms={["linkedin"]}
          connectedAccounts={[
            {
              id: "a1",
              platform: "linkedin",
              platformCanonical: "linkedin",
              displayName: "Me",
              externalAccountId: "ext",
              expiresAt: null,
              createdAt: null,
            },
          ]}
          contentEngineOutput={null}
          clientId="client-1"
          oauthReturnTo="/revenue-os/dashboard"
        />
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(jest.mocked(bentleyContinuityLog).mock.calls.length).toBeGreaterThanOrEqual(2);
    const phases = jest.mocked(bentleyContinuityLog).mock.calls.map((c) => c[0]);
    const hydratedIdx = phases.indexOf("launch_card_hydrated");
    const readyIdx = phases.indexOf("launch_card_ready");
    expect(hydratedIdx).toBeGreaterThanOrEqual(0);
    expect(readyIdx).toBeGreaterThan(hydratedIdx);

    const hydratedPayload = jest.mocked(bentleyContinuityLog).mock.calls[hydratedIdx][1] as Record<
      string,
      unknown
    >;
    const readyPayload = jest.mocked(bentleyContinuityLog).mock.calls[readyIdx][1] as Record<string, unknown>;
    expect(hydratedPayload).toEqual(readyPayload);
    expect(hydratedPayload).toEqual({
      platform: "linkedin",
      source: "first_campaign_draft",
    });
  });
});
