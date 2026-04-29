/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { derivePaidSocialCampaignReadiness } from "@/lib/social/paid-social-campaign-readiness";
import { buildPlannerPaidCampaignHydrationFromJson } from "./paid-campaign";
import { RevenueOsPublishingPlanner } from "./RevenueOsPublishingPlanner";

const CAMP_UUID = "11111111-1111-4111-8111-111111111111";
const POST_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAID_UUID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Part 60: drive fetch branches for promote-flow tests without duplicating the whole mock. */
const fetchHarness = {
  mode: "default" as "default" | "promote_ok" | "promote_dup",
  postUuidDetailCalls: 0,
  /** Part 71: increments on each GET /api/social/paid-campaigns? (list load). */
  paidCampaignsListFetchCount: 0,
};

const plannerObservabilityFields = {
  approvalChainSummary: "Pending · Reviewer",
  approvalCurrentStep: null as number | null,
  approvalCurrentStepLabel: null as string | null,
  approvalCurrentActorLabel: "Awaiting Reviewer",
  approvalLastActionAt: null as string | null,
  approvalLastActionLabel: "Awaiting approval",
  approvalDecisionSummary: "Pending · Reviewer",
  approvalTimelinePreview: [] as string[],
  publishAttemptSummary: null as string | null,
  publishLastAttemptAt: null as string | null,
  publishLastErrorSummary: null as string | null,
  blockedReason: "Waiting for approval before the scheduled publish can run.",
  blockedReasonCode: "awaiting_approval",
  overdueSeverity: "none" as const,
  diagnostics: [] as string[],
  operatorNextActionHint: "Wait for a reviewer to approve, or adjust governance if appropriate.",
};

