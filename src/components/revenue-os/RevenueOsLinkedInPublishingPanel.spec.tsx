/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { RevenueOsLinkedInPublishingPanel } from "./RevenueOsLinkedInPublishingPanel";

describe("RevenueOsLinkedInPublishingPanel (governed composer)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    global.fetch = jest.fn(async (input: RequestInfo) => {
      const u = typeof input === "string" ? input : input.url;
      if (u.includes("/api/clients/me")) {
        return { ok: true, json: async () => ({ client: { id: "cli-1" } }) } as Response;
      }
      if (u.includes("/api/campaigns") && !u.includes("assets")) {
        return { ok: true, json: async () => ({ campaigns: [{ id: "camp-1", name: "Test" }] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return {
          ok: true,
          json: async () => ({
            assets: [
              {
                id: "img-1",
                creativeType: "IMAGE",
                hasStorageUrl: true,
                label: "IMAGE",
                instagramPublishEligible: true,
                facebookImageEligible: true,
              },
              {
                id: "vid-1",
                creativeType: "VIDEO",
                hasStorageUrl: true,
                label: "VIDEO",
                instagramPublishEligible: true,
                facebookImageEligible: false,
              },
            ],
          }),
        } as Response;
      }
      if (u.includes("/api/social/accounts")) {
        return {
          ok: true,
          json: async () => ({
            accounts: [
              {
                id: "acc-li",
                provider: "linkedin",
                displayName: "Pat",
                providerAccountId: "sub-1",
                status: "connected",
                tokenExpiresAt: null,
                connectedAt: null,
              },
              {
                id: "acc-fb",
                provider: "facebook",
                displayName: "Page One",
                providerAccountId: "page-1",
                externalAccountId: "page-1",
                status: "connected",
                tokenExpiresAt: null,
                connectedAt: null,
              },
            ],
          }),
        } as Response;
      }
      if (u.includes("/api/social/posts")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("renders connect links for LinkedIn, Facebook, and Instagram", async () => {
    await act(async () => {
      root.render(<RevenueOsLinkedInPublishingPanel />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="revenue-os-linkedin-publishing"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="connect-linkedin"]')?.getAttribute("href")).toContain(
      "/api/social/linkedin/start"
    );
    expect(container.querySelector('[data-testid="connect-facebook"]')?.getAttribute("href")).toContain(
      "/api/social/oauth/facebook/start"
    );
    expect(container.querySelector('[data-testid="connect-instagram"]')?.getAttribute("href")).toContain(
      "/api/social/oauth/instagram/start"
    );
  });

  it("lists all connected accounts with formatted labels", async () => {
    await act(async () => {
      root.render(<RevenueOsLinkedInPublishingPanel />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const summary = container.querySelector('[data-testid="composer-account-summary"]');
    expect(summary?.textContent).toContain("LinkedIn");
    expect(summary?.textContent).toContain("Facebook");
    expect(summary?.textContent).toContain("Page page-1");
  });

  it("filters accounts when provider is Facebook", async () => {
    await act(async () => {
      root.render(<RevenueOsLinkedInPublishingPanel />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const sel = container.querySelector('[data-testid="composer-provider-select"]') as HTMLSelectElement;
    await act(async () => {
      sel.value = "facebook";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    const accSel = container.querySelector('[data-testid="composer-account-select"]') as HTMLSelectElement;
    const opts = Array.from(accSel.querySelectorAll("option")).map((o) => o.textContent);
    expect(opts.some((t) => t?.includes("Page One"))).toBe(true);
    expect(opts.some((t) => t?.includes("Pat"))).toBe(false);
  });

  it("shows Instagram media notice and asset picker", async () => {
    await act(async () => {
      root.render(<RevenueOsLinkedInPublishingPanel />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const psel = container.querySelector('[data-testid="composer-provider-select"]') as HTMLSelectElement;
    await act(async () => {
      psel.value = "instagram";
      psel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="composer-instagram-media-notice"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="composer-asset-select"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="composer-instagram-readiness-hint"]')).toBeTruthy();
  });

  it("requests posts without provider filter when show all providers is checked", async () => {
    const fetchMock = global.fetch as jest.Mock;
    await act(async () => {
      root.render(<RevenueOsLinkedInPublishingPanel />);
    });
    await act(async () => {
      let n = 0;
      while (n++ < 40 && !fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/social/posts"))) {
        await Promise.resolve();
      }
    });
    fetchMock.mockClear();
    const cb = container.querySelector('[data-testid="composer-list-all-providers"]') as HTMLInputElement;
    await act(async () => {
      cb.click();
    });
    await act(async () => {
      let n = 0;
      while (n++ < 40 && !fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/social/posts"))) {
        await Promise.resolve();
      }
    });
    const postsCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/social/posts"));
    expect(postsCalls.length).toBeGreaterThan(0);
    const url = String(postsCalls[postsCalls.length - 1][0]);
    expect(url).toContain("campaignId=camp-1");
    expect(url).not.toContain("provider=");
  });
});
