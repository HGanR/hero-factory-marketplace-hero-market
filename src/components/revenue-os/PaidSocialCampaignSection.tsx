"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PAID_SOCIAL_PLACEMENT_IDS,
  paidSocialProviderDisplayLabel,
  type PaidSocialCampaignReadiness,
  type PaidSocialPlacementId,
} from "@/lib/social/paid-social-campaign-readiness";
import { paidLaunchLifecycleLabel, paidMetaRuntimeStatusLabel } from "@/lib/social/paid-social-campaign-state";
import { formatPaidMetaSyncErrorSummary } from "@/lib/social/paid-social-campaign-sync-health";
import type {
  CrossSurfaceComparisonReadiness,
  CrossSurfacePromotionOutcomes,
} from "@/lib/social/cross-surface-analytics-signals";
import type { OrganicPromotionOpportunitySummary } from "@/lib/social/organic-performance-signals";
import type { PaidSocialCampaignRollup } from "@/lib/social/paid-social-campaign-paid-rollup";
import type { PaidListSignalsSummary as PaidListSignalsSummaryApi } from "@/lib/social/paid-social-optimization-signals";
import type { PromotionDecisionSummary } from "@/lib/social/paid-social-campaigns";
import {
  promotionDecisionDominantReasonText,
  promotionDecisionTopStatusLabelText,
} from "@/lib/social/paid-social-campaigns";
import {
  parsePaidCampaignHydrationFromJson,
  type PaidCampaignFetchJson,
  type PaidCampaignListFetchJson,
} from "@/components/revenue-os/paid-campaign";

export type PaidCampaignPublic = {
  id: string;
  campaignId: string;
  provider: string;
  internalName: string;
  adSetName: string | null;
  adName: string | null;
  objective: string;
  draftStatus: string;
  budgetType: string;
  budgetAmountMinor: number | null;
  currency: string;
  startAt: string | null;
  endAt: string | null;
  destinationUrl: string | null;
  ctaLabel: string | null;
  leadFormPlaceholder: string | null;
  audience: {
    geography?: string;
    ageMin?: number;
    ageMax?: number;
    interestsNotes?: string;
    customAudiencePlaceholder?: string;
  };
  placements: string[];
  creative: {
    primaryAssetIds?: string[];
    referenceOrganicPostId?: string | null;
    notes?: string;
  };
  readiness: PaidSocialCampaignReadiness;
  metaLaunchFeatureEnabled?: boolean;
  metaAdAccountId?: string | null;
  metaPageId?: string | null;
  metaFacebookSocialAccountId?: string | null;
  metaLaunchStatus?: string;
  remoteMetaCampaignId?: string | null;
  remoteMetaAdsetId?: string | null;
  remoteMetaCreativeId?: string | null;
  remoteMetaAdId?: string | null;
  lastLaunchError?: unknown;
  launchedAt?: string | null;
  lastMetaSyncAt?: string | null;
  paidLaunchLifecycle?: string;
  metaRuntimeStatus?: string | null;
  lastMetaSyncError?: unknown;
  latestPaidMetrics?: {
    impressions?: number | null;
    clicks?: number | null;
    spendMinor?: number | null;
    reach?: number | null;
    cpcMinor?: number | null;
    cpmMinor?: number | null;
    ctr?: number | null;
  } | null;
  latestPaidMetricsFetchedAt?: string | null;
  updatedAt?: string | null;
  latestSnapshotMeta?: {
    metricsCompleteness?: string;
    sourceNotes?: string[];
    insightsSource?: string | null;
    usedFallbackInsights?: boolean;
  } | null;
  paidSyncHealth?: { label: string; tone: string; hint: string };
  /** Part 52: structured sync error (token / throttle / etc.), separate from sync health when present. */
  paidStructuredSyncError?: {
    state: string;
    label: string;
    tone: string;
    hint: string;
    retryWorthwhile: string;
  } | null;
  syncCooldownActive?: boolean;
  syncCooldownUntil?: string | null;
  syncCooldownReason?: string | null;
  syncCooldownLabel?: string | null;
  syncCooldownHint?: string | null;
  paidOptimizationSignals?: Array<{ code: string; label: string; hint: string }>;
  /** Same as `creative.referenceOrganicPostId` — `campaign_posts.id` (Part 59). */
  referenceCampaignPostId?: string | null;
  paidCreativeSource?: "organic_post" | "manual";
  crossSurfaceSignals?: Array<{ code: string; label: string; hint: string }>;
  /** Part 61: promotion vs originating organic when both sides have metrics. */
  crossSurfacePromotionOutcomes?: CrossSurfacePromotionOutcomes;
  /** Part 62: snapshot / timing alignment for paid vs organic comparison. */
  crossSurfaceComparisonReadiness?: CrossSurfaceComparisonReadiness;
};

type PaidListSignalsSummary = PaidListSignalsSummaryApi | null;

/** Part 65–67: prefers API `...Text` fields; falls back to codes + count heuristics. */
function promotionDecisionExplainLine(summary: PromotionDecisionSummary): string | null {
  if (summary.topStatusLabel != null || summary.explainabilityStatus === "ready") return null;

  const needsExplain =
    summary.explainabilityStatus === "insufficient_comparable_rows" ||
    (summary.explainabilityStatus == null &&
      summary.referencedOrganicCount > 0 &&
      summary.comparableCount < 2);

  if (!needsExplain || summary.referencedOrganicCount <= 0) return null;

  const base =
    summary.explainabilityStatusText ??
    "Need at least 2 comparable linked drafts for a campaign-level promotion summary.";

  if (summary.dominantNonComparableReasonText) {
    return `${base} ${summary.dominantNonComparableReasonText}`;
  }

  const dom = summary.dominantNonComparableReason;
  if (dom) {
    const fromCode = promotionDecisionDominantReasonText(dom);
    if (fromCode) return `${base} ${fromCode}`;
  }

  let extra = "";
  const rc = summary.nonComparableReasonCounts;
  if (rc && Object.keys(rc).length > 0) {
    const pairs = Object.entries(rc).filter(([, n]) => n > 0) as [
      keyof NonNullable<PromotionDecisionSummary["nonComparableReasonCounts"]>,
      number,
    ][];
    if (pairs.length > 0) {
      const max = Math.max(...pairs.map(([, n]) => n));
      const top = pairs.filter(([, n]) => n === max);
      if (top.length === 1 && top[0][0] === "window_too_early") {
        extra = ` ${promotionDecisionDominantReasonText("window_too_early")}`;
      } else if ((rc.insufficient_sample ?? 0) > 0) {
        extra = ` ${promotionDecisionDominantReasonText("insufficient_sample")}`;
      }
    }
  }

  return `${base}${extra}`;
}

