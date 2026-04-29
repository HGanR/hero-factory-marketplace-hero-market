/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { CampaignLaunchSectionFromBentleySnapshot } from "@/components/ai-revenue-os/CampaignLaunchSection";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";

const mockGetBentleySnapshot = jest.fn<() => BentleySnapshot>();

jest.mock("@/components/ai-revenue-os/AiRevenueOsSharedState", () => ({
  useAiRevenueOsBentleyActions: () => ({
    isProviderActive: true,
    getBentleySnapshot: () => mockGetBentleySnapshot(),
    applyBentleyPatch: jest.fn(),
    resetBentleyToFreshStart: jest.fn(),
  }),
  useAiRevenueOsSnapshotSignature: () => "",
}));

jest.mock("@/hooks/useSocialAccounts", () => ({
  useSocialAccounts: () => ({ data: [] }),
}));

describe("CampaignLaunchSectionFromBentleySnapshot", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockGetBentleySnapshot.mockReset();
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ campaigns: [] }),
      })
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.replaceChildren();
  });

  function minimalSnap(over: Partial<BentleySnapshot>): BentleySnapshot {
    return {
      industryKey: "consulting",
      contentIndustry: "Consulting",
      targetAudience: "SMB",
      traffic: 1000,
      conversionRate: 1,
      aov: 100,
      businessName: "Acme",
      coreOffer: "Offer",
      transformation: "Growth",
      platforms: [],
      postingPlatforms: ["linkedin"],
      tone: "Pro",
      contentType: "Post",
      imageStyle: "clean",
      campaignNotes: "",
      ...over,
    };
  }

  it("maps launchPrefill and campaignGenerated from getBentleySnapshot into the launch fields", async () => {
    mockGetBentleySnapshot.mockReturnValue(
      minimalSnap({
        launchPrefill: {
          campaignName: "From pipeline",
          caption: "Line A",
          hooks: "Line B",
          cta: "Line C",
        },
        pipeline: {
          intakeComplete: true,
          analysisComplete: true,
          contentGenerated: true,
          campaignGenerated: true,
          launchReady: false,
        },
      })
    );

    await act(async () => {
      root.render(
        <CampaignLaunchSectionFromBentleySnapshot
          userId="u1"
          clientId="c1"
          postingTargets={["tiktok"]}
        />
      );
    });

    const nameInput = container.querySelector(
      'input[placeholder="Campaign name"]'
    ) as HTMLInputElement | null;
    expect(nameInput?.value).toBe("From pipeline");

    const desc = container.querySelector("textarea") as HTMLTextAreaElement | null;
    expect(desc?.value).toContain("Line A");
    expect(desc?.value).toContain("Line B");

    expect(container.textContent).toContain("server publish not wired");
    expect(container.textContent).not.toContain("Connect LinkedIn");

    expect(container.querySelector("[data-testid=\"bentley-prefill-note\"]")).toBeTruthy();
    expect(container.querySelector("[data-testid=\"launch-readiness-summary\"]")?.textContent).toMatch(
      /Bentley campaign\s*·\s*Yes/i
    );
  });
});