describe("RevenueOsPublishingPlanner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    fetchHarness.mode = "default";
    fetchHarness.postUuidDetailCalls = 0;
    fetchHarness.paidCampaignsListFetchCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    global.fetch = jest.fn(async (input: RequestInfo, init?: RequestInit) => {
      const u = typeof input === "string" ? input : input.url;
      if (u.includes("/api/clients/me")) {
        return { ok: true, json: async () => ({ client: { id: "cli-1" } }) } as Response;
      }
      if (u.includes("/api/campaigns")) {
        return { ok: true, json: async () => ({ campaigns: [{ id: CAMP_UUID, name: "C" }] }) } as Response;
      }
      if (u.includes("/api/social/campaign-analytics")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            campaignId: CAMP_UUID,
            campaignSummary: {
              governedPostCount: 1,
              publishedPostCount: 1,
              postsWithLatestSnapshot: 0,
              postsPublishedNeverSynced: 1,
              postsMissingRemotePostId: 0,
              postsUnsupportedForLiveSync: 0,
            },
            aggregateMetrics: {},
            providerSummaries: [
              {
                provider: "linkedin",
                displayName: "LinkedIn",
                metricSyncSupport: "live",
                publishedPosts: 1,
                postsWithLatestSnapshot: 0,
                postsMissingRemotePostId: 0,
                metrics: {},
              },
            ],
            coverage: {
              code: "published_none_synced",
              headline: "Published posts have no stored metrics yet (or adapters are unavailable).",
              notes: ["Totals sum the latest stored snapshot per published post."],
            },
            freshness: { freshestSnapshotAt: null, stalestSnapshotAt: null },
            liveAdapterProviders: ["linkedin", "instagram"],
          }),
        } as Response;
      }
      if (u.includes("/api/social/planner")) {
        const p1Item = {
          id: "p1",
          campaignId: CAMP_UUID,
          provider: "linkedin",
          contentPreview: "Hi",
          content: "Hi",
          fromSocialStudio: false,
          assetId: null,
          assetCreativeType: null,
          scheduledFor: "2026-06-10T12:00:00.000Z",
          publishedAt: null,
          status: "SCHEDULED",
          approvalStatus: "pending_approval",
          publishStatusLabel: "scheduled",
          approvalBlocked: true,
          rejectionReason: null,
          socialAccountLabel: "A",
          socialAccountId: "acc1",
          linkUrl: null,
          currentApprovalStepIndex: null,
          totalApprovalSteps: null,
          currentApprovalRequiredRole: null,
          publishReadiness: "Waiting for approval",
          approvalOverdueHint: false,
          updatedAt: "2026-06-01T00:00:00.000Z",
          lastError: null,
          externalPostId: null,
          editCapabilities: {
            readOnly: false,
            readOnlyReason: null,
            canEditContent: true,
            canEditSchedule: true,
            canEditAccount: true,
            canResubmitAfterRejection: false,
          },
          plannerDayKey: "2026-06-10",
          analyticsSummaryLine: null,
          hasActiveClientReviewLink: true,
          ...plannerObservabilityFields,
        };
        const postedIgItem = {
          id: POST_UUID,
          campaignId: CAMP_UUID,
          provider: "instagram",
          contentPreview: "Posted",
          content: "Posted",
          fromSocialStudio: true,
          assetId: null,
          assetCreativeType: null,
          scheduledFor: "2026-06-09T12:00:00.000Z",
          publishedAt: "2026-06-09T14:00:00.000Z",
          status: "POSTED",
          approvalStatus: "approved",
          publishStatusLabel: "published",
          approvalBlocked: false,
          rejectionReason: null,
          socialAccountLabel: "IG",
          socialAccountId: "acc-ig",
          linkUrl: null,
          currentApprovalStepIndex: null,
          totalApprovalSteps: null,
          currentApprovalRequiredRole: null,
          publishReadiness: "Published",
          approvalOverdueHint: false,
          updatedAt: "2026-06-09T00:00:00.000Z",
          lastError: null,
          externalPostId: "ext-1",
          editCapabilities: {
            readOnly: true,
            readOnlyReason: "Published posts cannot be edited here.",
            canEditContent: false,
            canEditSchedule: false,
            canEditAccount: false,
            canResubmitAfterRejection: false,
          },
          plannerDayKey: "2026-06-09",
          analyticsSummaryLine: null,
          hasActiveClientReviewLink: false,
          ...plannerObservabilityFields,
          blockedReason: "",
          blockedReasonCode: "none",
          overdueSeverity: "none" as const,
          operatorNextActionHint: null,
          diagnostics: [] as string[],
        };
        const items =
          fetchHarness.mode === "default" ? [p1Item] : [p1Item, postedIgItem];
        return {
          ok: true,
          json: async () => ({
            items,
            groups: [],
          }),
        } as Response;
      }
      if (u.includes(`/api/social/posts/${POST_UUID}`)) {
        fetchHarness.postUuidDetailCalls += 1;
        const withExisting =
          fetchHarness.mode === "promote_dup" && fetchHarness.postUuidDetailCalls >= 2;
        return {
          ok: true,
          json: async () => ({
            plannerItem: {
              id: POST_UUID,
              campaignId: CAMP_UUID,
              provider: "instagram",
              contentPreview: "Posted",
              content: "Posted",
              fromSocialStudio: false,
              assetId: null,
              assetCreativeType: null,
              scheduledFor: "2026-06-09T12:00:00.000Z",
              publishedAt: "2026-06-09T14:00:00.000Z",
              status: "POSTED",
              approvalStatus: "approved",
              publishStatusLabel: "published",
              approvalBlocked: false,
              rejectionReason: null,
              socialAccountLabel: "IG",
              socialAccountId: "acc-ig",
              linkUrl: null,
              currentApprovalStepIndex: null,
              totalApprovalSteps: null,
              currentApprovalRequiredRole: null,
              publishReadiness: "Published",
              approvalOverdueHint: false,
              updatedAt: "2026-06-09T00:00:00.000Z",
              lastError: null,
              externalPostId: "ext-1",
              editCapabilities: {
                readOnly: true,
                readOnlyReason: "Published posts cannot be edited here.",
                canEditContent: false,
                canEditSchedule: false,
                canEditAccount: false,
                canResubmitAfterRejection: false,
              },
              plannerDayKey: "2026-06-09",
              analyticsSummaryLine: null,
              hasActiveClientReviewLink: false,
              ...plannerObservabilityFields,
              blockedReason: "",
              blockedReasonCode: "none",
              overdueSeverity: "none" as const,
              operatorNextActionHint: null,
              diagnostics: [] as string[],
            },
            approvalDetail: null,
            publishDetail: {
              rowStatus: "POSTED",
              publishStatusLabel: "published",
              lastAttemptedAt: "2026-06-09T14:00:00.000Z",
              lastSuccessAt: "2026-06-09T14:00:00.000Z",
              lastFailureSummary: null,
              retryable: false,
              publishBlocked: false,
              blockedReason: null,
            },
            activityTimeline: [],
            activityTimelineOrder: "newest_first",
            analytics: {
              availability: { code: "ok", message: "Metrics available." },
              metricSyncSupport: "live",
              latest: {
                fetchedAt: "2026-06-10T10:00:00.000Z",
                snapshotType: "live",
                metrics: {
                  impressions: 100,
                  reach: 80,
                  engagementsTotal: 5,
                  reactions: 2,
                  comments: 1,
                  saves: 0,
                  videoViews: null,
                  clicks: 1,
                },
                comparatorCaveat: null,
                sourceNotes: [],
              },
              recentSnapshots: [],
            },
            organicPromotion: {
              eligible: true,
              signals: [],
              candidateForPromotion: false,
              ...(withExisting
                ? {
                    existingPromotion: {
                      exists: true,
                      paidCampaignId: PAID_UUID,
                      status: "draft",
                      name: "Promoted: dup",
                      paidCreativeSource: "organic_post" as const,
                    },
                  }
                : {}),
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/paid-campaigns/from-post") && init?.method === "POST") {
        if (fetchHarness.mode === "promote_ok") {
          const readiness = derivePaidSocialCampaignReadiness({
            provider: "meta_ads",
            objective: "",
            budgetType: "none",
            budgetAmountMinor: null,
            destinationUrl: null,
            placements: [],
            creative: { referenceOrganicPostId: POST_UUID },
          });
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              paidCampaign: {
                id: PAID_UUID,
                campaignId: CAMP_UUID,
                provider: "meta_ads",
                internalName: "Promoted: T",
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
                creative: { referenceOrganicPostId: POST_UUID },
                readiness,
                metaLaunchFeatureEnabled: false,
                metaLaunchStatus: "idle",
                referenceCampaignPostId: POST_UUID,
                paidCreativeSource: "organic_post" as const,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
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
        if (fetchHarness.mode === "promote_dup") {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              ok: false,
              error: "duplicate_reference_organic_post",
              existingName: "Promoted: dup",
              existingDraftId: PAID_UUID,
              existingStatus: "draft",
              existingCampaignId: CAMP_UUID,
            }),
          } as Response;
        }
      }
      if (u.includes("/api/social/posts/p1")) {
        return {
          ok: true,
          json: async () => ({
            plannerItem: {
              id: "p1",
              campaignId: CAMP_UUID,
              provider: "linkedin",
              contentPreview: "Hi",
              content: "Hi",
              fromSocialStudio: false,
              assetId: null,
              assetCreativeType: null,
              scheduledFor: "2026-06-10T12:00:00.000Z",
              publishedAt: null,
              status: "SCHEDULED",
              approvalStatus: "pending_approval",
              publishStatusLabel: "scheduled",
              approvalBlocked: true,
              rejectionReason: null,
              socialAccountLabel: "A",
              socialAccountId: "acc1",
              linkUrl: null,
              currentApprovalStepIndex: null,
              totalApprovalSteps: null,
              currentApprovalRequiredRole: null,
              publishReadiness: "Waiting for approval",
              approvalOverdueHint: false,
              updatedAt: "2026-06-01T00:00:00.000Z",
              lastError: null,
              externalPostId: null,
              editCapabilities: {
                readOnly: false,
                readOnlyReason: null,
                canEditContent: true,
                canEditSchedule: true,
                canEditAccount: true,
                canResubmitAfterRejection: false,
              },
              plannerDayKey: "2026-06-10",
              analyticsSummaryLine: null,
              hasActiveClientReviewLink: true,
              ...plannerObservabilityFields,
            },
            approvalDetail: {
              status: "pending_approval",
              currentStepIndex: null,
              currentStepDisplay: null,
              currentApproverLabel: "Awaiting Reviewer",
              totalSteps: null,
              completedSteps: null,
              pendingSince: "2026-06-01T10:00:00.000Z",
              approvedAt: null,
              rejectedAt: null,
              rejectionReason: null,
              overdueHint: false,
              chainSummary: "Pending · Reviewer",
              lastActionAt: "2026-06-01T10:00:00.000Z",
              lastActionSummary: "Awaiting approval",
            },
            publishDetail: {
              rowStatus: "SCHEDULED",
              publishStatusLabel: "scheduled",
              lastAttemptedAt: null,
              lastSuccessAt: null,
              lastFailureSummary: null,
              retryable: false,
              publishBlocked: true,
              blockedReason: "Waiting for approval before the scheduled publish can run.",
            },
            activityTimeline: [
              {
                kind: "submitted_for_approval",
                at: "2026-06-05T12:00:00.000Z",
                label: "Submitted for approval",
                detail: null,
                sourceAuditId: "x1",
                rawAction: "publish_approval_pending",
              },
            ],
            activityTimelineOrder: "newest_first",
            analytics: {
              availability: {
                code: "not_published",
                message: "Analytics refresh runs after the post is published.",
              },
              metricSyncSupport: "no_adapter",
              latest: null,
              recentSnapshots: [],
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/campaign-analytics/refresh") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            succeededCount: 0,
            failedCount: 0,
            skippedCount: 0,
            attemptedCount: 0,
          }),
        } as Response;
      }
      if (u.includes("/api/social/external-review-tokens?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            tokens: [],
            primaryActiveToken: null,
            activeTokenCount: 0,
            lastExternalClientReview: null,
            postContext: {
              postId: "p1",
              pendingApproval: true,
              clientLinkCanAct: false,
              clientLinkGatedReason: "No active client review link for this campaign.",
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/paid-campaigns?") && !u.includes("/from-post")) {
        fetchHarness.paidCampaignsListFetchCount += 1;
        return {
          ok: true,
          json: async () => ({
            ok: true,
            paidCampaigns: [],
            paidRollup: null,
            paidListSignalsSummary: null,
            organicPromotionOpportunitySummary: null,
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("renders planner and mixed status row", async () => {
    await act(async () => {
      root.render(<RevenueOsPublishingPlanner />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="revenue-os-publishing-planner"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="planner-row-p1"]')).toBeTruthy();
    expect(container.textContent).toContain("Waiting for approval");
  });

  it("detail panel shows approval, publish, and timeline after row click", async () => {
    await act(async () => {
      root.render(<RevenueOsPublishingPlanner />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const row = container.querySelector('[data-testid="planner-row-p1"]') as HTMLButtonElement;
    await act(async () => {
      row.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="planner-approval-section"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="planner-publish-section"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="planner-activity-timeline"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="planner-timeline-submitted_for_approval"]')).toBeTruthy();
  });

  it("shows campaign analytics rollup when a campaign is selected", async () => {
    await act(async () => {
      root.render(<RevenueOsPublishingPlanner />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const block = container.querySelector('[data-testid="planner-campaign-analytics-summary"]');
    expect(block).toBeTruthy();
    expect(block?.textContent).toContain("Campaign performance");
    expect(block?.textContent).toContain("Published posts have no stored metrics");
    expect(container.querySelector('[data-testid="planner-campaign-analytics-provider-linkedin"]')).toBeTruthy();
  });

  it("list row shows client review link hint when pending and campaign has active link", async () => {
    await act(async () => {
      root.render(<RevenueOsPublishingPlanner />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="planner-row-client-link-hint-p1"]')).toBeTruthy();
  });

  it("detail panel shows client review operator section for governed post", async () => {
    await act(async () => {
      root.render(<RevenueOsPublishingPlanner />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const row = container.querySelector('[data-testid="planner-row-p1"]') as HTMLButtonElement;
    await act(async () => {
      row.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="planner-client-review-section"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="planner-client-review-post-signal"]')).toBeTruthy();
  });

  it("Part 60: promote to ads success refreshes and shows confirmation", async () => {
    fetchHarness.mode = "promote_ok";
    await act(async () => {
      root.render(<RevenueOsPublishingPlanner />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const row = container.querySelector(`[data-testid="planner-row-${POST_UUID}"]`) as HTMLButtonElement;
    expect(row).toBeTruthy();
    await act(async () => {
      row.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const promoteBtn = container.querySelector('[data-testid="planner-promote-to-ads"]') as HTMLButtonElement;
    expect(promoteBtn).toBeTruthy();
    await act(async () => {
      promoteBtn.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="planner-promote-success"]')?.textContent).toContain("Promoted: T");
  });

  it("Part 71: promote success shows promotion rollup from write response without list refetch supplying summary", async () => {
    fetchHarness.mode = "promote_ok";
    await act(async () => {
      root.render(<RevenueOsPublishingPlanner />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const row = container.querySelector(`[data-testid="planner-row-${POST_UUID}"]`) as HTMLButtonElement;
    await act(async () => {
      row.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const listFetchesBeforePromote = fetchHarness.paidCampaignsListFetchCount;

    const promoteBtn = container.querySelector('[data-testid="planner-promote-to-ads"]') as HTMLButtonElement;
    await act(async () => {
      promoteBtn.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const strip = container.querySelector('[data-testid="paid-social-promotion-decision-summary"]');
    expect(strip).toBeTruthy();
    expect(strip?.textContent).toContain("Organic-linked drafts:");
    expect(strip?.textContent).toContain("Promotions are generally outperforming original organic posts");
    expect(fetchHarness.paidCampaignsListFetchCount).toBe(listFetchesBeforePromote);
  });

  it("Part 74: promote_ok write JSON normalizes through buildPlannerPaidCampaignHydrationFromJson like the planner path", () => {
    const j = {
      ok: true,
      paidCampaign: { id: PAID_UUID },
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
    };
    const h = buildPlannerPaidCampaignHydrationFromJson(j, 1_700_000_000_000);
    expect(h.paidCampaign?.id).toBe(PAID_UUID);
    expect(h.promotionDecisionSummary?.referencedOrganicCount).toBe(2);
    expect(h.promotionDecisionSummary?.topStatusLabelText).toBe(
      "Promotions are generally outperforming original organic posts"
    );
  });

  it("Part 60: duplicate promote surfaces existing draft state without crashing or top error", async () => {
    fetchHarness.mode = "promote_dup";
    await act(async () => {
      root.render(<RevenueOsPublishingPlanner />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const row = container.querySelector(`[data-testid="planner-row-${POST_UUID}"]`) as HTMLButtonElement;
    expect(row).toBeTruthy();
    await act(async () => {
      row.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const promoteBtn = container.querySelector('[data-testid="planner-promote-to-ads"]') as HTMLButtonElement;
    expect(promoteBtn).toBeTruthy();
    await act(async () => {
      promoteBtn.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="planner-promote-existing"]')).toBeTruthy();
    expect(container.textContent).not.toContain("Could not create paid draft");
    expect(container.querySelector('[data-testid="planner-promote-conflict"]')).toBeFalsy();
  });
});
