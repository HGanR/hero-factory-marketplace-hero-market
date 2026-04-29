"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublishingPlannerItem } from "@/lib/social/publishing-planner";
import { groupPublishingPlannerItemsByDay } from "@/lib/social/publishing-planner";
import type {
  SocialActivityTimelineEntry,
  SocialPostApprovalDetail,
  SocialPostPublishDetail,
} from "@/lib/social/social-publish-observability";
import { compactSocialActivityTimelineForDisplay } from "@/lib/social/social-activity-timeline-ui-compact";
import { SocialPublishingStatusBadge } from "@/components/revenue-os/SocialPublishingStatusBadge";
import { BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY } from "@/lib/revenue-os/bentley-publish-approval-chat";
import { X_BENTLEY_PUBLISH_APPROVAL_SESSION } from "@/lib/social/effective-publish-approval-request";
import type { SocialPostAnalyticsPublic } from "@/lib/social/governed-post-analytics-types";
import { isGovernedSocialPublishPlatform } from "@/lib/social/social-governed-platforms";
import { ClientReviewLinkOperatorSection } from "@/components/revenue-os/ClientReviewLinkOperatorSection";
import { CampaignPublishingAnalyticsSummary } from "@/components/revenue-os/CampaignPublishingAnalyticsSummary";
import {
  buildPlannerPaidCampaignHydrationFromJson,
  type PaidCampaignFetchJson,
} from "@/components/revenue-os/paid-campaign";
import {
  PaidSocialCampaignSection,
  type PaidCampaignPublic,
  type PlannerPaidCampaignHydration,
} from "@/components/revenue-os/PaidSocialCampaignSection";

type ViewMode = "upcoming" | "calendar";

type AccountRow = {
  id: string;
  provider: string;
  displayName: string | null;
};

