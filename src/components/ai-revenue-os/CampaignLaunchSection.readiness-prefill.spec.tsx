/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { CampaignLaunchSection } from "@/components/ai-revenue-os/CampaignLaunchSection";
import { useSocialAccounts } from "@/hooks/useSocialAccounts";

jest.mock("@/hooks/useSocialAccounts", () => ({
  __esModule: true,
  useSocialAccounts: jest.fn(() => ({ data: [] as Array<{ id: string; platform: string; displayName?: string }> })),
}));

const mockUseSocialAccounts = jest.mocked(useSocialAccounts);

describe("CampaignLaunchSection readiness + Bentley prefill", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockUseSocialAccounts.mockReturnValue({ data: [] });
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

  it("renders launch-readiness summary with targets, publish-ready, manual-only, reconnect, and Bentley flag", async () => {
    mockUseSocialAccounts.mockReturnValue({
      data: [
        {
          id: "a1",
          platform: "instagram",
          platformCanonical: "instagram",
          displayName: "ig",
          externalAccountId: "x",
          expiresAt: new Date(Date.now() - 120_000).toISOString(),
          createdAt: null,
        },
      ],
    });

    await act(async () => {
      root.render(
        <CampaignLaunchSection
          userId="u"
          clientId="c"
          postingTargets={["linkedin", "tiktok", "instagram"]}
          campaignGenerated={false}
        />
      );
    });

    const summary = container.querySelector("[data-testid=\"launch-readiness-summary\"]");
    expect(summary?.textContent).toMatch(/Bentley campaign\s*·\s*Awaiting campaign/i);
    expect(summary?.textContent).toMatch(/Targets\s*·\s*3/);
    expect(summary?.textContent).toMatch(/Publish-ready\s*·\s*0/);
    expect(summary?.textContent).toMatch(/Reconnect\s*·\s*1/);
    expect(summary?.textContent).toMatch(/Manual-only\s*·\s*1/);
    expect(summary?.textContent).toMatch(/Connect required\s*·\s*1/);
  });

  it("shows Prefilled from Bentley note when campaignGenerated and launchPrefill", async () => {
    await act(async () => {
      root.render(
        <CampaignLaunchSection
          userId="u"
          clientId="c"
          postingTargets={["linkedin"]}
          campaignGenerated
          launchPrefill={{ campaignName: "Auto", caption: "Cap", hooks: "", cta: "" }}
        />
      );
    });

    const note = container.querySelector("[data-testid=\"bentley-prefill-note\"]");
    expect(note?.textContent).toMatch(/Prefilled from Bentley/i);
    expect(note?.textContent?.toLowerCase()).toMatch(/overwrit/);
  });

  it("keeps manual description when launchPrefill updates after user edits", async () => {
    let prefill = { campaignName: "One", caption: "First", hooks: "", cta: "" };

    await act(async () => {
      root.render(
        <CampaignLaunchSection
          userId="u"
          clientId="c"
          postingTargets={["linkedin"]}
          campaignGenerated
          launchPrefill={prefill}
        />
      );
    });

    const ta = container.querySelector("textarea") as HTMLTextAreaElement | null;
    expect(ta?.value).toContain("First");

    await act(async () => {
      if (!ta) return;
      const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
      proto?.set?.call(ta, "Operator edit stays");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    });

    prefill = { campaignName: "Two", caption: "Second wave", hooks: "", cta: "" };

    await act(async () => {
      root.render(
        <CampaignLaunchSection
          userId="u"
          clientId="c"
          postingTargets={["linkedin"]}
          campaignGenerated
          launchPrefill={prefill}
        />
      );
    });

    const taAfter = container.querySelector("textarea") as HTMLTextAreaElement | null;
    expect(taAfter?.value).toBe("Operator edit stays");
  });
});
