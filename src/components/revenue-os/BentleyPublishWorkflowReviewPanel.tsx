"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  useAiRevenueOsPostingPlatforms,
  useAiRevenueOsProfile,
  useAiRevenueOsSnapshotSignature,
  useAiRevenueOsSystemSignals,
} from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import {
  BENTLEY_STORAGE_SCOPE_CHANGED_EVENT,
  getBentleyStorageScope,
} from "@/lib/revenue-os/bentley-storage-scope";
import { buildSevenDayLaunchPlan } from "@/lib/revenue-os/build-seven-day-launch-plan";
import { buildSequenceSchedulePlan } from "@/lib/revenue-os/build-sequence-schedule-plan";
import {
  buildPublishWorkflowReview,
  type CampaignPostForPublishReview,
} from "@/lib/revenue-os/build-publish-workflow-review";
import {
  confirmPublishWorkflowSchedule,
  confirmPublishWorkflowScheduleNonConflicting,
} from "@/lib/revenue-os/confirm-publish-workflow-schedule";
import { loadWorkflowState, subscribeBentleyWorkflowCrossTab } from "@/lib/revenue-os/bentley-workflow";
import { fetchRevenueOsDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-client-fetch";
import { fetchRevenueOsOptimizationMemory } from "@/lib/revenue-os/optimization-memory-client-fetch";
import { derivePlatformRoleRouting } from "@/lib/revenue-os/platform-role-routing";
import { buildBatchCalendarSequencingForWorkflow } from "@/lib/revenue-os/bentley-batch-calendar-sequencing-chat";
import { buildPublishApprovalGovernanceSummary } from "@/lib/revenue-os/build-publish-approval-governance-summary";
import {
  buildPublishApprovalSummary,
  isPublishWorkflowBulkApproveSafeRow,
  rowViewerEligibleForCurrentApprovalChain,
  selectApproveAllTargetsForViewer,
  selectRowsForApproveAllPending,
} from "@/lib/revenue-os/build-publish-approval-summary";
import type { CampaignReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";
import {
  executeApproveAllBatch,
  formatApproveAllBatchUserMessage,
  rowBulkApproveHighlightKind,
  type ApproveAllBatchResult,
  type ApproveAllPatchWriteOutcome,
  type BulkApproveRowHighlight,
} from "@/lib/revenue-os/publish-workflow-approve-all-batch";
import { BulkApproveLastSummaryLine } from "@/components/revenue-os/BulkApproveLastSummaryLine";
import { PublishWorkflowApproveAllBatchDebug } from "@/components/revenue-os/PublishWorkflowApproveAllBatchDebug";
import { BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY } from "@/lib/revenue-os/bentley-publish-approval-chat";
import {
  buildPublishWorkflowDebugApprovalAuditUrl,
  narrowPublishWorkflowDebugAuditFilters,
} from "@/lib/revenue-os/publish-workflow-debug-approval-audit";
import { approvalAuditEventsAfterRefresh } from "@/lib/revenue-os/debug-approval-audit-state";
import type { PublishApprovalAuditRecentApiEvent } from "@/lib/revenue-os/publish-approval-audit";
import { PublishApprovalAnalyticsBlock } from "@/components/revenue-os/PublishApprovalAnalyticsBlock";
import { CampaignGovernanceSettingsSection } from "@/components/revenue-os/CampaignGovernanceSettingsSection";
import { AirosDebugSupportSummary } from "@/components/revenue-os/AirosDebugSupportSummary";
import { PublishApprovalReviewerAnalyticsBlock } from "@/components/revenue-os/PublishApprovalReviewerAnalyticsBlock";
import { PublishApprovalReportScheduleControls } from "@/components/revenue-os/PublishApprovalReportScheduleControls";
import { PublishWorkflowDebugApprovalAuditList } from "@/components/revenue-os/PublishWorkflowDebugApprovalAuditList";
import { PublishWorkflowStaleRecoveryDebug } from "@/components/revenue-os/PublishWorkflowStaleRecoveryDebug";
import type { PublishApprovalAnalyticsResult } from "@/lib/revenue-os/publish-approval-analytics";
import type { PublishApprovalReviewerAnalyticsResult } from "@/lib/revenue-os/publish-approval-reviewer-analytics";
import type { PublishApprovalReportSchedulePublic } from "@/lib/revenue-os/publish-approval-report-schedule";
import { type CampaignGovernanceReviewerRoleCounts } from "@/lib/revenue-os/campaign-governance-health";
import type { CampaignGovernanceEntitlements } from "@/lib/revenue-os/campaign-governance-entitlements";
import { buildCampaignGovernanceSettingsViewModel } from "@/lib/revenue-os/campaign-governance-settings-view-model";
import { parseCampaignPublishApprovalChainJson } from "@/lib/revenue-os/publish-approval-chain";
import { buildPublishWorkflowOverdueChip } from "@/lib/revenue-os/publish-workflow-sla-ui";
import {
  buildApprovalReviewSnapshotFromWorkflowRow,
  finalizeStaleReviewWorkflowRefresh,
  isStaleReviewConflictResponse,
  staleReviewRecoveryToastMessage,
  type StaleRecoveryDebugSummary,
} from "@/lib/revenue-os/stale-review-recovery";
import type {
  RevenueOsPublishApprovalStatus,
  RevenueOsPublishApprovalSummary,
} from "@/lib/revenue-os/publish-approval-types";
import type { RevenueOsPublishWorkflowRow } from "@/lib/revenue-os/publish-workflow-review-types";
import { useSocialAccounts } from "@/hooks/useSocialAccounts";
import type { SocialPlatform } from "@/lib/social/config";
import { cn } from "@/lib/utils";

async function exportPublishApprovalReport(
  campaignId: string,
  workerRequiresApproval: boolean,
  format: "json" | "csv"
) {
  const params = new URLSearchParams({
    format,
    workerRequiresApproval: workerRequiresApproval ? "true" : "false",
  });
  const res = await fetch(
    `/api/campaigns/${encodeURIComponent(campaignId)}/publish-approval-report?${params}`,
    { credentials: "include" }
  );
  if (!res.ok) {
    toast.error(format === "json" ? "Could not export JSON report." : "Could not export CSV report.");
    return;
  }
  const cd = res.headers.get("Content-Disposition");
  let filename = `publish-approval-report.${format === "csv" ? "csv" : "json"}`;
  const m = cd?.match(/filename="?([^";]+)"?/);
  if (m?.[1]) filename = m[1];
  const blob =
    format === "csv"
      ? await res.blob()
      : new Blob([JSON.stringify(await res.json(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success("Report downloaded.");
}

const DEFAULT_GOVERNANCE_ENTITLEMENTS: CampaignGovernanceEntitlements = {
  reviewerAssignmentsEnabled: true,
  multiStepApprovalChainsEnabled: true,
  approvalAnalyticsEnabled: true,
  scheduledReportDeliveryEnabled: true,
  complianceReportExportEnabled: true,
};

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  x: "X",
};

function statusBadgeClass(s: string): string {
  if (s === "published") return "border-emerald-900/50 text-emerald-200/90";
  if (s === "failed") return "border-red-900/50 text-red-200/90";
  if (s === "scheduled" || s === "retry_scheduled") return "border-violet-900/50 text-violet-200/85";
  if (s === "publishing") return "border-amber-900/50 text-amber-200/85";
  return "border-slate-700 text-slate-400";
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return String(iso).slice(0, 19);
  return new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function approvalStatusLabel(a?: RevenueOsPublishApprovalStatus): string {
  if (a === "approved") return "Approved";
  if (a === "rejected") return "Rejected";
  if (a === "pending_approval") return "Pending approval";
  if (a === "not_required") return "Approval N/A";
  return "—";
}

const NO_APPROVAL_PERM = "You don't have permission to approve this post.";

function dayBucketKey(row: RevenueOsPublishWorkflowRow): string {
  const iso = row.actualScheduledAt ?? row.suggestedScheduledAt;
  if (!iso) return "Unscheduled";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "Unscheduled";
  return new Date(t).toISOString().slice(0, 10);
}

export function BentleyPublishWorkflowReviewPanel() {
  useAiRevenueOsSnapshotSignature();
  const profile = useAiRevenueOsProfile();
  const { postingPlatforms } = useAiRevenueOsPostingPlatforms();
  const { systemSignals } = useAiRevenueOsSystemSignals();
  const [scopeTick, setScopeTick] = useState(0);
  const [wf, setWf] = useState(loadWorkflowState);
  const [debug, setDebug] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [view, setView] = useState<"list" | "byDay">("list");
  const conflictsRef = useRef<HTMLDivElement>(null);
  const [lastBulk, setLastBulk] = useState<{
    label: string;
    applied: number;
    skipped: number;
    conflicts: number;
    skippedReasons: { postId: string; reason: string }[];
  } | null>(null);
  const [workerEnvApproval, setWorkerEnvApproval] = useState(false);
  const [uiApprovalMode, setUiApprovalMode] = useState(false);
  const [lastApprovalBulk, setLastApprovalBulk] = useState<{ label: string; n: number } | null>(null);
  const [approvalActor, setApprovalActor] = useState<{
    userId: number | null;
    label: string;
    role: string;
    identityBacked: boolean;
  } | null>(null);
  /** Recent campaign_audit_events rows for publish approval (debug only). */
  const [recentApprovalAuditEvents, setRecentApprovalAuditEvents] = useState<PublishApprovalAuditRecentApiEvent[]>([]);
  /** Debug: last PATCH /api/campaigns/posts approval decision outcome (fresh / idempotent / stale). */
  const [lastApprovalPatchDebug, setLastApprovalPatchDebug] = useState<string | null>(null);
  /** Debug: previous vs refreshed snapshot after 409 STALE_REVIEW recovery. */
  const [staleRecoveryDebug, setStaleRecoveryDebug] = useState<StaleRecoveryDebugSummary | null>(null);
  /** Debug: structured result of the last Approve all run. */
  const [lastApproveAllBatchDebug, setLastApproveAllBatchDebug] = useState<ApproveAllBatchResult | null>(null);
  /** Production: last Approve all batch outcome (compact summary line). */
  const [lastApproveAllVisible, setLastApproveAllVisible] = useState<ApproveAllBatchResult | null>(null);
  /** Subtle row highlights for posts touched in the last bulk approve. */
  const [bulkRowHighlight, setBulkRowHighlight] = useState<BulkApproveRowHighlight | null>(null);
  const [viewerMayFinalizePublishApproval, setViewerMayFinalizePublishApproval] = useState(true);
  const [viewerCampaignReviewerRole, setViewerCampaignReviewerRole] = useState<CampaignReviewerRole | null>(null);
  /** Debug: last FORBIDDEN_APPROVAL from PATCH. */
  const [lastForbiddenApprovalDebug, setLastForbiddenApprovalDebug] = useState<string | null>(null);
  /** Owner/admin: GET publish-approval-analytics for this campaign. */
  const [approvalAnalytics, setApprovalAnalytics] = useState<PublishApprovalAnalyticsResult | null>(null);
  const [reviewerAnalytics, setReviewerAnalytics] = useState<PublishApprovalReviewerAnalyticsResult | null>(null);
  const [viewerCanViewApprovalAnalytics, setViewerCanViewApprovalAnalytics] = useState(false);
  const [viewerCanManageReviewerAssignments, setViewerCanManageReviewerAssignments] = useState(false);
  const [analyticsRefreshing, setAnalyticsRefreshing] = useState(false);
  const [governanceEntitlements, setGovernanceEntitlements] = useState<CampaignGovernanceEntitlements | null>(null);
  const [governancePlanTierLabel, setGovernancePlanTierLabel] = useState<string>("enterprise");
  const [publishApprovalReportSchedule, setPublishApprovalReportSchedule] =
    useState<PublishApprovalReportSchedulePublic | null>(null);
  const [campaignGovernanceMeta, setCampaignGovernanceMeta] = useState<{
    reviewerRoleCounts: CampaignGovernanceReviewerRoleCounts;
    publishApprovalChain: ReturnType<typeof parseCampaignPublishApprovalChainJson>;
  } | null>(null);

  const effectiveGovernanceEntitlements = governanceEntitlements ?? DEFAULT_GOVERNANCE_ENTITLEMENTS;

  const clearBulkApproveAllUi = useCallback(() => {
    setLastApproveAllVisible(null);
    setBulkRowHighlight(null);
  }, []);

  useEffect(() => {
    return () => {
      setLastApproveAllVisible(null);
      setBulkRowHighlight(null);
    };
  }, []);

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get("airos_debug") === "1");
  }, []);

  useEffect(() => {
    if (!debug) {
      setRecentApprovalAuditEvents([]);
      setLastApprovalPatchDebug(null);
      setStaleRecoveryDebug(null);
      setLastApproveAllBatchDebug(null);
    }
  }, [debug]);

  useEffect(() => {
    try {
      setUiApprovalMode(sessionStorage.getItem(BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY) === "1");
    } catch {
      setUiApprovalMode(false);
    }
  }, []);

  const clientId = useMemo(() => {
    void scopeTick;
    return getBentleyStorageScope()?.clientId ?? "_";
  }, [scopeTick]);

  useEffect(() => {
    clearBulkApproveAllUi();
    setViewerMayFinalizePublishApproval(true);
    setViewerCampaignReviewerRole(null);
    setLastForbiddenApprovalDebug(null);
  }, [clientId, clearBulkApproveAllUi]);

  const { data: socialAccounts = [] } = useSocialAccounts(clientId === "_" ? "" : clientId);

  useEffect(() => {
    const onScope = () => setScopeTick((t) => t + 1);
    window.addEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onScope);
    return () => window.removeEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onScope);
  }, []);

  useEffect(() => {
    const unsub = subscribeBentleyWorkflowCrossTab(() => setWf(loadWorkflowState()));
    return unsub;
  }, []);

  const shared = useMemo(
    () => ({
      businessName: profile.businessName,
      coreOffer: profile.coreOffer,
      transformation: profile.transformation,
      targetAudience: profile.targetAudience,
      industry: profile.effectiveIndustryLabel,
      postingPlatforms: postingPlatforms.map((x) => PLATFORM_LABELS[x] ?? x),
    }),
    [profile, postingPlatforms]
  );

  const launchPlan = useMemo(
    () =>
      buildSevenDayLaunchPlan({
        systemSignals,
        sharedProfile: shared,
        trendsResult: wf.artifacts.trends ?? undefined,
        researchResult: wf.artifacts.research ?? undefined,
        workflowState: wf,
      }),
    [systemSignals, shared, wf]
  );

  const [summary, setSummary] = useState<ReturnType<typeof buildPublishWorkflowReview> | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<ReturnType<typeof buildPublishWorkflowReview> | null> => {
    void refreshNonce;
    setLoading(true);
    setViewerMayFinalizePublishApproval(true);
    setViewerCampaignReviewerRole(null);
    try {
      const cid = clientId === "_" ? "" : clientId;
      const [pack, mem] = await Promise.all([
        fetchRevenueOsDeploymentFeedback(cid),
        fetchRevenueOsOptimizationMemory(cid),
      ]);
      const routing = derivePlatformRoleRouting({
        deploymentRollup: pack?.rollup ?? null,
        memorySummary: mem?.summary ?? null,
        metricSyncContext: pack?.metricSyncContext
          ? {
              liveMetricPlatforms: pack.metricSyncContext.liveMetricPlatforms,
              stubPublishPlatforms: pack.metricSyncContext.stubPublishPlatforms,
            }
          : null,
        signalsInput: pack?.signalsInput ?? null,
        systemSignals,
      });
      const sequence = buildBatchCalendarSequencingForWorkflow({
        campaignResult: wf.artifacts.campaign ?? undefined,
        contentEngineResult: wf.artifacts.contentEngine ?? undefined,
        mediaBrief: wf.artifacts.mediaBriefText ?? undefined,
        launchPlan,
        platformRoleRouting: routing,
        optimizationMemoryGeneration: mem?.generation ?? null,
        systemSignals,
      });
      const schedulePlan = buildSequenceSchedulePlan({
        batchCalendarSequence: sequence,
        launchPlan,
        now: new Date(),
        userTimezoneHint: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      });

      let wrEnv = false;
      try {
        const ar = await fetch("/api/revenue-os/publish-approval-settings");
        if (ar.ok) {
          const aj = (await ar.json()) as {
            workerRequiresApproval?: boolean;
            approvalActor?: {
              userId: number | null;
              label: string;
              role: string;
              identityBacked: boolean;
            };
          };
          wrEnv = Boolean(aj.workerRequiresApproval);
          setWorkerEnvApproval(wrEnv);
          setApprovalActor(aj.approvalActor ?? null);
        }
      } catch {
        setWorkerEnvApproval(false);
        setApprovalActor(null);
      }
      const effectiveApproval = wrEnv || uiApprovalMode;

      setApprovalAnalytics(null);
      setReviewerAnalytics(null);
      setViewerCanViewApprovalAnalytics(false);
      setViewerCanManageReviewerAssignments(false);
      setPublishApprovalReportSchedule(null);
      setCampaignGovernanceMeta(null);
      setGovernanceEntitlements(null);
      setGovernancePlanTierLabel("enterprise");

      let camp: string | null = null;
      let publishApprovalChain = null as ReturnType<typeof parseCampaignPublishApprovalChainJson>;
      let canViewApprovalAnalytics = false;
      let mergedGovernanceEntitlements: CampaignGovernanceEntitlements = { ...DEFAULT_GOVERNANCE_ENTITLEMENTS };
      const posts: CampaignPostForPublishReview[] = [];
      try {
        const r = await fetch(`/api/campaigns?clientId=${encodeURIComponent(cid)}`);
        if (r.ok) {
          const j = (await r.json()) as { campaigns?: { id: string }[] };
          camp = j.campaigns?.[0]?.id ?? null;
          if (camp) {
            const pr = await fetch(`/api/campaigns/${camp}`);
            if (pr.ok) {
              const pj = (await pr.json()) as {
                viewerCampaignReviewerRole?: CampaignReviewerRole;
                viewerMayFinalizePublishApproval?: boolean;
                viewerCanManageReviewerAssignments?: boolean;
                publishApprovalChain?: unknown;
                publishApprovalReportSchedule?: PublishApprovalReportSchedulePublic | null;
                reviewerRoleCounts?: CampaignGovernanceReviewerRoleCounts;
                governanceEntitlements?: Partial<CampaignGovernanceEntitlements>;
                governancePlanTierLabel?: string;
                posts?: {
                  id: string;
                  platform: string;
                  status: string;
                  scheduledAt?: string | Date | null;
                  caption?: string | null;
                  utmParams?: Record<string, string> | null;
                  postedAt?: string | Date | null;
                  errorMessage?: string | null;
                  updatedAt?: string | Date | null;
                }[];
              };
              setViewerMayFinalizePublishApproval(pj.viewerMayFinalizePublishApproval !== false);
              setViewerCampaignReviewerRole(pj.viewerCampaignReviewerRole ?? "owner");
              canViewApprovalAnalytics = pj.viewerCanManageReviewerAssignments === true;
              setViewerCanViewApprovalAnalytics(canViewApprovalAnalytics);
              setViewerCanManageReviewerAssignments(canViewApprovalAnalytics);
              setPublishApprovalReportSchedule(pj.publishApprovalReportSchedule ?? null);
              publishApprovalChain = parseCampaignPublishApprovalChainJson(pj.publishApprovalChain ?? null);
              const counts: CampaignGovernanceReviewerRoleCounts =
                pj.reviewerRoleCounts &&
                typeof pj.reviewerRoleCounts.approver === "number" &&
                typeof pj.reviewerRoleCounts.editor === "number" &&
                typeof pj.reviewerRoleCounts.reviewer === "number"
                  ? pj.reviewerRoleCounts
                  : { approver: 0, editor: 0, reviewer: 0 };
              setCampaignGovernanceMeta({
                reviewerRoleCounts: counts,
                publishApprovalChain,
              });
              mergedGovernanceEntitlements = {
                ...DEFAULT_GOVERNANCE_ENTITLEMENTS,
                ...(pj.governanceEntitlements ?? {}),
              };
              setGovernanceEntitlements(mergedGovernanceEntitlements);
              setGovernancePlanTierLabel(
                typeof pj.governancePlanTierLabel === "string" && pj.governancePlanTierLabel.trim()
                  ? pj.governancePlanTierLabel.trim()
                  : "enterprise"
              );
              for (const p of pj.posts ?? []) {
                posts.push({
                  id: p.id,
                  platform: p.platform,
                  status: p.status,
                  scheduledAt: p.scheduledAt,
                  caption: p.caption,
                  utmParams: p.utmParams ?? null,
                  postedAt: p.postedAt,
                  errorMessage: p.errorMessage,
                  updatedAt: p.updatedAt,
                });
              }
            }
          }
        }
      } catch {
        /* ignore */
      }

      const rev = buildPublishWorkflowReview({
        posts,
        schedulePlan: schedulePlan.slots.length ? schedulePlan : null,
        batchCalendarSequence: sequence.slots.length ? sequence : null,
        socialAccounts,
        workerRequiresApproval: effectiveApproval,
        publishApprovalChain,
        publishApprovalSlaDebug: debug,
      });
      setSummary(rev);
      setCampaignId(camp);

      if (camp && canViewApprovalAnalytics && mergedGovernanceEntitlements.approvalAnalyticsEnabled) {
        try {
          const ar = await fetch(
            `/api/campaigns/${camp}/publish-approval-analytics?workerRequiresApproval=${effectiveApproval ? "true" : "false"}`
          );
          if (ar.ok) {
            setApprovalAnalytics((await ar.json()) as PublishApprovalAnalyticsResult);
          }
        } catch {
          setApprovalAnalytics(null);
        }
        try {
          const rr = await fetch(
            `/api/campaigns/${camp}/publish-approval-reviewer-analytics?workerRequiresApproval=${effectiveApproval ? "true" : "false"}`
          );
          if (rr.ok) {
            setReviewerAnalytics((await rr.json()) as PublishApprovalReviewerAnalyticsResult);
          }
        } catch {
          setReviewerAnalytics(null);
        }
      }
      if (camp && effectiveApproval) {
        void fetch(`/api/campaigns/${camp}/publish-approval-sla-scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerRequiresApproval: effectiveApproval }),
        }).catch(() => {});
      }
      setLastBulk(null);

      if (debug) {
        try {
          const narrow = narrowPublishWorkflowDebugAuditFilters(rev.rows);
          const auditUrl = buildPublishWorkflowDebugApprovalAuditUrl({
            limit: 5,
            postId: narrow.postId,
            platform: narrow.platform,
          });
          const ae = await fetch(auditUrl);
          if (ae.ok) {
            const aj = (await ae.json()) as { events?: PublishApprovalAuditRecentApiEvent[] };
            setRecentApprovalAuditEvents(approvalAuditEventsAfterRefresh(debug, aj.events));
          } else {
            setRecentApprovalAuditEvents(approvalAuditEventsAfterRefresh(debug, null));
          }
        } catch {
          setRecentApprovalAuditEvents(approvalAuditEventsAfterRefresh(debug, null));
        }
      } else {
        setRecentApprovalAuditEvents(approvalAuditEventsAfterRefresh(debug, null));
      }
      return rev;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [clientId, launchPlan, systemSignals, wf.artifacts, socialAccounts, refreshNonce, uiApprovalMode, debug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groupedByDay = useMemo(() => {
    if (!summary?.rows.length) return [];
    const m = new Map<string, RevenueOsPublishWorkflowRow[]>();
    for (const r of summary.rows) {
      const k = dayBucketKey(r);
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    return [...m.entries()].sort(([a], [b]) => {
      if (a === "Unscheduled") return 1;
      if (b === "Unscheduled") return -1;
      return a.localeCompare(b);
    });
  }, [summary]);

  const conflictRows = useMemo(() => summary?.rows.filter((r) => r.hasConflict) ?? [], [summary]);

  const approvalSummary = useMemo((): RevenueOsPublishApprovalSummary | null => {
    if (!summary?.rows.length) return null;
    return buildPublishApprovalSummary(summary.rows);
  }, [summary]);

  const governanceSummary = useMemo(() => {
    if (!summary?.rows.length) return null;
    return buildPublishApprovalGovernanceSummary(summary.rows, workerEnvApproval || uiApprovalMode);
  }, [summary, workerEnvApproval, uiApprovalMode]);

  const effectiveApproval = workerEnvApproval || uiApprovalMode;

  const governanceSettingsVm = useMemo(() => {
    if (!campaignGovernanceMeta || !summary || !viewerCanViewApprovalAnalytics || !governanceEntitlements) {
      return null;
    }
    return buildCampaignGovernanceSettingsViewModel({
      workerEnvRequiresApproval: workerEnvApproval,
      uiSessionRequiresApproval: uiApprovalMode,
      publishApprovalChain: campaignGovernanceMeta.publishApprovalChain,
      publishApprovalReportSchedule,
      reviewerRoleCounts: campaignGovernanceMeta.reviewerRoleCounts,
      rows: summary.rows,
      canManageReviewerAssignments: viewerCanManageReviewerAssignments,
      canViewApprovalAnalytics: viewerCanViewApprovalAnalytics,
      mayFinalizePublishApproval: viewerMayFinalizePublishApproval,
      viewerCampaignReviewerRole: viewerCampaignReviewerRole ?? "owner",
      entitlements: governanceEntitlements,
      governancePlanTierLabel,
    });
  }, [
    campaignGovernanceMeta,
    summary,
    workerEnvApproval,
    uiApprovalMode,
    publishApprovalReportSchedule,
    viewerCanViewApprovalAnalytics,
    viewerCanManageReviewerAssignments,
    viewerMayFinalizePublishApproval,
    viewerCampaignReviewerRole,
    governanceEntitlements,
    governancePlanTierLabel,
  ]);

  const refetchApprovalAnalyticsOnly = useCallback(async () => {
    if (!campaignId || !viewerCanViewApprovalAnalytics || !effectiveGovernanceEntitlements.approvalAnalyticsEnabled) {
      return;
    }
    setAnalyticsRefreshing(true);
    try {
      const wr = effectiveApproval ? "true" : "false";
      try {
        const ar = await fetch(
          `/api/campaigns/${campaignId}/publish-approval-analytics?workerRequiresApproval=${wr}`
        );
        if (ar.ok) {
          setApprovalAnalytics((await ar.json()) as PublishApprovalAnalyticsResult);
        }
      } catch {
        setApprovalAnalytics(null);
      }
      try {
        const rr = await fetch(
          `/api/campaigns/${campaignId}/publish-approval-reviewer-analytics?workerRequiresApproval=${wr}`
        );
        if (rr.ok) {
          setReviewerAnalytics((await rr.json()) as PublishApprovalReviewerAnalyticsResult);
        }
      } catch {
        setReviewerAnalytics(null);
      }
    } finally {
      setAnalyticsRefreshing(false);
    }
  }, [campaignId, viewerCanViewApprovalAnalytics, effectiveApproval, effectiveGovernanceEntitlements.approvalAnalyticsEnabled]);

  const patchPostApprovalFields = useCallback(
    async (
      postId: string,
      patch: {
        bentleyApprovalStatus: "not_required" | "pending_approval" | "approved" | "rejected";
        bentleyApprovedAt?: string | null;
        bentleyApprovalReason?: string | null;
      },
      row?: RevenueOsPublishWorkflowRow
    ): Promise<ApproveAllPatchWriteOutcome> => {
      const body: Record<string, unknown> = { ...patch };
      const snap = row ? buildApprovalReviewSnapshotFromWorkflowRow(row) : null;
      if (snap) {
        body.approvalReviewSnapshot = snap;
      }
      const r = await fetch(`/api/campaigns/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        staleCause?: string;
        approvalDecision?: { outcome?: string; staleCause?: string };
        error?: string;
      };
      const stale = isStaleReviewConflictResponse(r.status, j);

      if (debug) {
        if (r.ok) {
          const o = j.approvalDecision?.outcome;
          if (o === "accepted_fresh") setLastApprovalPatchDebug("accepted_fresh");
          else if (o === "accepted_idempotent")
            setLastApprovalPatchDebug("accepted_idempotent (duplicate suppressed, no audit write)");
          else setLastApprovalPatchDebug(null);
          setLastForbiddenApprovalDebug(null);
        } else if (stale) {
          setLastApprovalPatchDebug(
            `rejected_stale (${j.approvalDecision?.staleCause ?? j.staleCause ?? "unknown"}) → recovery refresh`
          );
          setLastForbiddenApprovalDebug(null);
        } else if (j.error === "FORBIDDEN_APPROVAL") {
          setLastApprovalPatchDebug(
            `rejected_forbidden (${j.approvalDecision?.outcome ?? "rejected_forbidden"})`
          );
          setLastForbiddenApprovalDebug(
            `post=${postId} · ${typeof j.message === "string" ? j.message : "FORBIDDEN_APPROVAL"}`
          );
        } else if (j.error === "APPROVAL_STEP_BLOCKED") {
          setLastApprovalPatchDebug(
            `rejected_step_blocked (${j.approvalDecision?.outcome ?? "rejected_step_blocked"})`
          );
          setLastForbiddenApprovalDebug(null);
        } else {
          setLastApprovalPatchDebug(null);
          setLastForbiddenApprovalDebug(null);
        }
      }

      if (stale) {
        toast.info(staleReviewRecoveryToastMessage(j));
        const debugSummary = await finalizeStaleReviewWorkflowRefresh({
          responseBody: j,
          postId,
          rowBefore: row
            ? {
                postId: row.postId,
                approvalStatus: row.approvalStatus,
                postRowUpdatedAt: row.postRowUpdatedAt,
              }
            : undefined,
          refresh,
          debug,
        });
        if (debugSummary) setStaleRecoveryDebug(debugSummary);
        return { staleRecovered: true };
      }

      if (!r.ok) {
        if (j.error === "APPROVAL_STEP_BLOCKED") {
          throw new Error(
            typeof j.message === "string" && j.message.trim()
              ? j.message
              : "You cannot approve this step yet (wrong role or out of order)."
          );
        }
        if (j.error === "FORBIDDEN_APPROVAL") {
          throw new Error(
            typeof j.message === "string" && j.message.trim()
              ? j.message
              : "You don't have permission to change publish approval for this campaign."
          );
        }
        throw new Error(
          typeof j === "object" && j && "message" in j && j.message
            ? String(j.message)
            : `HTTP ${r.status}`
        );
      }
      const idempotent = j.approvalDecision?.outcome === "accepted_idempotent";
      return { staleRecovered: false, idempotent };
    },
    [debug, refresh]
  );

  const rowApproveSafe = isPublishWorkflowBulkApproveSafeRow;

  function approvalBadgeClass(a?: string): string {
    if (a === "approved") return "border-emerald-800/60 text-emerald-200/90";
    if (a === "rejected") return "border-red-800/50 text-red-200/85";
    if (a === "pending_approval") return "border-amber-800/50 text-amber-200/85";
    return "border-slate-700 text-slate-500";
  }

  const onApproveRow = async (r: RevenueOsPublishWorkflowRow) => {
    if (!rowApproveSafe(r)) {
      toast.error("This row cannot be approved (blocking conflict, wrong status, or rejected).");
      return;
    }
    setBusy(true);
    try {
      const out = await patchPostApprovalFields(
        r.postId,
        {
          bentleyApprovalStatus: "approved",
          bentleyApprovedAt: new Date().toISOString(),
          bentleyApprovalReason: null,
        },
        r
      );
      if (out.staleRecovered) return;
      clearBulkApproveAllUi();
      toast.success("Marked approved.");
      setLastApprovalBulk({ label: "Row approve", n: 1 });
      setRefreshNonce((x) => x + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed.");
    } finally {
      setBusy(false);
    }
  };

  const onRejectRow = async (r: RevenueOsPublishWorkflowRow) => {
    if (r.status !== "scheduled" && r.status !== "retry_scheduled") {
      toast.error("Reject applies to scheduled / retry rows.");
      return;
    }
    setBusy(true);
    try {
      const out = await patchPostApprovalFields(
        r.postId,
        {
          bentleyApprovalStatus: "rejected",
          bentleyApprovalReason: "Rejected from publish workflow review",
        },
        r
      );
      if (out.staleRecovered) return;
      clearBulkApproveAllUi();
      toast.success("Marked rejected.");
      setRefreshNonce((x) => x + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed.");
    } finally {
      setBusy(false);
    }
  };

  const onClearRejection = async (r: RevenueOsPublishWorkflowRow) => {
    setBusy(true);
    try {
      const out = await patchPostApprovalFields(
        r.postId,
        {
          bentleyApprovalStatus: "pending_approval",
          bentleyApprovedAt: null,
          bentleyApprovalReason: null,
        },
        r
      );
      if (out.staleRecovered) return;
      clearBulkApproveAllUi();
      toast.success("Cleared rejection — now pending approval.");
      setRefreshNonce((x) => x + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const onApproveAllReady = async () => {
    if (!summary?.rows.length) return;
    const pending = selectRowsForApproveAllPending(summary.rows);
    if (!pending.length) {
      toast.message("No rows to approve.");
      return;
    }
    if (!viewerMayFinalizePublishApproval) {
      toast.message(NO_APPROVAL_PERM);
      return;
    }
    const targets = selectApproveAllTargetsForViewer(
      summary.rows,
      viewerMayFinalizePublishApproval,
      viewerCampaignReviewerRole
    );
    clearBulkApproveAllUi();
    setBusy(true);
    try {
      const batch = await executeApproveAllBatch(targets, (r) =>
        patchPostApprovalFields(
          r.postId,
          {
            bentleyApprovalStatus: "approved",
            bentleyApprovedAt: new Date().toISOString(),
            bentleyApprovalReason: null,
          },
          r
        )
      );
      if (debug) setLastApproveAllBatchDebug(batch);
      setLastApproveAllVisible(batch);
      setBulkRowHighlight({
        freshApprovedPostIds: batch.freshApprovedPostIds,
        idempotentPostIds: batch.idempotentPostIds,
      });
      const { variant, text } = formatApproveAllBatchUserMessage(batch);
      if (variant === "success") toast.success(text);
      else toast.message(text);

      const touched = batch.succeededCount + batch.idempotentCount;
      if (touched > 0) {
        setLastApprovalBulk({ label: "Approve all ready", n: touched });
      }
      if (!batch.staleStoppedAtPostId) {
        setRefreshNonce((x) => x + 1);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk approve failed.");
    } finally {
      setBusy(false);
    }
  };

  const runSchedulePatches = async (
    patches: { postId: string; scheduledAtIso: string; useBentleyAuditSource: boolean }[]
  ) => {
    let n = 0;
    for (const p of patches) {
      const body: Record<string, unknown> = {
        scheduledAt: p.scheduledAtIso,
        scheduledPublishSourceHint: p.useBentleyAuditSource ? "bentley_sequence_apply" : "manual_schedule",
      };
      const r = await fetch(`/api/campaigns/posts/${p.postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(
          typeof j === "object" && j && "message" in j ? String((j as { message?: string }).message) : `HTTP ${r.status}`
        );
      }
      n += 1;
    }
    return n;
  };

  const onApplySuggested = async (overwrite: boolean) => {
    if (!summary?.rows.length) return;
    setBusy(true);
    try {
      const plan = confirmPublishWorkflowSchedule({
        rows: summary.rows,
        confirmOverwrite: overwrite,
        skipAdvisoryConflicts: false,
      });
      const applied = await runSchedulePatches(plan.patches);
      setLastBulk({
        label: overwrite ? "Apply suggested (allow overwrite)" : "Apply suggested",
        applied,
        skipped: plan.skippedCount,
        conflicts: plan.conflictCount,
        skippedReasons: plan.skipped.slice(0, 12),
      });
      toast.success(`Applied ${applied} schedule update(s).`);
      clearBulkApproveAllUi();
      setRefreshNonce((x) => x + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Schedule update failed.");
    } finally {
      setBusy(false);
    }
  };

  const onAcceptNonConflicting = async () => {
    if (!summary?.rows.length) return;
    setBusy(true);
    try {
      const plan = confirmPublishWorkflowScheduleNonConflicting({
        rows: summary.rows,
        confirmOverwrite: false,
      });
      const applied = await runSchedulePatches(plan.patches);
      setLastBulk({
        label: "Accept non-conflicting",
        applied,
        skipped: plan.skippedCount,
        conflicts: plan.conflictCount,
        skippedReasons: plan.skipped.slice(0, 12),
      });
      toast.success(`Applied ${applied} safe schedule update(s).`);
      clearBulkApproveAllUi();
      setRefreshNonce((x) => x + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Schedule update failed.");
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (r: RevenueOsPublishWorkflowRow) => {
    const canApprove = rowApproveSafe(r);
    const showApprovalActions =
      r.status === "scheduled" || r.status === "retry_scheduled";
    const noApprPerm = !viewerMayFinalizePublishApproval;
    const chainBlocked =
      r.currentApprovalRequiredRole != null &&
      !rowViewerEligibleForCurrentApprovalChain(r, viewerCampaignReviewerRole);
    const overdueChip = buildPublishWorkflowOverdueChip(r);
    const bulkHl = rowBulkApproveHighlightKind(r.postId, bulkRowHighlight);
    return (
      <div
        key={r.postId}
        className={cn(
          "rounded-md border border-slate-800/90 bg-slate-900/35 px-2 py-2 text-xs",
          r.hasConflict && r.conflictSeverity === "blocking" && "border-red-900/40 bg-red-950/20",
          r.hasConflict && r.conflictSeverity === "advisory" && "border-amber-900/35 bg-amber-950/15",
          bulkHl === "fresh" && "ring-1 ring-emerald-800/45 bg-emerald-950/20",
          bulkHl === "idempotent" && "ring-1 ring-slate-600/40 bg-slate-800/25"
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-100 capitalize">{r.platform}</span>
          {r.role ? (
            <span className="rounded border border-slate-700 px-1 py-0.5 text-[10px] text-slate-400">
              {r.role.replace(/_/g, " ")}
            </span>
          ) : null}
          <span className={cn("rounded border px-1 py-0.5 text-[10px] uppercase", statusBadgeClass(r.status))}>
            {r.status.replace(/_/g, " ")}
          </span>
          <span
            className={cn(
              "rounded border px-1 py-0.5 text-[10px]",
              approvalBadgeClass(r.approvalStatus ?? "not_required")
            )}
            title="Publish approval (distinct from schedule)"
          >
            {approvalStatusLabel(r.approvalStatus)}
          </span>
          {r.approvalStatus === "pending_approval" &&
          r.totalApprovalSteps != null &&
          r.totalApprovalSteps > 1 ? (
            <span
              className="rounded border border-sky-900/50 px-1 py-0.5 text-[10px] text-sky-200/85"
              title="Multi-step approval chain"
            >
              Step {(r.currentApprovalStepIndex ?? 0) + 1}/{r.totalApprovalSteps} · {r.currentApprovalRequiredRole ?? "—"}
            </span>
          ) : null}
          {overdueChip.show ? (
            <span
              className="rounded border border-rose-900/55 px-1 py-0.5 text-[10px] text-rose-200/90"
              title={overdueChip.title}
            >
              {overdueChip.text}
            </span>
          ) : null}
          {effectiveApproval && r.eligibleForWorker ? (
            <span className="rounded border border-emerald-800/50 px-1 py-0.5 text-[10px] text-emerald-200/90">
              Worker-ready
            </span>
          ) : null}
          {r.hasConflict ? (
            <span className="rounded border border-amber-800/50 px-1 py-0.5 text-[10px] text-amber-200/85">
              {r.conflictSeverity ?? "conflict"}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{r.bodyPreview}</p>
        <div className="mt-1 grid gap-0.5 text-[10px] text-slate-500 sm:grid-cols-2">
          <div>
            Suggested: <span className="text-slate-300">{formatWhen(r.suggestedScheduledAt ?? undefined)}</span>
          </div>
          <div>
            Actual: <span className="text-slate-300">{formatWhen(r.actualScheduledAt ?? undefined)}</span>
          </div>
          {r.sequenceDayIndex != null ? <div>Sequence day: {r.sequenceDayIndex}</div> : null}
        </div>
        {r.conflictReason ? <p className="mt-1 text-[10px] text-amber-200/80">{r.conflictReason}</p> : null}
        {r.approvalStatus === "approved" ? (
          <p className="mt-1 text-[10px] text-slate-400">
            {r.hasApprovalIdentity && r.approvalDecidedByLabel ? (
              <>
                Approved by <span className="text-slate-200">{r.approvalDecidedByLabel}</span>
                {r.approvalActorRole ? (
                  <span className="text-slate-500"> · {r.approvalActorRole}</span>
                ) : null}
                {r.approvalDecidedAt ? (
                  <span className="text-slate-500"> · {formatWhen(r.approvalDecidedAt)}</span>
                ) : null}
              </>
            ) : r.approvalIdentitySessionOnly && r.approvalDecidedByLabel ? (
              <>
                Approved (label only: <span className="text-slate-200">{r.approvalDecidedByLabel}</span>) — no user id
                stored
              </>
            ) : (
              <>Approved — approver identity not recorded (legacy or session-only).</>
            )}
          </p>
        ) : null}
        {r.approvalStatus === "rejected" ? (
          <p className="mt-1 text-[10px] text-slate-400">
            {r.hasApprovalIdentity && r.approvalDecidedByLabel ? (
              <>
                Rejected by <span className="text-slate-200">{r.approvalDecidedByLabel}</span>
                {r.approvalActorRole ? (
                  <span className="text-slate-500"> · {r.approvalActorRole}</span>
                ) : null}
              </>
            ) : r.approvalDecidedByLabel ? (
              <>
                Rejected (label: <span className="text-slate-200">{r.approvalDecidedByLabel}</span>) — user id not
                stored
              </>
            ) : (
              <>Rejected — rejecter identity not recorded.</>
            )}
            {r.approvalReason ? (
              <span className="block text-red-200/75 mt-0.5">
                {r.approvalReason.slice(0, 120)}
                {r.approvalReason.length > 120 ? "…" : ""}
              </span>
            ) : null}
          </p>
        ) : null}
        {effectiveApproval && r.approvalStatus === "pending_approval" && showApprovalActions ? (
          <p className="mt-1 text-[10px] text-amber-200/75">Pending approval</p>
        ) : null}
        {showApprovalActions ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                busy || !canApprove || r.approvalStatus === "approved" || noApprPerm || chainBlocked
              }
              title={
                chainBlocked
                  ? `This step requires ${r.currentApprovalRequiredRole ?? "another role"}.`
                  : noApprPerm
                    ? NO_APPROVAL_PERM
                    : undefined
              }
              onClick={() => void onApproveRow(r)}
              className="rounded border border-emerald-900/45 px-2 py-0.5 text-[10px] text-emerald-100/90 disabled:opacity-40"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy || r.approvalStatus === "rejected" || noApprPerm}
              title={noApprPerm ? NO_APPROVAL_PERM : undefined}
              onClick={() => void onRejectRow(r)}
              className="rounded border border-red-900/40 px-2 py-0.5 text-[10px] text-red-100/85 disabled:opacity-40"
            >
              Reject
            </button>
            {r.approvalStatus === "rejected" ? (
              <button
                type="button"
                disabled={busy || noApprPerm}
                title={noApprPerm ? NO_APPROVAL_PERM : undefined}
                onClick={() => void onClearRejection(r)}
                className="rounded border border-slate-600 px-2 py-0.5 text-[10px] text-slate-300 disabled:opacity-40"
              >
                Clear rejection
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href="/revenue-os/dashboard#launch-campaigns"
            className="text-[10px] text-cyan-300/90 underline hover:text-cyan-200"
          >
            Open in Launch Campaigns
          </Link>
        </div>
      </div>
    );
  };

  return (
    <section
      id="bentley-publish-workflow-review"
      data-bentley-section="publish-workflow-review"
      className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">Publish workflow review</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-slate-700 p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "rounded px-2 py-0.5",
                view === "list" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
              )}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setView("byDay")}
              className={cn(
                "rounded px-2 py-0.5",
                view === "byDay" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
              )}
            >
              By day
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              clearBulkApproveAllUi();
              setRefreshNonce((x) => x + 1);
            }}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Refresh
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        One place to scan sequenced drafts, suggested vs actual times, and conflicts before anything goes live. Scheduling
        only — does not publish.
      </p>
      {!loading && viewerCanViewApprovalAnalytics && campaignId && governanceSettingsVm ? (
        <CampaignGovernanceSettingsSection viewModel={governanceSettingsVm}>
          <button
            type="button"
            disabled={loading || busy}
            onClick={() => {
              clearBulkApproveAllUi();
              setRefreshNonce((x) => x + 1);
            }}
            className="rounded border border-slate-600 px-2 py-0.5 text-[10px] text-slate-200 hover:border-slate-500 disabled:opacity-40"
          >
            Refresh workflow
          </button>
          <button
            type="button"
            disabled={
              loading ||
              busy ||
              analyticsRefreshing ||
              !governanceSettingsVm.entitlements.approvalAnalyticsEnabled
            }
            title={
              !governanceSettingsVm.entitlements.approvalAnalyticsEnabled
                ? "Not available on the current plan."
                : undefined
            }
            onClick={() => void refetchApprovalAnalyticsOnly()}
            className="rounded border border-slate-600 px-2 py-0.5 text-[10px] text-slate-200 hover:border-slate-500 disabled:opacity-40"
          >
            {analyticsRefreshing ? "Refreshing…" : "Refresh analytics"}
          </button>
        </CampaignGovernanceSettingsSection>
      ) : null}
      {!loading && viewerCanViewApprovalAnalytics && campaignId ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!effectiveGovernanceEntitlements.complianceReportExportEnabled}
              title={
                !effectiveGovernanceEntitlements.complianceReportExportEnabled
                  ? "Not available on the current plan."
                  : undefined
              }
              onClick={() => void exportPublishApprovalReport(campaignId, effectiveApproval, "json")}
              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-slate-500 hover:text-white disabled:opacity-40"
            >
              Export approval report (JSON)
            </button>
            <button
              type="button"
              disabled={!effectiveGovernanceEntitlements.complianceReportExportEnabled}
              title={
                !effectiveGovernanceEntitlements.complianceReportExportEnabled
                  ? "Not available on the current plan."
                  : undefined
              }
              onClick={() => void exportPublishApprovalReport(campaignId, effectiveApproval, "csv")}
              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-slate-500 hover:text-white disabled:opacity-40"
            >
              Export approval report (CSV)
            </button>
            {!effectiveGovernanceEntitlements.complianceReportExportEnabled ? (
              <span className="text-[10px] text-slate-500">Exports: upgrade plan</span>
            ) : null}
          </div>
          <PublishApprovalReportScheduleControls
            campaignId={campaignId}
            initialSchedule={publishApprovalReportSchedule}
            disabled={loading}
            planGated={!effectiveGovernanceEntitlements.scheduledReportDeliveryEnabled}
            onDidMutate={() => setRefreshNonce((x) => x + 1)}
          />
        </>
      ) : null}
      {!loading && approvalAnalytics && viewerCanViewApprovalAnalytics ? (
        <PublishApprovalAnalyticsBlock
          summary={approvalAnalytics.summary}
          stalledPosts={approvalAnalytics.stalledPosts}
          debug={debug}
        />
      ) : null}
      {!loading && reviewerAnalytics && viewerCanViewApprovalAnalytics ? (
        <PublishApprovalReviewerAnalyticsBlock data={reviewerAnalytics} debug={debug} />
      ) : null}

      {loading && <p className="mt-3 text-slate-500">Loading…</p>}

      {!loading && summary && (
        <>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
            <span>Draft: {summary.counts.draft}</span>
            <span>Scheduled / in flight: {summary.counts.scheduled}</span>
            <span>Published: {summary.counts.published}</span>
            <span className={summary.counts.failed ? "text-red-300/90" : ""}>Failed: {summary.counts.failed}</span>
            <span className={summary.readyToConfirm ? "text-emerald-300/85" : "text-amber-200/80"}>
              {summary.readyToConfirm ? "No blocking conflicts" : "Blocking conflicts present"}
            </span>
          </div>

          <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-900/30 p-3">
            <div className="text-[11px] font-medium text-slate-300">Scheduled publish approval</div>
            <p className="mt-0.5 text-[10px] text-slate-500">
              When required, only approved scheduled posts are picked up by the timed publish worker. Approval is separate
              from choosing schedule times.
            </p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
              <input
                type="checkbox"
                className="rounded border-slate-600 bg-slate-900"
                checked={uiApprovalMode}
                disabled={busy}
                onChange={(e) => {
                  const v = e.target.checked;
                  setUiApprovalMode(v);
                  try {
                    if (v) sessionStorage.setItem(BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY, "1");
                    else sessionStorage.removeItem(BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY);
                  } catch {
                    /* ignore */
                  }
                  clearBulkApproveAllUi();
                  setRefreshNonce((x) => x + 1);
                }}
              />
              Require approval before scheduled publishing (this browser session)
            </label>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
              <span>Server env gate: {workerEnvApproval ? "on" : "off"}</span>
              <span>
                Effective:{" "}
                {effectiveApproval ? "approval required for worker" : "legacy — scheduled posts can publish"}
              </span>
            </div>
            {approvalSummary ? (
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-400">
                <span>Pending: {approvalSummary.pendingApproval}</span>
                <span>Approved: {approvalSummary.approved}</span>
                <span>Rejected: {approvalSummary.rejected}</span>
                <span className="text-emerald-200/80">Worker-eligible rows: {approvalSummary.eligibleForWorker}</span>
              </div>
            ) : null}
            {governanceSummary ? (
              <p className="mt-2 text-[10px] text-slate-500">
                Approver user id on rows:{" "}
                <span className="text-slate-300">{governanceSummary.rowsWithDeciderUserId}</span> · approved with id:{" "}
                {governanceSummary.approvedWithDeciderIdentity} · rejected with id:{" "}
                {governanceSummary.rejectedWithDeciderIdentity}
                {governanceSummary.approverIdentitiesPresent ? "" : " — none yet (legacy approvals still work)."}
              </p>
            ) : null}
            {approvalActor ? (
              <p className="mt-1 text-[10px] text-slate-500">
                PATCH actions resolve as{" "}
                <span className="text-slate-300">{approvalActor.label}</span> ({approvalActor.role}
                {approvalActor.identityBacked
                  ? ") — approver user id will be stored."
                  : ") — sign in to persist user id on posts; otherwise session-only label."}
              </p>
            ) : null}
            <div className="mt-2">
              <button
                type="button"
                disabled={busy || !summary.rows.length || !viewerMayFinalizePublishApproval}
                title={!viewerMayFinalizePublishApproval ? NO_APPROVAL_PERM : undefined}
                onClick={() => void onApproveAllReady()}
                className="rounded-md border border-emerald-900/45 bg-emerald-950/25 px-2 py-1 text-[11px] text-emerald-100/90 disabled:opacity-40"
              >
                Approve all ready rows
              </button>
              <BulkApproveLastSummaryLine batch={lastApproveAllVisible} />
            </div>
            {!viewerMayFinalizePublishApproval && effectiveApproval ? (
              <p className="mt-2 text-[10px] text-slate-500">{NO_APPROVAL_PERM}</p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !summary.rows.length}
              onClick={() => void onApplySuggested(false)}
              className="rounded-md border border-cyan-900/50 bg-cyan-950/30 px-2 py-1 text-[11px] text-cyan-100 disabled:opacity-40"
            >
              Apply suggested schedule
            </button>
            <button
              type="button"
              disabled={busy || !summary.rows.length}
              onClick={() => void onApplySuggested(true)}
              className="rounded-md border border-amber-900/40 bg-amber-950/25 px-2 py-1 text-[11px] text-amber-100 disabled:opacity-40"
            >
              Apply + overwrite existing times
            </button>
            <button
              type="button"
              disabled={busy || !summary.rows.length}
              onClick={() => void onAcceptNonConflicting()}
              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-40"
            >
              Accept non-conflicting only
            </button>
            <button
              type="button"
              onClick={() => conflictsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200"
            >
              Review conflicts
            </button>
            <button
              type="button"
              disabled={busy || summary.readyToConfirm === false}
              onClick={() => toast.message("Queue looks clean for scheduling — use Apply or Accept when ready.")}
              className="rounded-md border border-emerald-900/40 px-2 py-1 text-[11px] text-emerald-100/90 disabled:opacity-40"
            >
              Confirm schedule (check)
            </button>
            <button
              type="button"
              onClick={() =>
                toast.message("Retry failed posts from **Launch Campaigns** (existing publish/retry flow).")
              }
              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-400"
            >
              Retry failed (advisory)
            </button>
          </div>

          {!campaignId ? (
            <p className="mt-2 text-[11px] text-amber-200/80">No campaign with posts found for this client scope.</p>
          ) : null}

          {summary.blockers.length > 0 ? (
            <ul className="mt-3 list-disc list-inside text-[11px] text-amber-200/85">
              {summary.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}

          <div ref={conflictsRef} className="mt-4">
            <h4 className="text-xs font-medium text-slate-300">Queue</h4>
            {view === "list" ? (
              <div className="mt-2 space-y-2">{summary.rows.map(renderRow)}</div>
            ) : (
              <div className="mt-2 space-y-4">
                {groupedByDay.map(([day, rows]) => (
                  <div key={day}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{day}</div>
                    <div className="mt-1 space-y-2">{rows.map(renderRow)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {debug && summary && (
            <div className="mt-4 rounded border border-slate-800 bg-slate-900/60 p-2 font-mono text-[10px] text-slate-400 space-y-1">
              <div>row count: {summary.rows.length}</div>
              <AirosDebugSupportSummary
                campaignId={campaignId}
                workerEnvApproval={workerEnvApproval}
                uiApprovalMode={uiApprovalMode}
                viewerCampaignReviewerRole={viewerCampaignReviewerRole}
                viewerMayFinalizePublishApproval={viewerMayFinalizePublishApproval}
                viewerCanManageReviewerAssignments={viewerCanManageReviewerAssignments}
                viewerCanViewApprovalAnalytics={viewerCanViewApprovalAnalytics}
                chainExplicitConfigured={governanceSettingsVm?.chain.explicitChainConfigured ?? false}
                chainStepCount={governanceSettingsVm?.chain.stepCount ?? 0}
                reportScheduleEnabled={publishApprovalReportSchedule?.enabled === true}
                refreshNonce={refreshNonce}
                governancePlanTierLabel={governancePlanTierLabel}
                governanceEntitlements={effectiveGovernanceEntitlements}
              />
              <div>
                SLA scan: POST /api/campaigns/&lt;id&gt;/publish-approval-sla-scan (fires after refresh when approval
                required)
              </div>
              <div>
                overdue rows: {summary.rows.filter((x) => x.approvalStepOverdue).length} · SLA debug rows:{" "}
                {summary.rows.filter((x) => x.approvalStepSlaDebug).length}
              </div>
              {summary.rows
                .filter((x) => x.approvalStepSlaDebug)
                .slice(0, 8)
                .map((x) => (
                  <div key={x.postId} className="whitespace-pre-wrap border-t border-slate-800/80 pt-1">
                    sla {x.postId}: started={x.approvalStepSlaDebug?.stepStartedAtIso ?? "—"} · logicalStep=
                    {String(x.approvalStepSlaDebug?.logicalAwaitingStepIndex)} · overdueAfterMs=
                    {String(x.approvalStepSlaDebug?.overdueAfterMs)} · reminderFor=
                    {String(x.approvalStepSlaDebug?.slaReminderSentForLogicalStep)} · reminderEligible=
                    {x.approvalStepSlaDebug?.reminderEligible ? "yes" : "no"}
                  </div>
                ))}
              <div>sort basis: {summary.sortBasis ?? "—"}</div>
              <div>conflict rows: {conflictRows.length}</div>
              <div>
                approval: env={workerEnvApproval ? "on" : "off"} · ui session={uiApprovalMode ? "on" : "off"} · effective=
                {effectiveApproval ? "required" : "off"}
              </div>
              {approvalSummary ? (
                <div>
                  approval counts: pending {approvalSummary.pendingApproval} · approved {approvalSummary.approved} ·
                  rejected {approvalSummary.rejected} · worker-eligible {approvalSummary.eligibleForWorker}
                </div>
              ) : null}
              {approvalActor ? (
                <div>
                  resolved PATCH actor: {approvalActor.label} (userId={String(approvalActor.userId)} role=
                  {approvalActor.role} identityBacked={approvalActor.identityBacked ? "yes" : "no"})
                </div>
              ) : (
                <div>resolved PATCH actor: —</div>
              )}
              <div>
                campaign reviewer: role={viewerCampaignReviewerRole ?? "—"} · mayFinalize=
                {viewerMayFinalizePublishApproval ? "yes" : "no"} · approval writes require owner, editor, or approver
                (not reviewer)
              </div>
              <div>row gate: same for every scheduled row — UI disables approve/reject when mayFinalize=no</div>
              <div>last forbidden approval: {lastForbiddenApprovalDebug ?? "—"}</div>
              <div>last approval PATCH: {lastApprovalPatchDebug ?? "—"}</div>
              <PublishWorkflowApproveAllBatchDebug batch={lastApproveAllBatchDebug} />
              <PublishWorkflowStaleRecoveryDebug summary={staleRecoveryDebug} />
              {governanceSummary ? (
                <div>
                  governance: rowsWithUserId {governanceSummary.rowsWithDeciderUserId} · approvedWithId{" "}
                  {governanceSummary.approvedWithDeciderIdentity} · rejectedWithId{" "}
                  {governanceSummary.rejectedWithDeciderIdentity}
                </div>
              ) : null}
              <div>
                rows with hasApprovalIdentity:{" "}
                {summary.rows.filter((x) => x.hasApprovalIdentity).length} · session-only label only:{" "}
                {summary.rows.filter((x) => x.approvalIdentitySessionOnly).length}
              </div>
              {lastApprovalBulk ? (
                <div>
                  last approval bulk: {lastApprovalBulk.label} · {lastApprovalBulk.n} row(s)
                </div>
              ) : (
                <div>last approval bulk: —</div>
              )}
              {lastBulk ? (
                <>
                  <div>
                    last bulk: {lastBulk.label} · applied {lastBulk.applied} · skipped {lastBulk.skipped} · conflict
                    skips {lastBulk.conflicts}
                  </div>
                  {lastBulk.skippedReasons.length ? (
                    <div className="whitespace-pre-wrap">
                      skipped sample:
                      {lastBulk.skippedReasons.map((s) => `\n- ${s.postId}: ${s.reason}`).join("")}
                    </div>
                  ) : null}
                </>
              ) : (
                <div>last bulk: —</div>
              )}
              <PublishWorkflowDebugApprovalAuditList events={recentApprovalAuditEvents} formatWhen={formatWhen} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
