/**
 * @jest-environment jsdom
 *
 * Publish / connect rendering: OAuth targets vs connected accounts (no browser runner).
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

function mockCampaignPayload(platform: string) {
  return {
    id: "camp-1",
    name: "Test campaign",
    status: "DRAFT",
    createdAt: new Date().toISOString(),
    posts: [
      {
        id: "post-1",
        platform,
        status: "DRAFT",
        caption: "Caption",
        scheduledAt: null,
      },
    ],
  };
}

describe("CampaignLaunchSection connect / publish row state", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockUseSocialAccounts.mockReturnValue({ data: [] });
    global.fetch = jest.fn().mockImplementation((input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/campaigns/") && !url.endsWith("/api/campaigns")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockCampaignPayload("linkedin"),
        });
      }
      if (url.endsWith("/api/campaigns") || url.includes("/api/campaigns?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            campaigns: [
              {
                id: "camp-1",
                name: "Test campaign",
                status: "DRAFT",
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: async () => ({}),
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.replaceChildren();
  });

  async function renderAndOpenCampaign(postingTargets: Array<"linkedin" | "tiktok">) {
    await act(async () => {
      root.render(
        <CampaignLaunchSection userId="u-connect" clientId="c-connect" postingTargets={postingTargets} />
      );
    });
    await act(async () => {
      await new Promise<void>((r) => {
        window.setTimeout(r, 50);
      });
    });
    const campaignBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Test campaign")
    );
    expect(campaignBtn).toBeTruthy();
    await act(async () => {
      campaignBtn?.click();
    });
    await act(async () => {
      await new Promise<void>((r) => {
        window.setTimeout(r, 80);
      });
    });
  }

  it("shows Connect LinkedIn when adapter-backed platform is not connected; post row is Connect CTA (no disabled Publish)", async () => {
    mockUseSocialAccounts.mockReturnValue({ data: [] });
    await renderAndOpenCampaign(["linkedin"]);

    expect(container.textContent).toContain("Connect LinkedIn");

    const connectToPublish = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Connect") && b.textContent?.includes("publish")
    );
    expect(connectToPublish).toBeTruthy();
    expect((connectToPublish as HTMLButtonElement).disabled).toBe(false);

    const publishNow = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.trim().startsWith("Publish")
    );
    expect(publishNow).toBeUndefined();
  });

  it("enables Publish now when LinkedIn is connected", async () => {
    mockUseSocialAccounts.mockReturnValue({
      data: [{ id: "acc-1", platform: "linkedin", displayName: "You", platformCanonical: "linkedin", expiresAt: null }],
    });

    await renderAndOpenCampaign(["linkedin"]);

    expect(container.textContent).not.toContain("Connect LinkedIn");

    const publishBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.trim().startsWith("Publish")
    );
    expect(publishBtn).toBeTruthy();
    expect((publishBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("for TikTok (no adapter), shows manual-only copy and no Publish affordance", async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/campaigns/") && !url.endsWith("/api/campaigns")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockCampaignPayload("tiktok"),
        });
      }
      if (url.endsWith("/api/campaigns") || url.includes("/api/campaigns?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            campaigns: [
              {
                id: "camp-1",
                name: "Test campaign",
                status: "DRAFT",
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    await renderAndOpenCampaign(["tiktok"]);

    expect(container.textContent).toMatch(/Manual only/i);
    expect(container.textContent).toMatch(/panel 3/i);

    const publishBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.trim().startsWith("Publish")
    );
    expect(publishBtn).toBeUndefined();
  });
});