function monthQueryRange(d: Date): { from: string; to: string } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function RevenueOsPublishingPlanner() {
  const [clientId, setClientId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [providerFilter, setProviderFilter] = useState<"linkedin" | "facebook" | "instagram">("linkedin");
  const [items, setItems] = useState<PublishingPlannerItem[]>([]);
  const [view, setView] = useState<ViewMode>("calendar");
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PublishingPlannerItem | null>(null);
  const [approvalDetail, setApprovalDetail] = useState<SocialPostApprovalDetail | null>(null);
  const [publishDetail, setPublishDetail] = useState<SocialPostPublishDetail | null>(null);
  const [activityTimeline, setActivityTimeline] = useState<SocialActivityTimelineEntry[]>([]);
  const [postAnalytics, setPostAnalytics] = useState<SocialPostAnalyticsPublic | null>(null);
  const [organicPromotion, setOrganicPromotion] = useState<{
    eligible?: boolean;
    signals: Array<{ code: string; label: string; hint: string }>;
    candidateForPromotion: boolean;
    existingPromotion?: {
      exists: boolean;
      paidCampaignId: string;
      status: string;
      name?: string;
      paidCreativeSource?: "organic_post" | "manual";
    };
  } | null>(null);
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [promoteMessage, setPromoteMessage] = useState<string | null>(null);
  const [promoteConflictNotice, setPromoteConflictNotice] = useState<string | null>(null);
  const [analyticsRefreshing, setAnalyticsRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plannerRefreshToken, setPlannerRefreshToken] = useState(0);
  const [plannerPaidCampaignHydration, setPlannerPaidCampaignHydration] =
    useState<PlannerPaidCampaignHydration | null>(null);

  const [editContent, setEditContent] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editAssetId, setEditAssetId] = useState("");
  const [detailCampaignAssets, setDetailCampaignAssets] = useState<
    { id: string; label: string; creativeType: string; instagramPublishEligible?: boolean; facebookImageEligible?: boolean }[]
  >([]);

  const accountsForProvider = useMemo(
    () => accounts.filter((a) => a.provider === providerFilter),
    [accounts, providerFilter]
  );

  const accountsForDetailProvider = useMemo(
    () => (detail ? accounts.filter((a) => a.provider === detail.provider) : []),
    [accounts, detail]
  );

  const refreshPlanner = useCallback(async () => {
    if (!clientId) return;
    const { from, to } = monthQueryRange(monthCursor);
    const q = new URLSearchParams({
      clientId,
      from,
      to,
      provider: providerFilter,
    });
    if (campaignId) q.set("campaignId", campaignId);
    const r = await fetch(`/api/social/planner?${q.toString()}`);
    if (!r.ok) return;
    const j = (await r.json()) as { items?: PublishingPlannerItem[] };
    setItems(j.items ?? []);
    setPlannerRefreshToken((t) => t + 1);
  }, [clientId, campaignId, monthCursor, providerFilter]);

  useEffect(() => {
    if (!detail?.campaignId) {
      setDetailCampaignAssets([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await fetch(`/api/social/campaign-assets?campaignId=${encodeURIComponent(detail.campaignId)}`);
      if (!r.ok || cancelled) return;
      const j = (await r.json()) as {
        assets?: {
          id: string;
          label: string;
          creativeType: string;
          instagramPublishEligible?: boolean;
          facebookImageEligible?: boolean;
        }[];
      };
      if (!cancelled) setDetailCampaignAssets(j.assets ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [detail?.campaignId, selectedId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/clients/me");
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as { client?: { id: string } | null };
        if (j.client?.id) setClientId(j.client.id);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/campaigns?clientId=${encodeURIComponent(clientId)}`);
      if (!r.ok || cancelled) return;
      const j = (await r.json()) as { campaigns?: { id: string; name: string }[] };
      const list = j.campaigns ?? [];
      setCampaigns(list);
      if (!campaignId && list[0]) setCampaignId(list[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, campaignId]);

  useEffect(() => {
    if (!clientId) return;
    void (async () => {
      const r = await fetch(`/api/social/accounts?clientId=${encodeURIComponent(clientId)}`);
      if (!r.ok) return;
      const j = (await r.json()) as { accounts?: AccountRow[] };
      setAccounts(j.accounts ?? []);
    })();
  }, [clientId]);

  useEffect(() => {
    void refreshPlanner();
  }, [refreshPlanner]);

  useEffect(() => {
    setPlannerPaidCampaignHydration(null);
  }, [campaignId]);

  const grouped = useMemo(() => groupPublishingPlannerItemsByDay(items), [items]);

  const upcomingItems = useMemo(() => {
    const now = Date.now();
    return items.filter((i) => {
      const t = Date.parse(i.scheduledFor ?? "");
      return (Number.isFinite(t) && t >= now) || i.publishStatusLabel === "draft" || i.approvalStatus === "pending_approval";
    });
  }, [items]);

  const openDetail = async (
    id: string,
    opts?: { retainPromoteConflictNotice?: boolean; retainPromoteMessage?: boolean }
  ) => {
    setSelectedId(id);
    setError(null);
    setApprovalDetail(null);
    setPublishDetail(null);
    setActivityTimeline([]);
    setPostAnalytics(null);
    setOrganicPromotion(null);
    if (!opts?.retainPromoteMessage) setPromoteMessage(null);
    if (!opts?.retainPromoteConflictNotice) setPromoteConflictNotice(null);
    const q = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
    const r = await fetch(`/api/social/posts/${encodeURIComponent(id)}${q}`);
    if (!r.ok) {
      setDetail(null);
      return;
    }
    const j = (await r.json()) as {
      plannerItem?: PublishingPlannerItem;
      approvalDetail?: SocialPostApprovalDetail;
      publishDetail?: SocialPostPublishDetail;
      activityTimeline?: SocialActivityTimelineEntry[];
      analytics?: SocialPostAnalyticsPublic;
      organicPromotion?: {
        eligible?: boolean;
        signals: Array<{ code: string; label: string; hint: string }>;
        candidateForPromotion: boolean;
        existingPromotion?: {
          exists: boolean;
          paidCampaignId: string;
          status: string;
          name?: string;
          paidCreativeSource?: "organic_post" | "manual";
        };
      };
    };
    const it = j.plannerItem ?? null;
    setDetail(it);
    if (it && (it.provider === "linkedin" || it.provider === "facebook" || it.provider === "instagram")) {
      setProviderFilter(it.provider);
    }
    setApprovalDetail(j.approvalDetail ?? null);
    setPublishDetail(j.publishDetail ?? null);
    setActivityTimeline(j.activityTimeline ?? []);
    setPostAnalytics(j.analytics ?? null);
    setOrganicPromotion(j.organicPromotion ?? null);
    if (j.organicPromotion?.existingPromotion?.exists) setPromoteConflictNotice(null);
    if (it) {
      setEditContent(it.content);
      setEditSchedule(
        it.scheduledFor ? new Date(it.scheduledFor).toISOString().slice(0, 16) : ""
      );
      setEditLink(it.linkUrl ?? "");
      setEditAccountId(it.socialAccountId ?? "");
      setEditAssetId(it.assetId ?? "");
    }
  };

  const promotePostToPaidDraft = async () => {
    if (!detail?.campaignId || !detail.id || !campaignId) return;
    if (String(detail.status).toUpperCase() !== "POSTED") return;
    setPromoteBusy(true);
    setPromoteMessage(null);
    setPromoteConflictNotice(null);
    setError(null);
    try {
      const r = await fetch("/api/social/paid-campaigns/from-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: detail.campaignId, postId: detail.id }),
      });
      const j = (await r.json()) as PaidCampaignFetchJson<PaidCampaignPublic>;
      if (r.status === 409 && j.error === "duplicate_reference_organic_post") {
        setPromoteConflictNotice(
          j.existingName ? `Draft already exists (${j.existingName}).` : "A paid draft already exists for this post."
        );
        await refreshPlanner();
        if (selectedId) await openDetail(selectedId, { retainPromoteConflictNotice: true });
        return;
      }
      if (!r.ok) {
        setError(j.message || j.error || "Could not create paid draft.");
        return;
      }
      setPromoteMessage(
        j.paidCampaign?.internalName
          ? `Draft created: ${j.paidCampaign.internalName}. Open Paid social drafts below — launch is still manual.`
          : "Paid draft created. Open Paid social drafts below — launch is still manual."
      );
      setPlannerPaidCampaignHydration(buildPlannerPaidCampaignHydrationFromJson(j, Date.now()));
      await refreshPlanner();
      if (selectedId) await openDetail(selectedId, { retainPromoteMessage: true });
    } catch {
      setError("Could not create paid draft.");
    } finally {
      setPromoteBusy(false);
    }
  };

  const refreshPostAnalytics = async () => {
    if (!selectedId) return;
    setAnalyticsRefreshing(true);
    setError(null);
    try {
      const r = await fetch(`/api/social/posts/${encodeURIComponent(selectedId)}/analytics/refresh`, {
        method: "POST",
      });
      const j = (await r.json()) as {
        ok?: boolean;
        analytics?: SocialPostAnalyticsPublic;
        message?: string;
        code?: string;
      };
      if (j.analytics) {
        setPostAnalytics(j.analytics);
      }
      if (!r.ok || j.ok === false) {
        setError(j.message || "Metrics refresh failed");
      }
      await refreshPlanner();
    } catch {
      setError("Metrics refresh failed");
    } finally {
      setAnalyticsRefreshing(false);
    }
  };

  const savePatch = async (extra?: { resubmitForApproval?: boolean }) => {
    if (!selectedId || !detail) return;
    setSaving(true);
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (typeof window !== "undefined" && sessionStorage.getItem(BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY) === "1") {
        headers[X_BENTLEY_PUBLISH_APPROVAL_SESSION] = "1";
      }
      const body: Record<string, unknown> = {};
      if (editContent !== detail.content) body.content = editContent;
      if ((editSchedule || "") !== (detail.scheduledFor ? detail.scheduledFor.slice(0, 16) : "")) {
        body.scheduledFor = editSchedule ? new Date(editSchedule).toISOString() : null;
      }
      if ((editLink || "") !== (detail.linkUrl ?? "")) {
        body.linkUrl = editLink.trim() || null;
      }
      if ((editAccountId || "") !== (detail.socialAccountId ?? "")) {
        body.accountId = editAccountId || null;
      }
      if ((editAssetId || "") !== (detail.assetId ?? "")) {
        body.assetId = editAssetId.trim() || null;
      }
      if (extra?.resubmitForApproval) body.resubmitForApproval = true;

      const r = await fetch(`/api/social/posts/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((j as { message?: string }).message || (j as { error?: string }).error || "Save failed");
        return;
      }
      const pj = j as {
        plannerItem?: PublishingPlannerItem;
        approvalDetail?: SocialPostApprovalDetail;
        publishDetail?: SocialPostPublishDetail;
        activityTimeline?: SocialActivityTimelineEntry[];
      };
      if (pj.plannerItem) setDetail(pj.plannerItem);
      if (pj.approvalDetail) setApprovalDetail(pj.approvalDetail);
      if (pj.publishDetail) setPublishDetail(pj.publishDetail);
      if (pj.activityTimeline) setActivityTimeline(pj.activityTimeline);
      await refreshPlanner();
    } finally {
      setSaving(false);
    }
  };

  const displayGroups = view === "upcoming" ? [{ dayKey: "upcoming", items: upcomingItems }] : grouped;

  const displayActivityTimeline = useMemo(
    () => compactSocialActivityTimelineForDisplay(activityTimeline, { burstWindowMs: 2500 }),
    [activityTimeline]
  );

  return (
    <section
      data-testid="revenue-os-publishing-planner"
      className="rounded-2xl border border-cyan-500/35 bg-slate-900/70 p-4 shadow-[0_4px_24px_rgba(0,209,255,0.08)]"
      aria-label="Publishing planner"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Publishing planner</div>
          <p className="mt-0.5 text-[11px] text-slate-500 max-w-xl">
            Scan scheduled governed posts (LinkedIn, Facebook Page, Instagram Business), approval state, and readiness.
            Instagram needs an image asset before publish. Select a row to edit or resubmit after rejection.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded px-2 py-1 text-[11px] ${view === "calendar" ? "bg-cyan-600/40 text-white" : "bg-slate-800 text-slate-400"}`}
            onClick={() => setView("calendar")}
          >
            Calendar
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-[11px] ${view === "upcoming" ? "bg-cyan-600/40 text-white" : "bg-slate-800 text-slate-400"}`}
            onClick={() => setView("upcoming")}
          >
            Upcoming
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3 text-xs">
        <label className="block">
          <span className="text-slate-500">Campaign</span>
          <select
            className="mt-0.5 block rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">All in client</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.id}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-slate-500">Provider</span>
          <select
            data-testid="planner-provider-filter"
            className="mt-0.5 block rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value as "linkedin" | "facebook" | "instagram")}
          >
            <option value="linkedin">LinkedIn</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
        </label>
        <label className="block">
          <span className="text-slate-500">Month (UTC)</span>
          <input
            type="month"
            className="mt-0.5 block rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={`${monthCursor.getUTCFullYear()}-${String(monthCursor.getUTCMonth() + 1).padStart(2, "0")}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              if (y && m) setMonthCursor(new Date(Date.UTC(y, m - 1, 1)));
            }}
          />
        </label>
        <button
          type="button"
          className="rounded border border-slate-600 px-2 py-1 text-slate-300"
          onClick={() => void refreshPlanner()}
        >
          Refresh
        </button>
      </div>

      {campaignId ? (
        <>
          <CampaignPublishingAnalyticsSummary
            campaignId={campaignId}
            refreshToken={plannerRefreshToken}
            onBatchAnalyticsComplete={() => void refreshPlanner()}
          />
          <PaidSocialCampaignSection
            campaignId={campaignId}
            clientId={clientId}
            plannerPaidCampaignHydration={plannerPaidCampaignHydration}
          />
        </>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {displayGroups.map((g) => (
            <div key={g.dayKey}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                {g.dayKey === "upcoming" ? "Upcoming / drafts" : g.dayKey}
              </div>
              <ul className="space-y-2">
                {g.items.length === 0 ? (
                  <li className="text-[11px] text-slate-500">No posts.</li>
                ) : (
                  g.items.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        data-testid={`planner-row-${it.id}`}
                        onClick={() => void openDetail(it.id)}
                        className={`w-full text-left rounded border px-2 py-2 text-[11px] transition ${
                          selectedId === it.id
                            ? "border-cyan-500/60 bg-slate-950"
                            : "border-slate-800 bg-slate-950/50 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 justify-between">
                          <span className="text-slate-200 line-clamp-2">{it.contentPreview}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {it.fromSocialStudio ? (
                              <a
                                title="Originated in Social Studio — UTM carries run + variant ids"
                                className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-violet-500/25 text-violet-200 border border-violet-500/40"
                                href="/revenue-os/dashboard#social-studio"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Social Studio
                              </a>
                            ) : null}
                            <SocialPublishingStatusBadge item={it} />
                          </div>
                        </div>
                        <div className="mt-0.5 text-[9px] text-slate-600 capitalize">{it.provider}</div>
                        <div className="mt-1 text-slate-500">
                          {it.scheduledFor
                            ? new Date(it.scheduledFor).toLocaleString(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "Unscheduled"}
                          {it.approvalBlocked ? " · blocked from publish" : ""}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">
                          {it.blockedReason && it.blockedReasonCode !== "none"
                            ? it.blockedReason
                            : it.publishReadiness}
                        </div>
                        {it.analyticsSummaryLine ? (
                          <div
                            data-testid={`planner-row-analytics-${it.id}`}
                            className="mt-0.5 text-[9px] text-slate-500"
                          >
                            {it.analyticsSummaryLine}
                          </div>
                        ) : null}
                        {it.approvalStatus === "pending_approval" && it.hasActiveClientReviewLink ? (
                          <div
                            data-testid={`planner-row-client-link-hint-${it.id}`}
                            className="mt-0.5 text-[9px] text-violet-300/90"
                          >
                            Active client review link (campaign)
                          </div>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>

        <div
          data-testid="planner-detail-panel"
          className="rounded border border-slate-800 bg-slate-950/80 p-3 text-xs space-y-2"
        >
          {!detail ? (
            <p className="text-slate-500">Select a post to view details.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                {detail.fromSocialStudio ? (
                  <a
                    className="rounded px-2 py-0.5 text-[10px] font-semibold bg-violet-500/25 text-violet-200 border border-violet-500/40"
                    href="/revenue-os/dashboard#social-studio"
                    title="Open Social Studio (same product lineage: from_social_studio in UTM)"
                  >
                    From Social Studio
                  </a>
                ) : null}
                <SocialPublishingStatusBadge item={detail} />
                {detail.totalApprovalSteps != null && detail.totalApprovalSteps > 1 ? (
                  <span className="text-[10px] text-slate-500">
                    Step {(detail.currentApprovalStepIndex ?? 0) + 1}/{detail.totalApprovalSteps} (
                    {detail.currentApprovalRequiredRole ?? "—"})
                  </span>
                ) : null}
                {detail.overdueSeverity !== "none" ? (
                  <span
                    data-testid="planner-overdue-indicator"
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      detail.overdueSeverity === "attention"
                        ? "bg-amber-500/25 text-amber-100"
                        : "bg-slate-700/80 text-slate-300"
                    }`}
                  >
                    {detail.overdueSeverity === "attention" ? "Approval overdue" : "Approval slow"}
                  </span>
                ) : null}
              </div>

              {(detail.blockedReason && detail.blockedReasonCode !== "none") || detail.operatorNextActionHint ? (
                <div
                  data-testid="planner-readiness-box"
                  className="rounded border border-slate-700 bg-slate-900/90 px-2 py-1.5 space-y-1"
                >
                  {detail.blockedReason && detail.blockedReasonCode !== "none" ? (
                    <p className="text-[11px] text-slate-100 leading-snug">
                      <span className="font-semibold text-slate-400">Why not publishing: </span>
                      {detail.blockedReason}
                    </p>
                  ) : (
                    <p className="text-[11px] text-cyan-200/90 leading-snug">{detail.publishReadiness}</p>
                  )}
                  {detail.operatorNextActionHint ? (
                    <p className="text-[10px] text-slate-400 leading-snug">
                      <span className="font-semibold text-slate-500">Next: </span>
                      {detail.operatorNextActionHint}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-[11px] text-cyan-200/90 leading-snug">{detail.publishReadiness}</p>
              )}

              {approvalDetail ? (
                <div data-testid="planner-approval-section" className="space-y-1 border-t border-slate-800 pt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Approval</div>
                  <p className="text-[11px] text-slate-300">{approvalDetail.chainSummary}</p>
                  {approvalDetail.currentStepDisplay ? (
                    <p className="text-[10px] text-slate-500">Progress: {approvalDetail.currentStepDisplay}</p>
                  ) : null}
                  {approvalDetail.currentApproverLabel ? (
                    <p className="text-[10px] text-slate-500">{approvalDetail.currentApproverLabel}</p>
                  ) : null}
                  {approvalDetail.pendingSince ? (
                    <p className="text-[10px] text-slate-500">
                      Pending since {new Date(approvalDetail.pendingSince).toLocaleString()}
                    </p>
                  ) : null}
                  {approvalDetail.approvedAt ? (
                    <p className="text-[10px] text-slate-500">
                      Approved at {new Date(approvalDetail.approvedAt).toLocaleString()}
                    </p>
                  ) : null}
                  {approvalDetail.rejectedAt ? (
                    <p className="text-[10px] text-slate-500">
                      Rejected at {new Date(approvalDetail.rejectedAt).toLocaleString()}
                    </p>
                  ) : null}
                  {approvalDetail.lastActionSummary ? (
                    <p className="text-[10px] text-slate-500">
                      Last approval action: {approvalDetail.lastActionSummary}
                      {approvalDetail.lastActionAt
                        ? ` · ${new Date(approvalDetail.lastActionAt).toLocaleString()}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {detail.campaignId &&
              detail.id &&
              isGovernedSocialPublishPlatform(detail.provider) ? (
                <ClientReviewLinkOperatorSection
                  campaignId={detail.campaignId}
                  postId={detail.id}
                  approvalStatus={detail.approvalStatus}
                  campaignName={campaigns.find((c) => c.id === detail.campaignId)?.name ?? null}
                  onLinksChanged={() => void refreshPlanner()}
                />
              ) : null}

              {publishDetail ? (
                <div data-testid="planner-publish-section" className="space-y-1 border-t border-slate-800 pt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Publishing</div>
                  <p className="text-[11px] text-slate-300 capitalize">{publishDetail.publishStatusLabel.replace(/_/g, " ")}</p>
                  {publishDetail.lastAttemptedAt ? (
                    <p className="text-[10px] text-slate-500">
                      Last attempt {new Date(publishDetail.lastAttemptedAt).toLocaleString()}
                    </p>
                  ) : null}
                  {publishDetail.lastSuccessAt ? (
                    <p className="text-[10px] text-slate-500">
                      Published {new Date(publishDetail.lastSuccessAt).toLocaleString()}
                    </p>
                  ) : null}
                  {publishDetail.lastFailureSummary ? (
                    <p data-testid="planner-publish-error" className="text-[10px] text-rose-200/90">
                      {publishDetail.lastFailureSummary}
                    </p>
                  ) : null}
                  <p className="text-[10px] text-slate-500">
                    {publishDetail.retryable
                      ? "Retry scheduled — worker will try again."
                      : publishDetail.publishBlocked
                        ? "Publish is blocked until approval or errors are resolved."
                        : "Not blocked for publish."}
                  </p>
                </div>
              ) : null}

              {String(detail.status).toUpperCase() === "POSTED" && postAnalytics ? (
                <div data-testid="planner-analytics-section" className="space-y-1.5 border-t border-slate-800 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Post performance
                    </div>
                    <button
                      type="button"
                      data-testid="planner-analytics-refresh"
                      disabled={
                        analyticsRefreshing ||
                        postAnalytics.metricSyncSupport !== "live" ||
                        postAnalytics.availability.code === "missing_external_post_id"
                      }
                      className="rounded border border-slate-600 px-2 py-0.5 text-[10px] text-slate-200 disabled:opacity-40"
                      onClick={() => void refreshPostAnalytics()}
                    >
                      {analyticsRefreshing ? "Refreshing…" : "Refresh metrics"}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">{postAnalytics.availability.message}</p>
                  {postAnalytics.availability.detail ? (
                    <p className="text-[9px] text-slate-500 leading-snug">{postAnalytics.availability.detail}</p>
                  ) : null}
                  {postAnalytics.latest ? (
                    <div className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1.5 space-y-1">
                      <p className="text-[9px] text-slate-500">
                        Synced {new Date(postAnalytics.latest.fetchedAt).toLocaleString()} · {detail.provider} · snapshot{" "}
                        {postAnalytics.latest.snapshotType}
                      </p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                        {postAnalytics.latest.metrics.impressions != null ? (
                          <div className="flex justify-between gap-1">
                            <span className="text-slate-500">Impressions</span>
                            <span className="text-slate-100 tabular-nums">{postAnalytics.latest.metrics.impressions}</span>
                          </div>
                        ) : null}
                        {postAnalytics.latest.metrics.reach != null ? (
                          <div className="flex justify-between gap-1">
                            <span className="text-slate-500">Reach</span>
                            <span className="text-slate-100 tabular-nums">{postAnalytics.latest.metrics.reach}</span>
                          </div>
                        ) : null}
                        {postAnalytics.latest.metrics.engagementsTotal != null ? (
                          <div className="flex justify-between gap-1">
                            <span className="text-slate-500">Engagement</span>
                            <span className="text-slate-100 tabular-nums">{postAnalytics.latest.metrics.engagementsTotal}</span>
                          </div>
                        ) : null}
                        {postAnalytics.latest.metrics.reactions != null ? (
                          <div className="flex justify-between gap-1">
                            <span className="text-slate-500">Reactions</span>
                            <span className="text-slate-100 tabular-nums">{postAnalytics.latest.metrics.reactions}</span>
                          </div>
                        ) : null}
                        {postAnalytics.latest.metrics.comments != null ? (
                          <div className="flex justify-between gap-1">
                            <span className="text-slate-500">Comments</span>
                            <span className="text-slate-100 tabular-nums">{postAnalytics.latest.metrics.comments}</span>
                          </div>
                        ) : null}
                        {postAnalytics.latest.metrics.saves != null ? (
                          <div className="flex justify-between gap-1">
                            <span className="text-slate-500">Saves</span>
                            <span className="text-slate-100 tabular-nums">{postAnalytics.latest.metrics.saves}</span>
                          </div>
                        ) : null}
                        {postAnalytics.latest.metrics.videoViews != null ? (
                          <div className="flex justify-between gap-1">
                            <span className="text-slate-500">Video views</span>
                            <span className="text-slate-100 tabular-nums">{postAnalytics.latest.metrics.videoViews}</span>
                          </div>
                        ) : null}
                        {postAnalytics.latest.metrics.clicks != null ? (
                          <div className="flex justify-between gap-1">
                            <span className="text-slate-500">Clicks</span>
                            <span className="text-slate-100 tabular-nums">{postAnalytics.latest.metrics.clicks}</span>
                          </div>
                        ) : null}
                      </div>
                      {postAnalytics.latest.comparatorCaveat ? (
                        <p className="text-[9px] text-amber-200/80 leading-snug border-t border-slate-800 pt-1 mt-1">
                          {postAnalytics.latest.comparatorCaveat}
                        </p>
                      ) : null}
                      {postAnalytics.latest.sourceNotes.length > 0 ? (
                        <ul className="text-[9px] text-slate-500 list-disc pl-3 space-y-0.5">
                          {postAnalytics.latest.sourceNotes.slice(0, 4).map((note, i) => (
                            <li key={i}>{note}</li>
                          ))}
                        </ul>
                      ) : null}
                      {organicPromotion && organicPromotion.signals.length > 0 ? (
                        <div
                          data-testid="planner-organic-promotion-signals"
                          className="mt-1.5 rounded border border-emerald-900/40 bg-emerald-950/15 px-2 py-1 space-y-0.5"
                        >
                          <div className="text-[9px] font-medium text-emerald-200/85">Promotion ideas (organic)</div>
                          <ul className="list-none space-y-0.5">
                            {organicPromotion.signals.map((s) => (
                              <li key={s.code} className="text-[9px] text-slate-400 leading-snug">
                                <span className="text-emerald-100/90">{s.label}</span>
                                {s.hint ? <span className="text-slate-500"> — {s.hint}</span> : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : postAnalytics.availability.code === "not_published" ? null : (
                    <p className="text-[10px] text-slate-500">
                      {postAnalytics.metricSyncSupport === "no_adapter"
                        ? "Live metrics are not wired for this provider; stored history (if any) may still appear after manual imports or future jobs."
                        : "No metrics row yet — refresh once the network post is available to the connected account."}
                    </p>
                  )}
                  {campaignId && String(detail.status).toUpperCase() === "POSTED" ? (
                    <div className="mt-2 flex flex-col gap-1 border-t border-slate-800 pt-2">
                      {organicPromotion?.existingPromotion?.exists ? (
                        <p data-testid="planner-promote-existing" className="text-[9px] text-slate-400 leading-snug">
                          Draft already exists for this post in paid social. Open Paid social drafts below.
                        </p>
                      ) : (
                        <>
                          <button
                            type="button"
                            data-testid="planner-promote-to-ads"
                            disabled={promoteBusy}
                            className="w-fit rounded border border-emerald-700/50 bg-emerald-950/35 px-2 py-1 text-[10px] font-medium text-emerald-100 disabled:opacity-40"
                            onClick={() => void promotePostToPaidDraft()}
                          >
                            {promoteBusy ? "Creating draft…" : "Promote to ads (Meta draft)"}
                          </button>
                          <p className="text-[9px] text-slate-600 leading-snug">
                            Creates a Meta ads draft linked to this post. Does not launch — complete paid settings and use Launch
                            to Meta when ready.
                          </p>
                        </>
                      )}
                      {promoteMessage ? (
                        <p data-testid="planner-promote-success" className="text-[9px] text-emerald-200/90">
                          {promoteMessage}
                        </p>
                      ) : null}
                      {promoteConflictNotice ? (
                        <p data-testid="planner-promote-conflict" className="text-[9px] text-amber-200/90 leading-snug">
                          {promoteConflictNotice}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {displayActivityTimeline.length > 0 ? (
                <div data-testid="planner-activity-timeline" className="border-t border-slate-800 pt-2 space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Activity (newest first)
                  </div>
                  <p className="text-[9px] text-slate-600 leading-snug">
                    Closely spaced edits from one save may show as a single summary; audit rows are unchanged.
                  </p>
                  <ul className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {displayActivityTimeline.slice(0, 25).map((row, idx) =>
                      row.mode === "burst" ? (
                        <li
                          key={`burst-${row.at}-${idx}`}
                          data-testid="planner-timeline-burst"
                          className="text-[10px] border-l-2 border-cyan-600/40 pl-2 text-slate-400"
                        >
                          <div className="text-slate-200">{row.label}</div>
                          <div className="text-slate-500">{new Date(row.at).toLocaleString()}</div>
                          {row.detail ? <div className="text-slate-500 mt-0.5">{row.detail}</div> : null}
                        </li>
                      ) : (
                        <li
                          key={`${row.entry.at}-${row.entry.kind}-${idx}`}
                          data-testid={`planner-timeline-${row.entry.kind}`}
                          className="text-[10px] border-l-2 border-cyan-600/40 pl-2 text-slate-400"
                        >
                          <div className="text-slate-200">{row.entry.label}</div>
                          <div className="text-slate-500">{new Date(row.entry.at).toLocaleString()}</div>
                          {row.entry.detail ? <div className="text-slate-500 mt-0.5">{row.entry.detail}</div> : null}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              ) : null}

              {detail.rejectionReason ? (
                <div
                  data-testid="planner-rejection-reason"
                  className="rounded border border-rose-500/40 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-100"
                >
                  <span className="font-semibold">Rejection reason: </span>
                  {detail.rejectionReason}
                </div>
              ) : null}

              {detail.editCapabilities.readOnly ? (
                <p className="text-slate-500">{detail.editCapabilities.readOnlyReason}</p>
              ) : (
                <>
                  <label className="block">
                    <span className="text-slate-500">Content</span>
                    <textarea
                      data-testid="planner-edit-content"
                      disabled={!detail.editCapabilities.canEditContent}
                      className="mt-0.5 w-full min-h-[100px] rounded border border-slate-700 bg-slate-900 px-2 py-1"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500">Schedule</span>
                    <input
                      type="datetime-local"
                      disabled={!detail.editCapabilities.canEditSchedule}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                      value={editSchedule}
                      onChange={(e) => setEditSchedule(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500">Link URL</span>
                    <input
                      type="url"
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                      value={editLink}
                      onChange={(e) => setEditLink(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500 capitalize">{detail.provider} account</span>
                    <select
                      disabled={!detail.editCapabilities.canEditAccount}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                      value={editAccountId}
                      onChange={(e) => setEditAccountId(e.target.value)}
                    >
                      <option value="">—</option>
                      {accountsForDetailProvider.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.displayName || a.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  {detail.provider === "instagram" || detail.provider === "facebook" || detail.provider === "linkedin" ? (
                    <label className="block">
                      <span className="text-slate-500">Campaign media asset</span>
                      <select
                        data-testid="planner-edit-asset"
                        disabled={!detail.editCapabilities.canEditAsset}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                        value={editAssetId}
                        onChange={(e) => setEditAssetId(e.target.value)}
                      >
                        <option value="">None</option>
                        {detailCampaignAssets.map((a) => {
                          const ig = detail.provider === "instagram" && a.instagramPublishEligible === false;
                          const fb = detail.provider === "facebook" && a.facebookImageEligible === false;
                          const disabled = ig || fb;
                          return (
                            <option key={a.id} value={a.id} disabled={disabled}>
                              {a.label}
                              {ig ? " (not IG-publishable)" : ""}
                              {fb ? " (not FB image)" : ""}
                            </option>
                          );
                        })}
                      </select>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {detail.provider === "instagram"
                          ? "IMAGE or VIDEO with storage URL required before schedule/publish."
                          : detail.provider === "facebook"
                            ? "Optional IMAGE for photo post; text/link still supported without."
                            : "Optional — LinkedIn adapter still publishes text/link only; asset stored for future use."}
                      </p>
                    </label>
                  ) : null}
                  {error ? <p className="text-amber-400 text-[11px]">{error}</p> : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      data-testid="planner-save"
                      disabled={saving}
                      className="rounded bg-cyan-600/90 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
                      onClick={() => void savePatch()}
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    {detail.editCapabilities.canResubmitAfterRejection ? (
                      <button
                        type="button"
                        data-testid="planner-resubmit"
                        disabled={saving}
                        className="rounded border border-rose-500/50 px-3 py-1.5 text-[11px] text-rose-100 disabled:opacity-50"
                        onClick={() => void savePatch({ resubmitForApproval: true })}
                      >
                        Resubmit for approval
                      </button>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Material edits (copy, link, account, media asset, schedule) reset approval when the worker approval gate is on.
                    Rejected posts: revise, then use Resubmit for approval.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
