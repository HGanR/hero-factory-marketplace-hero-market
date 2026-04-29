/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { derivePaidSocialCampaignReadiness } from "@/lib/social/paid-social-campaign-readiness";
import { PaidSocialCampaignSection } from "./PaidSocialCampaignSection";

const CAMP = "22222222-2222-4222-8222-222222222222";
const CLIENT = "44444444-4444-4444-8444-444444444444";
const DRAFT_ID = "33333333-3333-4333-8333-333333333333";

function buildPaidCampaignApiPayload() {
  const readiness = derivePaidSocialCampaignReadiness({
    provider: "meta_ads",
    objective: "",
    budgetType: "none",
    budgetAmountMinor: null,
    destinationUrl: null,
    placements: [],
    creative: {},
  });
  return {
    id: DRAFT_ID,
    campaignId: CAMP,
    provider: "meta_ads",
    internalName: "Test draft",
    adSetName: null,
    adName: null,
    objective: "",
    draftStatus: "draft",
    budgetType: "none",
    budgetAmountMinor: null,
    currency: "USD",
    startAt: null,
    endAt: null,
    destinationUrl: null,
    ctaLabel: null,
    leadFormPlaceholder: null,
    audience: {},
    placements: [],
    creative: {},
    readiness,
    metaLaunchFeatureEnabled: false,
    metaLaunchStatus: "idle",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("PaidSocialCampaignSection", () => {
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

  it("shows empty state when API returns no drafts", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-empty"]')).toBeTruthy();
  });

  it("renders readiness diagnostics and feature-flag honesty", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const readinessEl = container.querySelector('[data-testid="paid-social-readiness"]');
    expect(readinessEl?.textContent).toMatch(/Launch eligible:\s*no/i);
    expect(readinessEl?.textContent?.toLowerCase()).toContain("flag disabled");
    expect(container.querySelector('[data-testid="paid-social-blocked-reasons"]')).toBeTruthy();
  });

  it("disables launch button when not launch eligible", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const btn = container.querySelector('[data-testid="paid-social-launch-meta"]') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
  });

  it("enables launch when API marks launch eligible and calls launch endpoint", async () => {
    process.env.PAID_SOCIAL_META_ADS_EXECUTION_ENABLED = "1";
    const readiness = derivePaidSocialCampaignReadiness({
      provider: "meta_ads",
      objective: "traffic",
      budgetType: "daily",
      budgetAmountMinor: 100,
      destinationUrl: "https://example.com/x",
      placements: ["facebook_feed"],
      creative: { primaryAssetIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] },
      metaExecution: {
        metaAdAccountId: "1",
        metaPageId: "2",
        metaLaunchStatus: "idle",
        remoteMetaCampaignId: null,
        primaryAssetCreativeType: "IMAGE",
        primaryAssetHasPublicImageUrl: true,
      },
    });
    expect(readiness.launchEligible).toBe(true);
    const draft = {
      ...buildPaidCampaignApiPayload(),
      readiness,
      metaLaunchFeatureEnabled: true,
      objective: "traffic",
      budgetType: "daily",
      budgetAmountMinor: 100,
      destinationUrl: "https://example.com/x",
      placements: ["facebook_feed"],
      creative: { primaryAssetIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] },
    };
    delete process.env.PAID_SOCIAL_META_ADS_EXECUTION_ENABLED;

    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      if (u.includes(`/api/social/paid-campaigns/${DRAFT_ID}/launch`) && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaign: { ...draft, metaLaunchStatus: "launched", remoteMetaCampaignId: "c1" },
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const btn = container.querySelector('[data-testid="paid-social-launch-meta"]') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(false);
    await act(async () => {
      btn?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/social/paid-campaigns/${DRAFT_ID}/launch`),
      expect.objectContaining({ method: "POST" })
    );
    expect(container.querySelector('[data-testid="paid-social-remote-ids"]')?.textContent).toContain("c1");
  });

  it("disables Meta sync when no remote objects even if flag on", async () => {
    const draft = { ...buildPaidCampaignApiPayload(), metaLaunchFeatureEnabled: true };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const syncBtn = container.querySelector('[data-testid="paid-social-sync-meta"]') as HTMLButtonElement | null;
    expect(syncBtn?.disabled).toBe(true);
  });

  it("enables Meta sync and shows metrics when API returns snapshot fields (remote ids + flag)", async () => {
    const draft = {
      ...buildPaidCampaignApiPayload(),
      metaLaunchFeatureEnabled: true,
      metaLaunchStatus: "launched",
      remoteMetaCampaignId: "c1",
      remoteMetaAdId: "ad1",
      latestPaidMetrics: { impressions: 42, clicks: 2, spendMinor: 500 },
      latestPaidMetricsFetchedAt: "2026-01-02T00:00:00.000Z",
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const syncBtn = container.querySelector('[data-testid="paid-social-sync-meta"]') as HTMLButtonElement | null;
    expect(syncBtn?.disabled).toBe(false);
    expect(container.querySelector('[data-testid="paid-social-metrics-summary"]')?.textContent).toContain("42");
  });

  it("shows sync health badge and structured sync error (hides duplicate one-line summary)", async () => {
    const draft = {
      ...buildPaidCampaignApiPayload(),
      metaLaunchFeatureEnabled: true,
      metaLaunchStatus: "launched",
      remoteMetaCampaignId: "c1",
      paidLaunchLifecycle: "launched",
      lastMetaSyncAt: "2026-01-02T00:00:00.000Z",
      paidSyncHealth: { label: "Token / access", tone: "negative", hint: "Refresh OAuth token." },
      lastMetaSyncError: { hadAuth: true, errors: [] },
      paidStructuredSyncError: {
        state: "auth_blocked",
        label: "Access blocked",
        tone: "negative",
        hint: "Meta rejected the Marketing API token or permissions.",
        retryWorthwhile: "unlikely",
      },
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft], paidRollup: null }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-sync-health-badge"]')?.textContent).toMatch(/Token/i);
    expect(container.querySelector('[data-testid="paid-social-structured-sync-error-badge"]')?.textContent).toMatch(/Access blocked/i);
    expect(container.querySelector('[data-testid="paid-social-sync-error-summary"]')).toBeFalsy();
  });

  it("shows paid rollup line from list API", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
            paidRollup: {
              paidDraftCount: 1,
              impressions: 100,
              clicks: 3,
              spendMinor: 250,
              currency: "USD",
              contributors: { impressions: 1, clicks: 1, spendMinor: 1 },
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const rollup = container.querySelector('[data-testid="paid-social-paid-rollup"]');
    expect(rollup?.textContent).toContain("100");
    expect(rollup?.textContent).toContain("2.50");
  });

  it("shows persisted sync cooldown strip when API marks cooldown active", async () => {
    const until = new Date(Date.now() + 3_600_000).toISOString();
    const draft = {
      ...buildPaidCampaignApiPayload(),
      metaLaunchFeatureEnabled: true,
      metaLaunchStatus: "launched",
      remoteMetaCampaignId: "c1",
      remoteMetaAdId: "ad1",
      syncCooldownActive: true,
      syncCooldownUntil: until,
      syncCooldownReason: "throttled",
      syncCooldownLabel: "Meta sync paused (cooldown)",
      syncCooldownHint: "Automated scheduled sync for this ad account is deferred until later.",
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft], paidRollup: null }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-sync-cooldown"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="paid-social-sync-cooldown-badge"]')?.textContent).toMatch(/cooldown/i);
    expect(container.querySelector('[data-testid="paid-social-sync-cooldown-hint"]')?.textContent).toMatch(/deferred/i);
  });

  it("shows list-level signals summary when API includes paidListSignalsSummary", async () => {
    const draft = {
      ...buildPaidCampaignApiPayload(),
      metaLaunchFeatureEnabled: true,
      metaLaunchStatus: "launched",
      remoteMetaCampaignId: "c1",
      remoteMetaAdId: "ad1",
      paidOptimizationSignals: [{ code: "low_ctr", label: "Very low CTR", hint: "Adjust targeting." }],
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
            paidRollup: null,
            paidListSignalsSummary: { draftCountWithSignals: 1, topPrioritySignalLabel: "Very low CTR" },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const el = container.querySelector('[data-testid="paid-social-list-signals-summary"]');
    expect(el?.textContent).toMatch(/List signals/i);
    expect(el?.textContent).toMatch(/Very low CTR/i);
  });

  it("hides cooldown strip and shows early signals when API provides paidOptimizationSignals", async () => {
    const draft = {
      ...buildPaidCampaignApiPayload(),
      metaLaunchFeatureEnabled: true,
      metaLaunchStatus: "launched",
      remoteMetaCampaignId: "c1",
      remoteMetaAdId: "ad1",
      syncCooldownActive: false,
      paidOptimizationSignals: [
        {
          code: "spend_without_clicks",
          label: "Spend without clicks",
          hint: "Meta reports spend but zero clicks — review creative.",
        },
      ],
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft], paidRollup: null }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-sync-cooldown"]')).toBeFalsy();
    const sig = container.querySelector('[data-testid="paid-social-signals"]');
    expect(sig?.textContent).toMatch(/Early signals/i);
    expect(sig?.textContent).toMatch(/Spend without clicks/i);
  });

  it("shows fallback provenance when snapshot meta includes source notes", async () => {
    const draft = {
      ...buildPaidCampaignApiPayload(),
      metaLaunchFeatureEnabled: true,
      metaLaunchStatus: "launched",
      remoteMetaCampaignId: "c1",
      remoteMetaAdId: "ad1",
      latestPaidMetrics: { impressions: 3, clicks: 0, spendMinor: 10 },
      latestSnapshotMeta: {
        insightsSource: "adset",
        metricsCompleteness: "partial_early_delivery",
        sourceNotes: ["Lifetime metrics read from ad set"],
        usedFallbackInsights: true,
      },
      paidSyncHealth: { label: "Partial metrics", tone: "warning", hint: "Fallback" },
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft], paidRollup: null }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-metrics-provenance"]')?.textContent).toMatch(/ad set/i);
    expect(container.querySelector('[data-testid="paid-social-metrics-summary"]')?.textContent).toMatch(/ad set/i);
  });

  it("shows organic promotion opportunity summary from list API (Part 59)", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
            organicPromotionOpportunitySummary: {
              topOrganicCandidateCount: 2,
              topSignalLabel: "High impressions",
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-organic-opportunities"]')).toBeTruthy();
    expect(container.textContent).toMatch(/High impressions/);
  });

  it("shows promotion decision summary strip when list API includes Part 63 rollup", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
            promotionDecisionSummary: {
              referencedOrganicCount: 4,
              comparableCount: 2,
              effectiveCount: 2,
              inefficientCount: 1,
              notReadyCount: 1,
              topStatusLabel: "mixed" as const,
              explainabilityStatus: "ready" as const,
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const el = container.querySelector('[data-testid="paid-social-promotion-decision-summary"]');
    expect(el).toBeTruthy();
    expect(el?.textContent).toMatch(/Organic-linked drafts:/);
    expect(el?.textContent).toMatch(/Comparable: 2/);
    expect(el?.textContent).toMatch(/Effective: 2/);
    expect(el?.textContent).toMatch(/Inefficient: 1/);
    expect(el?.textContent).toMatch(/Not ready: 1/);
    expect(el?.textContent).toMatch(/Promotion results are mixed/);
    expect(container.querySelector('[data-testid="paid-social-promotion-decision-explain"]')).toBeNull();
  });

  it("shows promotion_effective topStatusLabel copy (Part 63)", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
            promotionDecisionSummary: {
              referencedOrganicCount: 2,
              comparableCount: 2,
              effectiveCount: 2,
              inefficientCount: 0,
              notReadyCount: 0,
              topStatusLabel: "promotion_effective" as const,
              explainabilityStatus: "ready" as const,
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-promotion-decision-summary"]')?.textContent).toMatch(
      /generally outperforming original organic posts/
    );
    expect(container.querySelector('[data-testid="paid-social-promotion-decision-explain"]')).toBeNull();
  });

  it("Part 67: prefers topStatusLabelText from API when present", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
            promotionDecisionSummary: {
              referencedOrganicCount: 2,
              comparableCount: 2,
              effectiveCount: 1,
              inefficientCount: 1,
              notReadyCount: 0,
              topStatusLabel: "mixed" as const,
              topStatusLabelText: "SERVER_CUSTOM_ROLLUP_LINE",
              explainabilityStatus: "ready" as const,
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toMatch(/SERVER_CUSTOM_ROLLUP_LINE/);
    expect(container.textContent).not.toMatch(/Promotion results are mixed/);
  });

  it("Part 67: prefers explainabilityStatusText and dominantNonComparableReasonText from API", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
            promotionDecisionSummary: {
              referencedOrganicCount: 2,
              comparableCount: 1,
              effectiveCount: 0,
              inefficientCount: 0,
              notReadyCount: 1,
              explainabilityStatus: "insufficient_comparable_rows" as const,
              explainabilityStatusText: "SERVER_CUSTOM_BASE_LINE",
              dominantNonComparableReason: "window_too_early" as const,
              dominantNonComparableReasonText: "SERVER_CUSTOM_DOMINANT_LINE",
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const t = container.querySelector('[data-testid="paid-social-promotion-decision-explain"]')?.textContent ?? "";
    expect(t).toContain("SERVER_CUSTOM_BASE_LINE");
    expect(t).toContain("SERVER_CUSTOM_DOMINANT_LINE");
    expect(t).not.toMatch(/Some linked drafts are still too new/);
  });

  it("does not render promotion decision strip when API omits summary (Part 63)", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-promotion-decision-summary"]')).toBeNull();
  });

  it("shows promotion summary counts without second-line rollup when topStatusLabel absent (Part 64)", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
            promotionDecisionSummary: {
              referencedOrganicCount: 1,
              comparableCount: 1,
              effectiveCount: 1,
              inefficientCount: 0,
              notReadyCount: 0,
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const el = container.querySelector('[data-testid="paid-social-promotion-decision-summary"]');
    expect(el?.textContent).toMatch(/Organic-linked drafts: 1/);
    expect(el?.textContent).toMatch(/Comparable: 1/);
    expect(el?.textContent).toMatch(/Effective: 1/);
    expect(el?.textContent).not.toMatch(/generally outperforming/);
    expect(el?.textContent).not.toMatch(/Promotion results are mixed/);
    expect(container.querySelector('[data-testid="paid-social-promotion-decision-explain"]')?.textContent).toMatch(
      /Need at least 2 comparable linked drafts for a campaign-level promotion summary/
    );
  });

  it("Part 65: explain line mentions low sample when nonComparableReasonCounts has insufficient_sample", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
            promotionDecisionSummary: {
              referencedOrganicCount: 2,
              comparableCount: 1,
              effectiveCount: 0,
              inefficientCount: 0,
              notReadyCount: 1,
              nonComparableReasonCounts: { insufficient_sample: 1 },
              explainabilityStatus: "insufficient_comparable_rows" as const,
              dominantNonComparableReason: "insufficient_sample" as const,
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-promotion-decision-explain"]')?.textContent).toMatch(
      /Most pending comparisons need more data/
    );
  });

  it("Part 65: explain line prefers too-new when window_too_early uniquely dominates reason counts", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
            promotionDecisionSummary: {
              referencedOrganicCount: 3,
              comparableCount: 1,
              effectiveCount: 0,
              inefficientCount: 0,
              notReadyCount: 2,
              nonComparableReasonCounts: { window_too_early: 2, insufficient_sample: 1 },
              explainabilityStatus: "insufficient_comparable_rows" as const,
              dominantNonComparableReason: "window_too_early" as const,
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-promotion-decision-explain"]')?.textContent).toMatch(
      /Some linked drafts are still too new to compare/
    );
    expect(container.querySelector('[data-testid="paid-social-promotion-decision-explain"]')?.textContent).not.toMatch(
      /Most pending comparisons need more data/
    );
  });

  it("Part 66: no suffix when dominant is omitted (tied reason counts) even with explainabilityStatus", async () => {
    const draft = buildPaidCampaignApiPayload();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
            promotionDecisionSummary: {
              referencedOrganicCount: 2,
              comparableCount: 0,
              effectiveCount: 0,
              inefficientCount: 0,
              notReadyCount: 2,
              nonComparableReasonCounts: { stale_organic: 1, stale_paid: 1 },
              explainabilityStatus: "insufficient_comparable_rows" as const,
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const t = container.querySelector('[data-testid="paid-social-promotion-decision-explain"]')?.textContent ?? "";
    expect(t).toMatch(/Need at least 2 comparable linked drafts/);
    expect(t).not.toMatch(/too new to compare/);
    expect(t).not.toMatch(/more data/);
  });

  it("shows insufficient-sample comparison hint (Part 64)", async () => {
    const postRef = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const draft = {
      ...buildPaidCampaignApiPayload(),
      creative: { referenceOrganicPostId: postRef },
      referenceCampaignPostId: postRef,
      paidCreativeSource: "organic_post" as const,
      crossSurfaceComparisonReadiness: { comparable: false, reason: "insufficient_sample" as const },
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-insufficient-sample"]')?.textContent).toMatch(
      /Not enough data yet to compare paid vs organic performance/
    );
    expect(container.querySelector('[data-testid="paid-social-promotion-effective"]')).toBeNull();
    expect(container.querySelector('[data-testid="paid-social-promotion-inefficient"]')).toBeNull();
  });

  it("shows cross-surface hints when draft references organic post (Part 59)", async () => {
    const postRef = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const draft = {
      ...buildPaidCampaignApiPayload(),
      creative: { referenceOrganicPostId: postRef },
      referenceCampaignPostId: postRef,
      paidCreativeSource: "organic_post" as const,
      crossSurfaceSignals: [
        { code: "organic_candidate_for_promotion", label: "Strong organic signal", hint: "Consider scaling." },
      ],
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-creative-source"]')?.textContent).toMatch(/organic post/);
    expect(container.querySelector('[data-testid="paid-social-cross-surface-signals"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Strong organic signal/);
  });

  it("shows promotion effectiveness when crossSurfacePromotionOutcomes.promotionEffective (Part 61)", async () => {
    const postRef = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const draft = {
      ...buildPaidCampaignApiPayload(),
      creative: { referenceOrganicPostId: postRef },
      referenceCampaignPostId: postRef,
      paidCreativeSource: "organic_post" as const,
      crossSurfacePromotionOutcomes: {
        paidOutperformingOrganic: true,
        paidUnderperformingOrganic: false,
        promotionEffective: true,
        promotionInefficient: false,
      },
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-promotion-effective"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Outperforming original organic post/);
  });

  it("shows promotion inefficiency hint when promotionInefficient (Part 61)", async () => {
    const postRef = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const draft = {
      ...buildPaidCampaignApiPayload(),
      creative: { referenceOrganicPostId: postRef },
      referenceCampaignPostId: postRef,
      paidCreativeSource: "organic_post" as const,
      crossSurfacePromotionOutcomes: {
        paidOutperformingOrganic: false,
        paidUnderperformingOrganic: true,
        promotionEffective: false,
        promotionInefficient: true,
      },
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-promotion-inefficient"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="paid-social-promotion-inefficient-hint"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Underperforming original organic post/);
    expect(container.textContent).toMatch(/Consider testing new creative or audience/);
  });

  it("shows too-early comparison hint when readiness is window_too_early (Part 62)", async () => {
    const postRef = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const draft = {
      ...buildPaidCampaignApiPayload(),
      creative: { referenceOrganicPostId: postRef },
      referenceCampaignPostId: postRef,
      paidCreativeSource: "organic_post" as const,
      crossSurfaceComparisonReadiness: { comparable: false, reason: "window_too_early" as const },
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-comparison-readiness"]')?.textContent).toMatch(
      /Too early to compare paid vs organic performance/
    );
  });

  it("shows aligned-window hint for stale_organic readiness (Part 62)", async () => {
    const postRef = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const draft = {
      ...buildPaidCampaignApiPayload(),
      creative: { referenceOrganicPostId: postRef },
      referenceCampaignPostId: postRef,
      paidCreativeSource: "organic_post" as const,
      crossSurfaceComparisonReadiness: { comparable: false, reason: "stale_organic" as const },
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-comparison-readiness"]')?.textContent).toMatch(
      /Performance comparison window is not aligned/
    );
  });

  it("does not show comparison readiness when promotion effective is shown (Part 62)", async () => {
    const postRef = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const draft = {
      ...buildPaidCampaignApiPayload(),
      creative: { referenceOrganicPostId: postRef },
      referenceCampaignPostId: postRef,
      paidCreativeSource: "organic_post" as const,
      crossSurfacePromotionOutcomes: {
        paidOutperformingOrganic: true,
        paidUnderperformingOrganic: false,
        promotionEffective: true,
        promotionInefficient: false,
      },
      crossSurfaceComparisonReadiness: { comparable: false, reason: "window_too_early" as const },
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        return { ok: true, json: async () => ({ ok: true, paidCampaigns: [draft] }) } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="paid-social-promotion-effective"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="paid-social-comparison-readiness"]')).toBeFalsy();
  });

  it("Part 72: PATCH hydrates promotionDecisionSummary without a follow-up list GET", async () => {
    let listPaidGetCount = 0;
    const postRef = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const draft = {
      ...buildPaidCampaignApiPayload(),
      creative: { referenceOrganicPostId: postRef },
      referenceCampaignPostId: postRef,
      paidCreativeSource: "organic_post" as const,
    };

    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof input === "string" ? input : input.toString();
      if (u.includes("/api/social/paid-campaigns?")) {
        listPaidGetCount += 1;
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
          }),
        } as Response;
      }
      if (u.includes(`/api/social/paid-campaigns/${DRAFT_ID}`) && !u.includes("/launch") && !u.includes("/sync")) {
        if (init?.method === "PATCH") {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              paidCampaign: { ...draft, placements: ["facebook_feed"] },
              promotionDecisionSummary: {
                referencedOrganicCount: 2,
                comparableCount: 2,
                effectiveCount: 2,
                inefficientCount: 0,
                notReadyCount: 0,
                topStatusLabel: "promotion_effective" as const,
                topStatusLabelText: "Promotions are generally outperforming original organic posts",
                explainabilityStatus: "ready" as const,
              },
            }),
          } as Response;
        }
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="paid-social-promotion-decision-summary"]')).toBeFalsy();
    const listCountAfterLoad = listPaidGetCount;

    const placementCb = container.querySelector(
      '[data-testid="paid-social-placement-facebook_feed"]'
    ) as HTMLInputElement;
    expect(placementCb).toBeTruthy();
    await act(async () => {
      placementCb.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/social/paid-campaigns/${DRAFT_ID}`),
      expect.objectContaining({ method: "PATCH" })
    );
    const strip = container.querySelector('[data-testid="paid-social-promotion-decision-summary"]');
    expect(strip).toBeTruthy();
    expect(strip?.textContent).toContain("Organic-linked drafts:");
    expect(strip?.textContent).toContain("Promotions are generally outperforming original organic posts");
    expect(listPaidGetCount).toBe(listCountAfterLoad);
  });

  it("Part 73: Meta launch hydrates promotionDecisionSummary without a follow-up list GET", async () => {
    process.env.PAID_SOCIAL_META_ADS_EXECUTION_ENABLED = "1";
    let listPaidGetCount = 0;
    const postRef = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const readiness = derivePaidSocialCampaignReadiness({
      provider: "meta_ads",
      objective: "traffic",
      budgetType: "daily",
      budgetAmountMinor: 100,
      destinationUrl: "https://example.com/x",
      placements: ["facebook_feed"],
      creative: {
        primaryAssetIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        referenceOrganicPostId: postRef,
      },
      metaExecution: {
        metaAdAccountId: "1",
        metaPageId: "2",
        metaLaunchStatus: "idle",
        remoteMetaCampaignId: null,
        primaryAssetCreativeType: "IMAGE",
        primaryAssetHasPublicImageUrl: true,
      },
    });
    expect(readiness.launchEligible).toBe(true);
    const draft = {
      ...buildPaidCampaignApiPayload(),
      readiness,
      metaLaunchFeatureEnabled: true,
      objective: "traffic",
      budgetType: "daily",
      budgetAmountMinor: 100,
      destinationUrl: "https://example.com/x",
      placements: ["facebook_feed"],
      creative: {
        primaryAssetIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        referenceOrganicPostId: postRef,
      },
      referenceCampaignPostId: postRef,
      paidCreativeSource: "organic_post" as const,
    };
    delete process.env.PAID_SOCIAL_META_ADS_EXECUTION_ENABLED;

    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof input === "string" ? input : (input as Request).url;
      if (u.includes("/api/social/paid-campaigns?")) {
        listPaidGetCount += 1;
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [draft],
          }),
        } as Response;
      }
      if (u.includes(`/api/social/paid-campaigns/${DRAFT_ID}/launch`) && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaign: {
              ...draft,
              metaLaunchStatus: "launched",
              remoteMetaCampaignId: "c1",
              remoteMetaAdId: "ad1",
            },
            promotionDecisionSummary: {
              referencedOrganicCount: 2,
              comparableCount: 2,
              effectiveCount: 2,
              inefficientCount: 0,
              notReadyCount: 0,
              topStatusLabel: "promotion_effective" as const,
              topStatusLabelText: "Promotions are generally outperforming original organic posts",
              explainabilityStatus: "ready" as const,
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-assets")) {
        return { ok: true, json: async () => ({ assets: [] }) } as Response;
      }
      if (u.includes("/api/social/posts?")) {
        return { ok: true, json: async () => ({ posts: [] }) } as Response;
      }
      if (u.includes("/api/social/accounts?")) {
        return { ok: true, json: async () => ({ accounts: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await act(async () => {
      root.render(<PaidSocialCampaignSection campaignId={CAMP} clientId={CLIENT} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="paid-social-promotion-decision-summary"]')).toBeFalsy();
    const listCountAfterLoad = listPaidGetCount;

    const launchBtn = container.querySelector('[data-testid="paid-social-launch-meta"]') as HTMLButtonElement;
    expect(launchBtn?.disabled).toBe(false);
    await act(async () => {
      launchBtn.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/social/paid-campaigns/${DRAFT_ID}/launch`),
      expect.objectContaining({ method: "POST" })
    );
    const strip = container.querySelector('[data-testid="paid-social-promotion-decision-summary"]');
    expect(strip).toBeTruthy();
    expect(strip?.textContent).toContain("Organic-linked drafts:");
    expect(strip?.textContent).toContain("Promotions are generally outperforming original organic posts");
    expect(listPaidGetCount).toBe(listCountAfterLoad);
  });
});