const PLACEMENT_LABELS: Record<PaidSocialPlacementId, string> = {
  facebook_feed: "Facebook feed",
  instagram_feed: "Instagram feed",
  instagram_reels: "Instagram Reels",
  facebook_reels: "Facebook Reels",
  instagram_stories: "Instagram Stories",
  facebook_stories: "Facebook Stories",
};

function placementLabel(id: string): string {
  return PLACEMENT_LABELS[id as PaidSocialPlacementId] ?? id;
}

function syncHealthBadgeClass(tone: string): string {
  switch (tone) {
    case "positive":
      return "border-emerald-700/60 bg-emerald-950/40 text-emerald-100";
    case "warning":
      return "border-amber-700/55 bg-amber-950/35 text-amber-100";
    case "negative":
      return "border-red-700/55 bg-red-950/35 text-red-100";
    case "muted":
      return "border-slate-700/60 bg-slate-900/50 text-slate-400";
    default:
      return "border-slate-700/60 bg-slate-900/50 text-slate-300";
  }
}

function structuredSyncErrorBadgeClass(tone: string): string {
  switch (tone) {
    case "negative":
      return "border-rose-800/60 bg-rose-950/40 text-rose-100";
    case "warning":
      return "border-amber-700/55 bg-amber-950/35 text-amber-100";
    default:
      return "border-slate-700/60 bg-slate-900/50 text-slate-300";
  }
}

function retryWorthwhileLabel(v: string): string {
  switch (v) {
    case "now":
      return "Retry may succeed now";
    case "later":
      return "Retry later (cooldown / rate limits)";
    case "unlikely":
      return "Fix configuration before retry";
    default:
      return v;
  }
}

type AssetOpt = { id: string; label: string; creativeType: string };
type PostOpt = { id: string; provider?: string };
type FbAccountOpt = { id: string; displayName?: string | null; provider?: string };

export type PlannerPaidCampaignHydration = {
  at: number;
  paidCampaign?: PaidCampaignPublic;
  promotionDecisionSummary: PromotionDecisionSummary | null;
};

