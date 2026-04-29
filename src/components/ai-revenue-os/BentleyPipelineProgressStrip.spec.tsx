/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { BentleyPipelineProgressStrip } from "@/components/ai-revenue-os/BentleyPipelineProgressStrip";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";

const getSnap = jest.fn<() => BentleySnapshot>();

jest.mock("@/components/ai-revenue-os/AiRevenueOsSharedState", () => ({
  useAiRevenueOsSnapshotSignature: () => "sig",
  useAiRevenueOsBentleyActions: () => ({
    getBentleySnapshot: () => getSnap(),
    applyBentleyPatch: jest.fn(),
    resetBentleyToFreshStart: jest.fn(),
  }),
}));

jest.mock("@/lib/revenue-os/bentley-workflow", () => {
  const actual = jest.requireActual("@/lib/revenue-os/bentley-workflow");
  return {
    ...actual,
    loadWorkflowState: jest.fn(() => actual.defaultWorkflowState()),
    subscribeBentleyWorkflowCrossTab: jest.fn(() => () => {}),
  };
});

describe("BentleyPipelineProgressStrip", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    getSnap.mockReturnValue({
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
      pipeline: { intakeComplete: true, launchReady: true },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.replaceChildren();
  });

  it("renders launch handoff CTA when snapshot is launch-ready", async () => {
    await act(async () => {
      root.render(<BentleyPipelineProgressStrip />);
    });
    const cta = container.querySelector("[data-testid=\"bentley-pipeline-dominant-cta\"]") as HTMLAnchorElement | null;
    expect(cta?.tagName).toBe("A");
    expect(cta?.textContent).toMatch(/Open Launch Campaign/i);
    expect(cta?.getAttribute("href")).toContain("campaign-launch");
    expect(container.querySelector("[data-testid=\"bentley-pipeline-next-line\"]")?.textContent).toMatch(
      /Open Launch Campaign/i
    );
  });
});