export function PaidSocialCampaignSection(props: {
  campaignId: string;
  clientId: string;
  /** Planner promote / external writes: upsert draft + rollup without waiting on list GET (Part 71). */
  plannerPaidCampaignHydration?: PlannerPaidCampaignHydration | null;
}) {
  const { campaignId, clientId, plannerPaidCampaignHydration } = props;
  const [items, setItems] = useState<PaidCampaignPublic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [launchBusy, setLaunchBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetOpt[]>([]);
  const [posts, setPosts] = useState<PostOpt[]>([]);
  const [fbAccounts, setFbAccounts] = useState<FbAccountOpt[]>([]);
  const [paidRollup, setPaidRollup] = useState<PaidSocialCampaignRollup | null>(null);
  const [paidListSignalsSummary, setPaidListSignalsSummary] = useState<PaidListSignalsSummary>(null);
  const [organicPromotionOpportunitySummary, setOrganicPromotionOpportunitySummary] =
    useState<OrganicPromotionOpportunitySummary | null>(null);
  const [promotionDecisionSummary, setPromotionDecisionSummary] = useState<PromotionDecisionSummary | null>(null);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/social/paid-campaigns?campaignId=${encodeURIComponent(campaignId)}`);
      const j = (await r.json()) as PaidCampaignListFetchJson;
      if (!r.ok) {
        setError(j.error || "Failed to load paid campaigns.");
        return;
      }
      setItems(j.paidCampaigns ?? []);
      setPaidRollup(j.paidRollup ?? null);
      setPaidListSignalsSummary(j.paidListSignalsSummary ?? null);
      setOrganicPromotionOpportunitySummary(j.organicPromotionOpportunitySummary ?? null);
      setPromotionDecisionSummary(j.promotionDecisionSummary ?? null);
      setSelectedId((cur) => {
        if (cur && (j.paidCampaigns ?? []).some((p) => p.id === cur)) return cur;
        return (j.paidCampaigns ?? [])[0]?.id ?? null;
      });
    } catch {
      setError("Failed to load paid campaigns.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!plannerPaidCampaignHydration) return;
    setPromotionDecisionSummary(plannerPaidCampaignHydration.promotionDecisionSummary);
    const pc = plannerPaidCampaignHydration.paidCampaign;
    if (pc?.id) {
      setItems((prev) => {
        const idx = prev.findIndex((x) => x.id === pc.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...pc };
          return next;
        }
        return [pc, ...prev];
      });
      setSelectedId(pc.id);
    }
  }, [plannerPaidCampaignHydration?.at]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [ar, pr] = await Promise.all([
        fetch(`/api/social/campaign-assets?campaignId=${encodeURIComponent(campaignId)}`),
        fetch(`/api/social/posts?campaignId=${encodeURIComponent(campaignId)}`),
      ]);
      if (cancelled) return;
      if (ar.ok) {
        const aj = (await ar.json()) as { assets?: AssetOpt[] };
        setAssets(aj.assets ?? []);
      }
      if (pr.ok) {
        const pj = (await pr.json()) as { posts?: { id: string; provider?: string }[] };
        setPosts((pj.posts ?? []).map((p) => ({ id: p.id, provider: p.provider })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  useEffect(() => {
    if (!clientId) {
      setFbAccounts([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await fetch(`/api/social/accounts?clientId=${encodeURIComponent(clientId)}`);
      if (!r.ok || cancelled) return;
      const j = (await r.json()) as { accounts?: { id: string; displayName?: string | null; provider?: string }[] };
      const fb = (j.accounts ?? []).filter((a) => a.provider === "facebook");
      if (!cancelled) setFbAccounts(fb.map((a) => ({ id: a.id, displayName: a.displayName, provider: a.provider })));
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function createDraft() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/social/paid-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, provider: "meta_ads" }),
      });
      const j = (await r.json()) as PaidCampaignFetchJson<PaidCampaignPublic>;
      if (!r.ok) {
        setError(j.error || "Create failed.");
        return;
      }
      const h = parsePaidCampaignHydrationFromJson<PaidCampaignPublic>(j);
      setPromotionDecisionSummary(h.promotionDecisionSummary);
      if (h.paidCampaign) {
        setItems((prev) => [h.paidCampaign!, ...prev]);
        setSelectedId(h.paidCampaign.id);
      } else {
        await loadList();
      }
    } catch {
      setError("Create failed.");
    } finally {
      setSaving(false);
    }
  }

  async function savePatch(patch: Record<string, unknown>) {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/social/paid-campaigns/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, ...patch }),
      });
      const j = (await r.json()) as PaidCampaignFetchJson<PaidCampaignPublic>;
      if (!r.ok) {
        setError(j.message || j.error || "Save failed.");
        return;
      }
      const h = parsePaidCampaignHydrationFromJson<PaidCampaignPublic>(j);
      setPromotionDecisionSummary(h.promotionDecisionSummary);
      if (h.paidCampaign) {
        setItems((prev) => prev.map((p) => (p.id === h.paidCampaign!.id ? h.paidCampaign! : p)));
      }
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function togglePlacement(id: PaidSocialPlacementId, on: boolean) {
    if (!selected) return;
    const cur = new Set(selected.placements);
    if (on) cur.add(id);
    else cur.delete(id);
    void savePatch({ placements: Array.from(cur) });
  }

  async function launchMeta() {
    if (!selected) return;
    setLaunchBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/social/paid-campaigns/${encodeURIComponent(selected.id)}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const j = (await r.json()) as PaidCampaignFetchJson<PaidCampaignPublic>;
      if (!r.ok || !j.ok) {
        setError(j.message || j.error || "Launch failed.");
        return;
      }
      const h = parsePaidCampaignHydrationFromJson<PaidCampaignPublic>(j);
      setPromotionDecisionSummary(h.promotionDecisionSummary);
      if (h.paidCampaign) {
        setItems((prev) => prev.map((p) => (p.id === h.paidCampaign!.id ? h.paidCampaign! : p)));
      } else {
        await loadList();
      }
    } catch {
      setError("Launch failed.");
    } finally {
      setLaunchBusy(false);
    }
  }

  async function syncMeta() {
    if (!selectedId) return;
    setSyncBusy(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/social/paid-campaigns/${encodeURIComponent(selectedId)}/sync?campaignId=${encodeURIComponent(campaignId)}`
      );
      const j = (await r.json()) as PaidCampaignFetchJson<PaidCampaignPublic>;
      if (!r.ok || !j.ok) {
        setError(j.message || j.error || "Sync failed.");
        return;
      }
      const h = parsePaidCampaignHydrationFromJson<PaidCampaignPublic>(j);
      setPromotionDecisionSummary(h.promotionDecisionSummary);
      if (h.paidCampaign) {
        setItems((prev) => prev.map((p) => (p.id === h.paidCampaign!.id ? h.paidCampaign! : p)));
      } else {
        await loadList();
      }
    } catch {
      setError("Sync failed.");
    } finally {
      setSyncBusy(false);
    }
  }

  const launchFlagOn = Boolean(selected?.metaLaunchFeatureEnabled);
  const canSyncMeta =
    launchFlagOn &&
    Boolean(selected?.remoteMetaCampaignId || selected?.remoteMetaAdId || selected?.remoteMetaAdsetId);
  const selectedPaidSyncErrorSummary = selected ? formatPaidMetaSyncErrorSummary(selected.lastMetaSyncError) : null;

  return (
    <div
      data-testid="paid-social-campaign-section"
      className="mt-3 rounded border border-amber-900/40 bg-amber-950/15 px-3 py-2 text-[11px] text-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-900/30 pb-2 mb-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">Paid social drafts</div>
          <p className="text-[9px] text-slate-500 mt-0.5 max-w-xl leading-snug">
            Plan Meta (Facebook/Instagram) ads alongside organic posts.{" "}
            {items.some((i) => i.metaLaunchFeatureEnabled) ? (
              <span>
                <strong className="text-amber-200/80">Narrow launch enabled</strong> (traffic/engagement, single IMAGE
                URL, PAUSED objects) — requires Meta token, ad account, Page id, and valid placements.
              </span>
            ) : (
              <span>
                <strong className="text-amber-200/80">Launch disabled</strong> — set{" "}
                <code className="text-slate-600">PAID_SOCIAL_META_ADS_EXECUTION_ENABLED</code> on the server to enable.
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          data-testid="paid-social-new-draft"
          disabled={saving}
          className="rounded border border-amber-700/50 bg-amber-950/40 px-2 py-1 text-[10px] font-medium text-amber-100 disabled:opacity-40"
          onClick={() => void createDraft()}
        >
          New paid draft
        </button>
      </div>

      {error ? (
        <p data-testid="paid-social-error" className="text-red-300/90 mb-2">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-slate-500">Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <p data-testid="paid-social-empty" className="text-slate-500">
          No paid campaign drafts yet. Create one to capture objectives, budget, and creative links.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,160px)_1fr]">
          <ul className="space-y-1 border-r border-amber-900/20 pr-2">
            {items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  data-testid={`paid-social-list-${p.id}`}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left rounded px-2 py-1 text-[10px] ${
                    selectedId === p.id ? "bg-amber-900/35 text-amber-50" : "text-slate-400 hover:bg-slate-900/50"
                  }`}
                >
                  <span className="line-clamp-2">{p.internalName}</span>
                  <span className="block text-[9px] text-slate-600 capitalize">{p.draftStatus}</span>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <div data-testid="paid-social-editor" className="space-y-2 min-w-0">
              <div className="text-[9px] text-slate-500">{paidSocialProviderDisplayLabel(selected.provider)}</div>

              <ReadinessBlock readiness={selected.readiness} launchFlagOn={launchFlagOn} />

              {paidRollup &&
              paidRollup.paidDraftCount > 0 &&
              (paidRollup.impressions != null || paidRollup.clicks != null || paidRollup.spendMinor != null) ? (
                <div
                  data-testid="paid-social-paid-rollup"
                  className="rounded border border-violet-900/40 bg-violet-950/20 px-2 py-1.5 text-[9px] text-slate-400 space-y-0.5"
                >
                  <div className="text-violet-200/80 font-medium">Paid rollup (latest snapshot per draft)</div>
                  <div className="text-slate-500">
                    Separate from organic analytics — sums only paid draft snapshots with numeric fields (
                    {paidRollup.contributors.impressions}/{paidRollup.paidDraftCount} drafts with impressions, etc.).
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-300">
                    {paidRollup.impressions != null ? <span>Impressions: {paidRollup.impressions}</span> : null}
                    {paidRollup.clicks != null ? <span>Clicks: {paidRollup.clicks}</span> : null}
                    {paidRollup.spendMinor != null ? (
                      <span>
                        Spend: {(paidRollup.spendMinor / 100).toFixed(2)} {paidRollup.currency}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {paidListSignalsSummary &&
              paidListSignalsSummary.draftCountWithSignals > 0 &&
              paidListSignalsSummary.topPrioritySignalLabel ? (
                <div
                  data-testid="paid-social-list-signals-summary"
                  className="rounded border border-cyan-900/35 bg-cyan-950/10 px-2 py-1 text-[9px] text-slate-400"
                >
                  <span className="text-cyan-200/80 font-medium">List signals: </span>
                  {paidListSignalsSummary.draftCountWithSignals} draft
                  {paidListSignalsSummary.draftCountWithSignals === 1 ? "" : "s"} — highest priority:{" "}
                  {paidListSignalsSummary.topPrioritySignalLabel}
                </div>
              ) : null}

              {organicPromotionOpportunitySummary &&
              organicPromotionOpportunitySummary.topOrganicCandidateCount > 0 ? (
                <div
                  data-testid="paid-social-organic-opportunities"
                  className="rounded border border-emerald-900/40 bg-emerald-950/15 px-2 py-1 text-[9px] text-slate-400"
                >
                  <span className="text-emerald-200/85 font-medium">Organic promotion hints: </span>
                  {organicPromotionOpportunitySummary.topOrganicCandidateCount} posted row
                  {organicPromotionOpportunitySummary.topOrganicCandidateCount === 1 ? "" : "s"} look strong
                  {organicPromotionOpportunitySummary.topSignalLabel
                    ? ` (e.g. ${organicPromotionOpportunitySummary.topSignalLabel})`
                    : ""}
                  . Use <strong className="text-emerald-100/90">Promote to ads</strong> on a post in the planner.
                </div>
              ) : null}

              {promotionDecisionSummary && promotionDecisionSummary.referencedOrganicCount > 0 ? (
                <div
                  data-testid="paid-social-promotion-decision-summary"
                  className="rounded border border-violet-900/40 bg-violet-950/15 px-2 py-1 text-[9px] text-slate-400 space-y-0.5"
                >
                  <div>
                    <span className="text-violet-200/85 font-medium">Organic-linked drafts: </span>
                    {promotionDecisionSummary.referencedOrganicCount} · Comparable: {promotionDecisionSummary.comparableCount}{" "}
                    · Effective: {promotionDecisionSummary.effectiveCount} · Inefficient:{" "}
                    {promotionDecisionSummary.inefficientCount} · Not ready: {promotionDecisionSummary.notReadyCount}
                  </div>
                  {promotionDecisionSummary.topStatusLabel ? (
                    <div className="text-slate-500">
                      {promotionDecisionSummary.topStatusLabelText ??
                        promotionDecisionTopStatusLabelText(promotionDecisionSummary.topStatusLabel)}
                    </div>
                  ) : null}
                  {(() => {
                    const explain = promotionDecisionExplainLine(promotionDecisionSummary);
                    return explain ? (
                      <div
                        data-testid="paid-social-promotion-decision-explain"
                        className="text-[8px] text-slate-500 leading-snug"
                      >
                        {explain}
                      </div>
                    ) : null;
                  })()}
                </div>
              ) : null}

              <fieldset className="border border-slate-800 rounded p-2 space-y-2">
                <legend className="text-slate-500 px-1">Meta launch linkage</legend>
                <label className="block">
                  <span className="text-slate-500">Ad account id (digits or act_…)</span>
                  <input
                    data-testid="paid-social-meta-ad-account"
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    defaultValue={selected.metaAdAccountId ?? ""}
                    key={`mact-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) => void savePatch({ metaAdAccountId: e.target.value.trim() || null })}
                  />
                </label>
                <label className="block">
                  <span className="text-slate-500">Facebook Page id (creative)</span>
                  <input
                    data-testid="paid-social-meta-page-id"
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    defaultValue={selected.metaPageId ?? ""}
                    key={`mpg-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) => void savePatch({ metaPageId: e.target.value.trim() || null })}
                  />
                </label>
                <label className="block">
                  <span className="text-slate-500">Facebook connection (Marketing API token)</span>
                  <select
                    data-testid="paid-social-meta-fb-account"
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    value={selected.metaFacebookSocialAccountId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      void savePatch({ metaFacebookSocialAccountId: v ? v : null });
                    }}
                  >
                    <option value="">Default (owner&apos;s first Facebook account)</option>
                    {fbAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.displayName || a.id}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[9px] text-slate-600">
                  Or set server env <code className="text-slate-500">META_MARKETING_ACCESS_TOKEN</code> to bypass social
                  account rows.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="paid-social-launch-meta"
                    disabled={launchBusy || saving || !selected.readiness.launchEligible}
                    title={
                      !launchFlagOn
                        ? "Launch flag off"
                        : !selected.readiness.launchEligible
                          ? "Complete readiness requirements"
                          : "Create PAUSED campaign/ad set/creative/ad in Meta"
                    }
                    className="rounded border border-emerald-700/50 bg-emerald-950/35 px-2 py-1 text-[10px] font-medium text-emerald-100 disabled:opacity-40"
                    onClick={() => void launchMeta()}
                  >
                    {launchBusy ? "Launching…" : "Launch to Meta (PAUSED)"}
                  </button>
                  <span className="text-[9px] text-slate-600 capitalize">status: {selected.metaLaunchStatus ?? "idle"}</span>
                </div>
                {selected.remoteMetaCampaignId ? (
                  <div data-testid="paid-social-remote-ids" className="text-[9px] text-slate-500 space-y-0.5 font-mono">
                    <div>campaign: {selected.remoteMetaCampaignId}</div>
                    {selected.remoteMetaAdsetId ? <div>ad set: {selected.remoteMetaAdsetId}</div> : null}
                    {selected.remoteMetaCreativeId ? <div>creative: {selected.remoteMetaCreativeId}</div> : null}
                    {selected.remoteMetaAdId ? <div>ad: {selected.remoteMetaAdId}</div> : null}
                  </div>
                ) : null}
                {selected.lastLaunchError && typeof selected.lastLaunchError === "object" && selected.lastLaunchError !== null ? (
                  <pre data-testid="paid-social-launch-error" className="text-[9px] text-red-300/90 whitespace-pre-wrap">
                    {JSON.stringify(selected.lastLaunchError)}
                  </pre>
                ) : null}
              </fieldset>

              <fieldset className="border border-slate-800 rounded p-2 space-y-2">
                <legend className="text-slate-500 px-1">Meta sync &amp; performance</legend>
                {selected.paidSyncHealth ? (
                  <div className="flex flex-wrap items-start gap-2">
                    <span
                      data-testid="paid-social-sync-health-badge"
                      className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-medium ${syncHealthBadgeClass(selected.paidSyncHealth.tone)}`}
                      title={selected.paidSyncHealth.hint}
                    >
                      Sync: {selected.paidSyncHealth.label}
                    </span>
                    <p data-testid="paid-social-sync-health-hint" className="text-[9px] text-slate-500 flex-1 min-w-[12rem]">
                      {selected.paidSyncHealth.hint}
                    </p>
                  </div>
                ) : null}
                {selected.paidStructuredSyncError ? (
                  <div
                    data-testid="paid-social-structured-sync-error"
                    className="rounded border border-slate-800/90 bg-slate-950/50 px-2 py-1.5 space-y-1"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        data-testid="paid-social-structured-sync-error-badge"
                        className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-medium ${structuredSyncErrorBadgeClass(selected.paidStructuredSyncError.tone)}`}
                        title={selected.paidStructuredSyncError.hint}
                      >
                        {selected.paidStructuredSyncError.label}
                      </span>
                      <span className="text-[8px] uppercase tracking-wide text-slate-600">
                        {retryWorthwhileLabel(selected.paidStructuredSyncError.retryWorthwhile)}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-snug">{selected.paidStructuredSyncError.hint}</p>
                  </div>
                ) : null}
                {selected.syncCooldownActive ? (
                  <div
                    data-testid="paid-social-sync-cooldown"
                    className="rounded border border-orange-900/45 bg-orange-950/20 px-2 py-1.5 space-y-1"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        data-testid="paid-social-sync-cooldown-badge"
                        className="inline-flex rounded border border-orange-800/60 bg-orange-950/40 px-1.5 py-0.5 text-[9px] font-medium text-orange-100"
                        title={selected.syncCooldownHint ?? ""}
                      >
                        {selected.syncCooldownLabel ?? "Meta sync paused (cooldown)"}
                      </span>
                      {selected.syncCooldownReason ? (
                        <span className="text-[8px] uppercase tracking-wide text-orange-200/70">
                          {selected.syncCooldownReason.replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </div>
                    {selected.syncCooldownHint ? (
                      <p data-testid="paid-social-sync-cooldown-hint" className="text-[9px] text-slate-400 leading-snug">
                        {selected.syncCooldownHint}
                      </p>
                    ) : null}
                    {selected.syncCooldownUntil ? (
                      <p className="text-[8px] text-slate-600">
                        Resumes after: {new Date(selected.syncCooldownUntil).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {selected.paidOptimizationSignals && selected.paidOptimizationSignals.length > 0 ? (
                  <div
                    data-testid="paid-social-signals"
                    className="rounded border border-cyan-900/35 bg-cyan-950/15 px-2 py-1.5 space-y-1"
                  >
                    <div className="text-[9px] font-medium text-cyan-200/85">Early signals</div>
                    <ul className="space-y-1 list-none">
                      {selected.paidOptimizationSignals.map((s) => (
                        <li key={s.code} className="text-[9px] text-slate-400 leading-snug">
                          <span className="text-cyan-100/90 font-medium">{s.label}: </span>
                          {s.hint}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {selected.paidCreativeSource === "organic_post" && selected.referenceCampaignPostId ? (
                  <div className="space-y-0.5">
                    <p data-testid="paid-social-creative-source" className="text-[9px] text-slate-500">
                      Creative source: <span className="text-emerald-200/80">organic post</span> (
                      <span className="font-mono text-[8px]">{selected.referenceCampaignPostId}</span>)
                    </p>
                    {selected.crossSurfacePromotionOutcomes?.promotionEffective ? (
                      <p data-testid="paid-social-promotion-effective" className="text-[9px] text-emerald-500/90">
                        Outperforming original organic post
                      </p>
                    ) : selected.crossSurfacePromotionOutcomes?.promotionInefficient ? (
                      <div className="space-y-0.5">
                        <p data-testid="paid-social-promotion-inefficient" className="text-[9px] text-amber-500/85">
                          Underperforming original organic post
                        </p>
                        <p data-testid="paid-social-promotion-inefficient-hint" className="text-[9px] text-slate-500">
                          Consider testing new creative or audience
                        </p>
                      </div>
                    ) : selected.crossSurfaceComparisonReadiness &&
                      !selected.crossSurfaceComparisonReadiness.comparable ? (
                      <p
                        data-testid={
                          selected.crossSurfaceComparisonReadiness.reason === "insufficient_sample"
                            ? "paid-social-insufficient-sample"
                            : "paid-social-comparison-readiness"
                        }
                        className="text-[9px] text-slate-500"
                      >
                        {selected.crossSurfaceComparisonReadiness.reason === "insufficient_sample"
                          ? "Not enough data yet to compare paid vs organic performance"
                          : selected.crossSurfaceComparisonReadiness.reason === "missing_timestamps"
                            ? "Comparison not ready yet"
                            : selected.crossSurfaceComparisonReadiness.reason === "window_too_early"
                              ? "Too early to compare paid vs organic performance"
                              : "Performance comparison window is not aligned"}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {selected.crossSurfaceSignals && selected.crossSurfaceSignals.length > 0 ? (
                  <div
                    data-testid="paid-social-cross-surface-signals"
                    className="rounded border border-emerald-900/35 bg-emerald-950/10 px-2 py-1.5 space-y-1"
                  >
                    <div className="text-[9px] font-medium text-emerald-200/85">Organic vs paid</div>
                    <ul className="space-y-1 list-none">
                      {selected.crossSurfaceSignals.map((s) => (
                        <li key={s.code} className="text-[9px] text-slate-400 leading-snug">
                          <span className="text-emerald-100/90 font-medium">{s.label}: </span>
                          {s.hint}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div data-testid="paid-social-lifecycle" className="text-[9px] text-slate-400 space-y-0.5">
                  <div>
                    Launch lifecycle:{" "}
                    <span className="text-slate-300">
                      {paidLaunchLifecycleLabel(selected.paidLaunchLifecycle ?? "draft")}
                    </span>
                    <span className="text-slate-600"> — draft / launch progress (not delivery health).</span>
                  </div>
                  <div data-testid="paid-social-runtime-status">
                    Meta delivery state (runtime):{" "}
                    <span className="text-slate-300 capitalize">
                      {selected.metaRuntimeStatus
                        ? paidMetaRuntimeStatusLabel(selected.metaRuntimeStatus)
                        : canSyncMeta
                          ? "Not read yet"
                          : "—"}
                    </span>
                  </div>
                  <div className="text-slate-600">
                    Last sync:{" "}
                    {selected.lastMetaSyncAt
                      ? new Date(selected.lastMetaSyncAt).toLocaleString()
                      : canSyncMeta
                        ? "Never"
                        : "Launch first to enable sync"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="paid-social-sync-meta"
                    disabled={syncBusy || saving || !canSyncMeta}
                    title={
                      !launchFlagOn
                        ? "Sync requires launch flag"
                        : !canSyncMeta
                          ? "No remote Meta objects yet"
                          : "Refresh status and lifetime ad metrics from Meta"
                    }
                    className="rounded border border-sky-700/50 bg-sky-950/35 px-2 py-1 text-[10px] font-medium text-sky-100 disabled:opacity-40"
                    onClick={() => void syncMeta()}
                  >
                    {syncBusy ? "Syncing…" : "Sync from Meta"}
                  </button>
                </div>
                {!launchFlagOn ? (
                  <p data-testid="paid-social-sync-flag-off" className="text-[9px] text-slate-600">
                    Sync uses the same feature flag as launch.
                  </p>
                ) : null}
                {selected.latestSnapshotMeta?.sourceNotes && selected.latestSnapshotMeta.sourceNotes.length > 0 ? (
                  <ul data-testid="paid-social-metrics-provenance" className="text-[9px] text-amber-100/80 list-disc pl-4 space-y-0.5">
                    {selected.latestSnapshotMeta.sourceNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                ) : null}
                {selected.latestPaidMetrics &&
                (selected.latestPaidMetrics.impressions != null ||
                  selected.latestPaidMetrics.clicks != null ||
                  selected.latestPaidMetrics.spendMinor != null) ? (
                  <div data-testid="paid-social-metrics-summary" className="text-[9px] text-slate-400 space-y-0.5">
                    <div className="text-slate-500">
                      Latest paid snapshot (lifetime)
                      {selected.latestSnapshotMeta?.insightsSource === "ad"
                        ? ", ad-level"
                        : selected.latestSnapshotMeta?.insightsSource === "adset"
                          ? ", ad set–level (fallback)"
                          : selected.latestSnapshotMeta?.insightsSource === "campaign"
                            ? ", campaign-level (fallback)"
                            : ""}
                      {selected.latestSnapshotMeta?.metricsCompleteness === "partial_early_delivery" ? (
                        <span className="text-amber-200/80"> — limited / early-delivery data</span>
                      ) : null}
                    </div>
                    <div>Impressions: {selected.latestPaidMetrics.impressions ?? "—"}</div>
                    <div>Clicks: {selected.latestPaidMetrics.clicks ?? "—"}</div>
                    <div>
                      Spend:{" "}
                      {selected.latestPaidMetrics.spendMinor != null
                        ? `${(selected.latestPaidMetrics.spendMinor / 100).toFixed(2)} ${selected.currency}`
                        : "—"}
                    </div>
                    <div>Reach: {selected.latestPaidMetrics.reach ?? "—"}</div>
                    {selected.latestPaidMetricsFetchedAt ? (
                      <div className="text-slate-600">
                        Fetched: {new Date(selected.latestPaidMetricsFetchedAt).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                ) : canSyncMeta ? (
                  <p data-testid="paid-social-metrics-empty" className="text-[9px] text-slate-600">
                    {selected.lastMetaSyncAt
                      ? "Last sync succeeded but Meta has not reported lifetime metrics yet (common right after launch)."
                      : "No metrics in DB yet — run sync (Meta may return empty insights until delivery starts)."}
                  </p>
                ) : (
                  <p className="text-[9px] text-slate-600">Metrics appear after launch and sync.</p>
                )}
                {selectedPaidSyncErrorSummary && !selected.paidStructuredSyncError ? (
                  <p data-testid="paid-social-sync-error-summary" className="text-[9px] text-amber-200/90">
                    {selectedPaidSyncErrorSummary}
                  </p>
                ) : null}
                {selected.lastMetaSyncError && typeof selected.lastMetaSyncError === "object" && selected.lastMetaSyncError !== null ? (
                  <details className="text-[9px] text-slate-500">
                    <summary className="cursor-pointer text-slate-400 hover:text-slate-300">Raw sync error</summary>
                    <pre data-testid="paid-social-sync-error" className="mt-1 text-amber-200/70 whitespace-pre-wrap">
                      {JSON.stringify(selected.lastMetaSyncError)}
                    </pre>
                  </details>
                ) : null}
              </fieldset>

              <label className="block">
                <span className="text-slate-500">Internal name</span>
                <input
                  className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                  defaultValue={selected.internalName}
                  key={`name-${selected.id}-${selected.updatedAt}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== selected.internalName) void savePatch({ internalName: v });
                  }}
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-slate-500">Ad set name</span>
                  <input
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    defaultValue={selected.adSetName ?? ""}
                    key={`adset-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) => void savePatch({ adSetName: e.target.value.trim() || null })}
                  />
                </label>
                <label className="block">
                  <span className="text-slate-500">Ad name</span>
                  <input
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    defaultValue={selected.adName ?? ""}
                    key={`adn-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) => void savePatch({ adName: e.target.value.trim() || null })}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-slate-500">Objective</span>
                <select
                  data-testid="paid-social-objective"
                  className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                  value={selected.objective || ""}
                  onChange={(e) => void savePatch({ objective: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="awareness">Awareness</option>
                  <option value="traffic">Traffic</option>
                  <option value="engagement">Engagement</option>
                  <option value="leads">Leads</option>
                  <option value="conversions">Conversions</option>
                </select>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="block col-span-1">
                  <span className="text-slate-500">Budget type</span>
                  <select
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    value={selected.budgetType}
                    onChange={(e) => void savePatch({ budgetType: e.target.value })}
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </label>
                <label className="block col-span-1">
                  <span className="text-slate-500">Amount (minor units)</span>
                  <input
                    type="number"
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    defaultValue={selected.budgetAmountMinor ?? ""}
                    key={`bud-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) => {
                      const n = e.target.value === "" ? null : Number.parseInt(e.target.value, 10);
                      if (n === null || Number.isFinite(n)) void savePatch({ budgetAmountMinor: n });
                    }}
                  />
                </label>
                <label className="block col-span-1">
                  <span className="text-slate-500">Currency</span>
                  <input
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    defaultValue={selected.currency}
                    key={`cur-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) => void savePatch({ currency: e.target.value.trim().toUpperCase() || "USD" })}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-slate-500">Destination URL</span>
                <input
                  data-testid="paid-social-destination"
                  className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                  defaultValue={selected.destinationUrl ?? ""}
                  key={`dest-${selected.id}-${selected.updatedAt}`}
                  onBlur={(e) => void savePatch({ destinationUrl: e.target.value.trim() || null })}
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-slate-500">CTA label</span>
                  <input
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    defaultValue={selected.ctaLabel ?? ""}
                    key={`cta-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) => void savePatch({ ctaLabel: e.target.value.trim() || null })}
                  />
                </label>
                <label className="block">
                  <span className="text-slate-500">Lead form (placeholder)</span>
                  <input
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    defaultValue={selected.leadFormPlaceholder ?? ""}
                    key={`lead-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) => void savePatch({ leadFormPlaceholder: e.target.value.trim() || null })}
                  />
                </label>
              </div>

              <fieldset className="border border-slate-800 rounded p-2">
                <legend className="text-slate-500 px-1">Placements</legend>
                <div className="flex flex-wrap gap-2">
                  {PAID_SOCIAL_PLACEMENT_IDS.map((pid) => (
                    <label key={pid} className="flex items-center gap-1 text-[10px] text-slate-400">
                      <input
                        type="checkbox"
                        data-testid={`paid-social-placement-${pid}`}
                        checked={selected.placements.includes(pid)}
                        onChange={(e) => togglePlacement(pid, e.target.checked)}
                      />
                      {placementLabel(pid)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="border border-slate-800 rounded p-2">
                <legend className="text-slate-500 px-1">Audience summary</legend>
                <div className="grid gap-2">
                  <input
                    placeholder="Geography"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    defaultValue={selected.audience.geography ?? ""}
                    key={`geo-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) =>
                      void savePatch({
                        audience: { ...selected.audience, geography: e.target.value.trim() || undefined },
                      })
                    }
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Age min"
                      className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                      defaultValue={selected.audience.ageMin ?? ""}
                      key={`amin-${selected.id}-${selected.updatedAt}`}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? undefined : Number.parseInt(e.target.value, 10);
                        void savePatch({
                          audience: { ...selected.audience, ageMin: Number.isFinite(n) ? n : undefined },
                        });
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Age max"
                      className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                      defaultValue={selected.audience.ageMax ?? ""}
                      key={`amax-${selected.id}-${selected.updatedAt}`}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? undefined : Number.parseInt(e.target.value, 10);
                        void savePatch({
                          audience: { ...selected.audience, ageMax: Number.isFinite(n) ? n : undefined },
                        });
                      }}
                    />
                  </div>
                  <textarea
                    placeholder="Interests / notes"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] min-h-[48px]"
                    defaultValue={selected.audience.interestsNotes ?? ""}
                    key={`int-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) =>
                      void savePatch({
                        audience: { ...selected.audience, interestsNotes: e.target.value.trim() || undefined },
                      })
                    }
                  />
                </div>
              </fieldset>

              <fieldset className="border border-slate-800 rounded p-2">
                <legend className="text-slate-500 px-1">Creative linkage</legend>
                <label className="block mb-2">
                  <span className="text-slate-500">Campaign assets (multi-select)</span>
                  <select
                    data-testid="paid-social-assets"
                    multiple
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] min-h-[72px]"
                    value={selected.creative.primaryAssetIds ?? []}
                    onChange={(e) => {
                      const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                      void savePatch({ creative: { ...selected.creative, primaryAssetIds: opts } });
                    }}
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} ({a.creativeType})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block mb-2">
                  <span className="text-slate-500">Reference governed post (optional)</span>
                  <select
                    data-testid="paid-social-ref-post"
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                    value={selected.creative.referenceOrganicPostId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      void savePatch({
                        creative: {
                          ...selected.creative,
                          referenceOrganicPostId: v ? v : null,
                        },
                      });
                    }}
                  >
                    <option value="">—</option>
                    {posts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id.slice(0, 8)}… {p.provider ? `(${p.provider})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <textarea
                  placeholder="Creative notes"
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                  defaultValue={selected.creative.notes ?? ""}
                  key={`cn-${selected.id}-${selected.updatedAt}`}
                  onBlur={(e) =>
                    void savePatch({
                      creative: { ...selected.creative, notes: e.target.value.trim() || undefined },
                    })
                  }
                />
              </fieldset>

              <label className="block">
                <span className="text-slate-500">Draft status</span>
                <select
                  className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                  value={selected.draftStatus}
                  onChange={(e) => void savePatch({ draftStatus: e.target.value })}
                >
                  <option value="draft">draft</option>
                  <option value="archived">archived</option>
                </select>
              </label>

              {saving ? <p className="text-[9px] text-slate-500">Saving…</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReadinessBlock(props: { readiness: PaidSocialCampaignReadiness; launchFlagOn?: boolean }) {
  const { readiness, launchFlagOn } = props;
  const flagOff = readiness.launchBlockedReasons.includes("meta_ads_launch_feature_disabled");
  return (
    <div
      data-testid="paid-social-readiness"
      className="rounded border border-slate-700/80 bg-slate-950/60 px-2 py-1.5 space-y-1"
    >
      {launchFlagOn === false && readiness.structurallyComplete ? (
        <p data-testid="paid-social-launch-flag-off" className="text-[9px] text-amber-200/85">
          Meta launch is off server-side (<code className="text-slate-500">PAID_SOCIAL_META_ADS_EXECUTION_ENABLED</code>
          ).
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className={readiness.structurallyComplete ? "text-emerald-400/90" : "text-amber-200/90"}>
          Draft structure: {readiness.structurallyComplete ? "complete" : "incomplete"}
        </span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-400">
          Launch eligible: {readiness.launchEligible ? "yes" : "no"}
          {flagOff ? <span className="text-amber-200/80"> (flag disabled)</span> : null}
          {!readiness.launchEligible && readiness.launchBlockedReasons.includes("provider_not_launchable_yet") ? (
            <span className="text-amber-200/80"> (execution not built)</span>
          ) : null}
        </span>
      </div>
      {readiness.structurallyBlockedReasons.length > 0 ? (
        <ul data-testid="paid-social-blocked-reasons" className="text-[9px] text-amber-100/80 list-disc pl-4 space-y-0.5">
          {readiness.structurallyBlockedReasons.map((c) => (
            <li key={c}>{c.replace(/_/g, " ")}</li>
          ))}
        </ul>
      ) : null}
      {readiness.structurallyComplete && !readiness.launchEligible && readiness.launchBlockedReasons.length > 0 ? (
        <ul data-testid="paid-social-launch-blocked" className="text-[9px] text-slate-400 list-disc pl-4 space-y-0.5">
          {readiness.launchBlockedReasons.map((c) => (
            <li key={c}>{c.replace(/_/g, " ")}</li>
          ))}
        </ul>
      ) : null}
      {readiness.nextActionHints.length > 0 ? (
        <ul data-testid="paid-social-hints" className="text-[9px] text-slate-400 list-disc pl-4 space-y-0.5">
          {readiness.nextActionHints.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
