"use client";

import { Suspense, useMemo, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BentleyPipelineAmbientStatusForDashboard } from "@/components/ai-revenue-os/BentleyPipelineAmbientStatus";
import { BentleyDashboardBridge, clearBentleyPreparedBadge, markRevenueOsDashboardUserTouched, readBentleyPreparedBadge } from "@/components/revenue-os/BentleyDashboardBridge";
import { BentleyDashboardPipelineAutorun } from "@/components/revenue-os/BentleyDashboardPipelineAutorun";
import { BentleyDashboardWorkflowPanel } from "@/components/revenue-os/BentleyDashboardWorkflowPanel";
import { BentleyOptimizationInsightsPanel } from "@/components/revenue-os/BentleyOptimizationInsightsPanel";
import {
  appendDashboardTrendsToFormNotes,
  EMPTY_DASHBOARD_CONTEXT,
  coercePlatformLabelStrings,
  normalizeDashboardFormValues,
  runRevenueOsFullAnalysis,
  type RevenueOsDashboardFormValues,
} from "@/lib/revenue-os/run-revenue-os-analysis";
import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";
import { RevenueProjectionChart } from "@/components/revenue-os/RevenueProjectionChart";
import { LeverImpactChart } from "@/components/revenue-os/LeverImpactChart";
import { CacRiskGauge } from "@/components/revenue-os/CacRiskGauge";
import { BenchmarkComparisonPanel } from "@/components/revenue-os/BenchmarkComparisonPanel";
import { MarketScanHistoryPanel } from "@/components/revenue-os/MarketScanHistoryPanel";
import { PlanVsActualsPanel } from "@/components/revenue-os/PlanVsActualsPanel";
import { DeploymentCenterPanel } from "@/components/revenue-os/DeploymentCenterPanel";
import { PerformanceMemorySection } from "@/components/revenue-os/PerformanceMemorySection";
import { OfferLadderPanel } from "@/components/revenue-os/OfferLadderPanel";
import { CampaignLaunchSectionFromBentleySnapshot } from "@/components/ai-revenue-os/CampaignLaunchSection";
import { BentleyLaunchReadinessSummary } from "@/components/revenue-os/BentleyLaunchReadinessSummary";
import { BentleyRunObservabilityDebugPanel } from "@/components/revenue-os/BentleyRunObservabilityDebugPanel";
import { ActiveClientIndicator } from "@/components/client-context/ActiveClientIndicator";
import {
  AiRevenueOsSharedStateProvider,
  useAiRevenueOsBentleyActions,
} from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import { BentleyPersistedSnapshotHydration } from "@/components/ai-revenue-os/BentleyPersistedSnapshotHydration";
import { BentleyAiRevenueOsScopeSync } from "@/components/ai-revenue-os/BentleyAiRevenueOsScopeSync";
import { BentleyDashboardSharedStateSync } from "@/components/ai-revenue-os/BentleyDashboardSharedStateSync";
import { reconcileBentleySnapshotFromWorkflow } from "@/lib/revenue-os/bentley-pipeline-stage-sync";
import { BentleyDashboardMirrorToForm } from "@/components/ai-revenue-os/BentleyDashboardMirrorToForm";
import { BentleyRevenueOsChat } from "@/components/ai-revenue-os/BentleyRevenueOsChat";
import { TrendsLibrarySection } from "@/components/ai-revenue-os/TrendsLibrarySection";
import { EmailMarketingSection } from "@/components/ai-revenue-os/EmailMarketingSection";
import { CampaignFromNotesSection } from "@/components/ai-revenue-os/CampaignFromNotesSection";
import { ContentEngineSection } from "@/components/ai-revenue-os/ContentEngineSection";
import { PastGenerationsPanel } from "@/components/ai-revenue-os/PastGenerationsPanel";
import { VariantOptimizationPanel } from "@/components/ai-revenue-os/VariantOptimizationPanel";
import { DistributionVolumePanel } from "@/components/ai-revenue-os/DistributionVolumePanel";
import { IntelligenceAccelerationPanel } from "@/components/ai-revenue-os/IntelligenceAccelerationPanel";
import { appendCampaignBriefIfMissing } from "@/lib/revenue-os/unified-generation-markers";
import { WorkspaceIntegrationsSection } from "@/components/revenue-os/WorkspaceIntegrationsSection";
import { buildNotesFromContext } from "@/lib/revenue-os/notes-engine";
import {
  enrichDashboardFormNotesFromWorkflow,
  REVENUE_OS_BENTLEY_ANALYSIS_SESSION_KEY,
  REVENUE_OS_BENTLEY_AUTORUN_PENDING_KEY,
} from "@/lib/revenue-os/bentley-dashboard-handoff";
import {
  BENTLEY_SCOPE_DEFAULT_CLIENT,
  BENTLEY_STORAGE_SCOPE_CHANGED_EVENT,
  readBentleySessionWithLegacyFallback,
  removeBentleySessionScopedAndLegacy,
  setBentleyStorageScope,
  writeBentleySession,
} from "@/lib/revenue-os/bentley-storage-scope";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";
import { getResolvedUserIdFromStorage } from "@/lib/revenue-os/bentley-user-session";
import type { TrendsResponse } from "@/lib/revenue-os/trends-schema";
import { fetchTrustRecordsMeActive } from "@/lib/trust-records-me-client";
import {
  bentleyCompletionSummaryLine,
  computePrimaryFocusLever,
} from "@/lib/revenue-os/analysis-derivations";
import {
  dedupePostingPlatforms,
  OAUTH_CONNECTABLE_PLATFORMS,
  postingPlatformDisplayName,
} from "@/lib/revenue-os/bentley-posting-platforms";
import {
  connectedSocialPlatformsSet,
  isContentPlatformChipId,
  normalizeStrategyLabelToContentPlatformId,
} from "@/lib/social/platform-identity";
import { SocialPostingPlatformsPanel } from "@/components/revenue-os/SocialPostingPlatformsPanel";
import { SocialRevenueOsStudioPanel } from "@/components/revenue-os/SocialRevenueOsStudioPanel";
import { RevenueOsConnectedAccountsPanel } from "@/components/revenue-os/RevenueOsConnectedAccountsPanel";
import { RevenueOsInboxPanel } from "@/components/revenue-os/RevenueOsInboxPanel";
import { StrategyPostingAlignmentBadge } from "@/components/revenue-os/StrategyPostingAlignmentBadge";
import { BentleyFirstCampaignAssetCard } from "@/components/revenue-os/BentleyFirstCampaignAssetCard";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import { readCachedContentEngineOutput } from "@/lib/revenue-os/content-engine-cache";
import { scrollToFirstCampaignAssetCard } from "@/lib/revenue-os/bentley-first-campaign-ui";
import {
  coerceTrimmedString,
  dashboardIndustryHead,
  dashboardIndustryOfferType,
} from "@/lib/revenue-os/bentley-string-coerce";
import { loadWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import { repairCorruptBentleyPersistedSession } from "@/lib/revenue-os/bentley-session-repair";
import { BentleyCampaignOutputTile } from "@/components/revenue-os/BentleyCampaignOutputTile";
import { useInvalidateSocialAccounts, useSocialAccounts } from "@/hooks/useSocialAccounts";

const ACCENT = "#00D1FF";

/** In-page hash scroll for dashboard sections — kept local so mount effects never depend on a missing import. */
function scrollDashboardHashIntoView(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const raw = (window.location.hash || "").replace(/^#/, "").trim();
  if (!raw) return;
  const key = raw === "launch-campaigns" ? "campaign-launch" : raw;
  window.setTimeout(() => {
    try {
      const byId = document.getElementById(key);
      if (byId) {
        byId.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const bySection =
        document.querySelector<HTMLElement>(`[data-bentley-section="${raw}"]`) ??
        document.querySelector<HTMLElement>(`[data-bentley-section="${key}"]`);
      bySection?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      /* ignore scroll failures (extensions / missing targets) */
    }
  }, 80);
}

const btn3dGold =
  "relative px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 active:translate-y-[2px] active:shadow-none text-black border border-cyan-600 shadow-[0_4px_0_#06b6d4,0_6px_12px_rgba(0,0,0,0.4)] hover:shadow-[0_5px_0_#06b6d4,0_8px_16px_rgba(0,0,0,0.5)] hover:-translate-y-0.5";
const btn3dOutline =
  "relative px-4 py-2 rounded-xl font-medium transition-all duration-200 active:translate-y-[2px] text-cyan-400 border-2 border-cyan-500 shadow-[0_3px_0_#0e7490] hover:bg-cyan-500/10";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="border border-cyan-500/50 rounded-2xl p-6 shadow-lg bg-slate-800/50"
    >
      <h2 className="text-lg font-semibold mb-4 text-cyan-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Kpi({
  title,
  value,
  delta,
  deltaMoney,
  isGap,
  sparkline,
}: {
  title: string;
  value: string;
  delta?: number;
  deltaMoney?: boolean;
  isGap?: boolean;
  sparkline?: boolean;
}) {
  const accentColor = isGap ? ACCENT : ACCENT;
  const fmtDelta = (n: number) =>
    deltaMoney
      ? n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
      : Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const deltaEl =
    delta !== undefined && delta !== 0 ? (
      <span
        className="ml-2 text-sm font-medium"
        style={{ color: delta > 0 ? ACCENT : "#7DF9FF" }}
      >
        {delta > 0 ? "↑" : "↓"} {fmtDelta(delta)}
      </span>
    ) : null;
  return (
    <div
      className="border rounded-2xl p-6 shadow-lg relative overflow-hidden bg-slate-800/50"
      style={{ borderColor: accentColor }}
    >
      {sparkline && (
        <div
          className="absolute bottom-4 right-4 w-16 h-8 opacity-20"
          style={{ borderColor: accentColor }}
        >
          <svg viewBox="0 0 64 32" className="w-full h-full">
            <path
              d="M0 24 L16 20 L32 16 L48 10 L64 4"
              fill="none"
              stroke={accentColor}
              strokeWidth="1.5"
            />
          </svg>
        </div>
      )}
      <div className="text-gray-400 text-sm">{title}</div>
      <div className="text-2xl font-bold mt-2 text-white flex items-baseline">
        {value}
        {deltaEl}
      </div>
    </div>
  );
}

function Lever({
  name,
  cur,
  tgt,
  money,
  isFocus,
}: {
  name: string;
  cur: number;
  tgt: number;
  money?: boolean;
  isFocus?: boolean;
}) {
  const fmt = (n: number) =>
    money
      ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
      : n.toLocaleString();
  const delta = tgt - cur;
  const improving = name === "CAC" ? delta < 0 : delta > 0;
  const deltaColor = improving ? ACCENT : "#7DF9FF";
  return (
    <div
      className={`rounded-xl p-4 border ${
        isFocus ? "ring-2 ring-cyan-500 ring-offset-2 ring-offset-slate-950" : ""
      }`}
      style={{
        backgroundColor: "rgba(0,0,0,0.4)",
        borderColor: isFocus ? ACCENT : "rgba(0,209,255,0.4)",
      }}
    >
      {isFocus && (
        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
          Primary Focus
        </div>
      )}
      <div className="text-sm text-gray-400">{name}</div>
      <div className="mt-2 text-sm text-gray-300 space-y-1">
        <div>
          Current: <span className="font-semibold">{fmt(cur)}</span>
        </div>
        <div>
          Target:{" "}
          <span className="font-semibold" style={{ color: ACCENT }}>
            {fmt(tgt)}
          </span>
        </div>
        <div>
          Delta:{" "}
          <span className="font-semibold" style={{ color: deltaColor }}>
            {improving ? "↑" : "↓"} {fmt(Math.abs(delta))}
          </span>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card title={title}>
      <ul className="list-disc pl-5 text-gray-300 space-y-2">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Optional helper under the label (e.g. strategy vs OAuth). */
  hint?: string;
}) {
  return (
    <label className="block mb-4">
      <div className="text-sm text-gray-400 mb-2">{label}</div>
      {hint ? <p className="text-xs text-gray-500 mb-2 leading-relaxed">{hint}</p> : null}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 rounded-xl border border-cyan-500/50 bg-black/40 text-white focus:outline-none focus:border-cyan-500"
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block mb-4">
      <div className="text-sm text-gray-400 mb-2">{label}</div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full p-3 rounded-xl border border-cyan-500/50 bg-black/40 text-white focus:outline-none focus:border-cyan-500"
      />
    </label>
  );
}

type BentleyCompletionPhase =
  | "idle"
  | "prepared"
  | "running"
  | "pipeline_running"
  | "complete"
  | "failed";

type BentleyDashboardAutorunKind = null | "analysis" | "pipeline";

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block mb-4">
      <div className="text-sm text-gray-400 mb-2">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full min-h-[72px] p-3 rounded-xl border border-cyan-500/50 bg-black/40 text-white text-sm focus:outline-none focus:border-cyan-500"
      />
    </label>
  );
}

/** After debounced form→Bentley snapshot apply, align pipeline stage flags with workflow (explicit readiness vs timer guessing). */
function BentleyDashboardFormSyncWithPipeline({ form }: { form: RevenueOsDashboardFormValues }) {
  const { applyBentleyPatch, getBentleySnapshot } = useAiRevenueOsBentleyActions();
  const onFormSynced = useCallback(() => {
    reconcileBentleySnapshotFromWorkflow(applyBentleyPatch, getBentleySnapshot);
  }, [applyBentleyPatch, getBentleySnapshot]);
  return (
    <BentleyDashboardSharedStateSync form={form} onBentleySnapshotAppliedFromForm={onFormSynced} />
  );
}

/** Avoid SSR/client HTML drift from sessionStorage reads and repair corrupt JSON before panels mount. */
function DashboardClientMountGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    try {
      repairCorruptBentleyPersistedSession();
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);
  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 text-white px-6 py-10">
        <p className="text-sm text-slate-400">Loading Revenue OS dashboard…</p>
      </div>
    );
  }
  return <>{children}</>;
}

function RevenueOSDashboardInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<RevenueOsAnalyzeResponse | null>(null);
  const [hydratedFromBentley, setHydratedFromBentley] = useState(false);
  const [bentleyPreparedBadge, setBentleyPreparedBadge] = useState(false);
  const [bentleyCompletionPhase, setBentleyCompletionPhase] = useState<BentleyCompletionPhase>("idle");
  const [bentleyAutorunKind, setBentleyAutorunKind] = useState<BentleyDashboardAutorunKind>(null);
  const [bentleyRunError, setBentleyRunError] = useState<string | null>(null);
  const [bentleyExecutionCampaignId, setBentleyExecutionCampaignId] = useState<string | null>(null);
  const bentleyAutorunKindRef = useRef<BentleyDashboardAutorunKind>(null);
  useEffect(() => {
    bentleyAutorunKindRef.current = bentleyAutorunKind;
  }, [bentleyAutorunKind]);
  const [userId, setUserId] = useState("demo-user");
  const [clientId, setClientId] = useState<string>("");
  const [trustId, setTrustId] = useState<string>("");
  const safeClientId = useMemo(() => coerceTrimmedString(clientId), [clientId]);
  const safeTrustId = useMemo(() => coerceTrimmedString(trustId), [trustId]);
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<string | null>(null);
  const [snapshotRefreshKey, setSnapshotRefreshKey] = useState(0);
  const [planActualsRefreshKey, setPlanActualsRefreshKey] = useState(0);
  const lastPersistedCapitalHash = useRef<string | null>(null);
  const [trendsResult, setTrendsResult] = useState<TrendsResponse | null>(null);
  const trendsResultRef = useRef<TrendsResponse | null>(null);
  trendsResultRef.current = trendsResult;
  const [contentEngineOutput, setContentEngineOutput] = useState<ContentEngineOutput | null>(null);

  const [form, setForm] = useState<RevenueOsDashboardFormValues>({
    businessName: "TROOTHHERTZ Operator",
    businessType: "Consulting / Capital Architecture",
    targetAudience: "High-net-worth operators, family offices, consulting firms",
    market: "USA",
    currentMonthlyRevenue: 20000,
    targetMonthlyRevenue: 100000,
    avgOrderValue: 5000,
    grossMarginPct: 70,
    monthlyTraffic: 8000,
    conversionRatePct: 1.0,
    cac: 250,
    ltv: 8000,
    ...EMPTY_DASHBOARD_CONTEXT,
  });

  const formMergeBaselineRef = useRef(form);

  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const oauthReturnTo = useMemo(() => {
    const q = searchParams?.toString();
    return `${pathname ?? "/revenue-os/dashboard"}${q ? `?${q}` : ""}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    try {
      scrollDashboardHashIntoView();
    } catch {
      /* non-blocking */
    }
  }, [pathname]);

  useEffect(() => {
    const onHash = () => {
      try {
        scrollDashboardHashIntoView();
      } catch {
        /* non-blocking */
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const { data: socialAccounts = [] } = useSocialAccounts(safeClientId);
  const invalidateSocialAccounts = useInvalidateSocialAccounts();

  useEffect(() => {
    setUserId(getResolvedUserIdFromStorage());
  }, []);

  // Resolve workspace client/trust context from URL params, trust-records, and clients APIs
  useEffect(() => {
    const fromUrl = { c: searchParams?.get("clientId")?.trim(), t: searchParams?.get("trustId")?.trim() };
    if (fromUrl.c) setClientId((c) => c || fromUrl.c!);
    if (fromUrl.t) setTrustId((t) => t || fromUrl.t!);
  }, [searchParams]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const active = await fetchTrustRecordsMeActive();
        if (ignore || !active) return;
        if (active.trustId) setTrustId((t) => t || String(active.trustId));
        if (active.clientId) setClientId((c) => c || String(active.clientId));
      } catch {
        // optional
      }
      try {
        const clRes = await fetch("/api/clients/me");
        if (ignore || !clRes.ok) return;
        const cl = await clRes.json();
        const cid = cl?.client?.id ?? cl?.clientId;
        if (cid) setClientId((c) => c || String(cid));
      } catch {
        // optional
      }
    })();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const cid = coerceTrimmedString(clientId) || BENTLEY_SCOPE_DEFAULT_CLIENT;
    setBentleyStorageScope({ userId, clientId: cid });
  }, [userId, clientId]);

  useEffect(() => {
    setContentEngineOutput(readCachedContentEngineOutput());
  }, []);

  useEffect(() => {
    lastPersistedCapitalHash.current = null;
  }, [userId]);

  useEffect(() => {
    if (searchParams?.get("connected")) invalidateSocialAccounts(safeClientId);
  }, [searchParams, safeClientId, invalidateSocialAccounts]);

  const lastPlatformConnSig = useRef("");
  useEffect(() => {
    if (!form.postingPlatforms.length) return;
    const connected = connectedSocialPlatformsSet(socialAccounts);
    const sig = `${[...form.postingPlatforms].sort().join(",")}|${[...connected].sort().join(",")}`;
    if (sig === lastPlatformConnSig.current) return;
    lastPlatformConnSig.current = sig;
    bentleyContinuityLog("platform_connection_state_resolved", {
      targets: form.postingPlatforms,
      connected: [...connected],
    });
  }, [form.postingPlatforms, socialAccounts]);

  /** Persist a capital plan linked to the revenue profile + month after each successful analysis. */
  useEffect(() => {
    if (!res?.meta?.profileId || !res.meta.inputHash) return;
    if (lastPersistedCapitalHash.current === res.meta.inputHash) return;
    lastPersistedCapitalHash.current = res.meta.inputHash;

    const month = new Date().toISOString().slice(0, 7);
    const traffic = form.monthlyTraffic;
    const conv = form.conversionRatePct;
    const cac = form.cac;
    const impliedCustomers = traffic * (conv / 100);
    const adSpendHint = Math.round(impliedCustomers * cac);

    void fetch("/api/revenue-os/capital/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adSpend: Math.max(0, adSpendHint),
        channelMix: { paid: 60, organic: 25, referral: 15 },
        cac,
        ltv: form.ltv,
        margins: form.grossMarginPct / 100,
        aov: form.avgOrderValue,
        userId,
        clientId: safeClientId || undefined,
        trustId: safeTrustId || undefined,
        profileId: res.meta.profileId,
        snapshotMonth: month,
      }),
    })
      .then(() => setPlanActualsRefreshKey((k) => k + 1))
      .catch(() => {
        /* non-blocking */
      });
  }, [
    res?.meta?.profileId,
    res?.meta?.inputHash,
    form.monthlyTraffic,
    form.conversionRatePct,
    form.cac,
    form.ltv,
    form.grossMarginPct,
    form.avgOrderValue,
    userId,
    clientId,
    trustId,
  ]);

  const patchForm = useCallback((patch: Partial<RevenueOsDashboardFormValues>) => {
    markRevenueOsDashboardUserTouched();
    setForm((prev) => normalizeDashboardFormValues({ ...prev, ...patch }));
  }, []);

  /** Bentley snapshot → form sync (mirror). Must NOT mark user-touched or Bentley handoff hydration is skipped. */
  const applySyncPatchFromBentleyMirror = useCallback((patch: Partial<RevenueOsDashboardFormValues>) => {
    setForm((prev) => normalizeDashboardFormValues({ ...prev, ...patch }));
  }, []);

  const formRef = useRef<RevenueOsDashboardFormValues | null>(null);
  const safeForm = useMemo(() => normalizeDashboardFormValues(form), [form]);
  formRef.current = safeForm;
  formMergeBaselineRef.current = safeForm;

  const onDashboardCanonicalNotesChange = useCallback(
    (value: string) => patchForm({ notes: value }),
    [patchForm]
  );

  const dashboardIndustryLine = useMemo(
    () => dashboardIndustryHead(safeForm.businessType) || "Consulting",
    [safeForm.businessType]
  );
  const dashboardOfferTypeLine = useMemo(
    () => dashboardIndustryOfferType(safeForm.businessType),
    [safeForm.businessType]
  );

  const onDashboardIndustryChange = useCallback(
    (v: string) => patchForm({ businessType: v }),
    [patchForm]
  );
  const onDashboardTargetAudienceChange = useCallback(
    (v: string) => patchForm({ targetAudience: v }),
    [patchForm]
  );

  const dashboardContentPlatformId = useMemo(() => {
    const labels = coercePlatformLabelStrings(safeForm.platforms);
    const first = labels[0];
    if (!first) return "instagram";
    const id = normalizeStrategyLabelToContentPlatformId(first);
    return isContentPlatformChipId(id) ? id : "instagram";
  }, [safeForm.platforms]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBentleyPreparedBadge(readBentleyPreparedBadge());
  }, [hydratedFromBentley]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromStorage = () => {
      setBentleyPreparedBadge(readBentleyPreparedBadge());
      try {
        const raw = readBentleySessionWithLegacyFallback(REVENUE_OS_BENTLEY_ANALYSIS_SESSION_KEY);
        if (!raw) {
          setBentleyCompletionPhase((prev) =>
            prev === "complete" || prev === "failed" ? "idle" : prev
          );
          setBentleyRunError(null);
          return;
        }
        const j = JSON.parse(raw) as { status?: string; message?: string };
        if (j.status === "complete") setBentleyCompletionPhase("complete");
        else if (j.status === "failed") {
          setBentleyCompletionPhase("failed");
          setBentleyRunError(typeof j.message === "string" ? j.message : "Analysis failed");
        }
      } catch {
        // ignore
      }
    };
    syncFromStorage();
    window.addEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, syncFromStorage);
    return () => window.removeEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, syncFromStorage);
  }, []);

  const money = useMemo(
    () => (n: number) =>
      n.toLocaleString(undefined, { style: "currency", currency: "USD" }),
    []
  );

  const runAnalysisWithForm = useCallback(async (f: RevenueOsDashboardFormValues) => {
    const fromBentleyAutorun =
      typeof window !== "undefined" &&
      readBentleySessionWithLegacyFallback(REVENUE_OS_BENTLEY_AUTORUN_PENDING_KEY) === "1";
    if (fromBentleyAutorun) {
      removeBentleySessionScopedAndLegacy(REVENUE_OS_BENTLEY_AUTORUN_PENDING_KEY);
      setBentleyCompletionPhase("running");
      setBentleyRunError(null);
    }

    bentleyContinuityLog("full_analysis_started", {
      fromBentleyAutorun,
      businessName: f.businessName,
    });
    setLoading(true);
    setRes(null);
    const forApi = appendDashboardTrendsToFormNotes(
      enrichDashboardFormNotesFromWorkflow(f),
      trendsResultRef.current,
    );
    const result = await runRevenueOsFullAnalysis(userIdRef.current, forApi);

    if (result.ok) {
      // Keep Paste Notes aligned with what `/api/revenue-os/analyze` received (workflow merge + trends).
      applySyncPatchFromBentleyMirror({ notes: forApi.notes });
      setRes(result.data);
      bentleyContinuityLog("full_analysis_completed", { ok: true, fromBentleyAutorun });
      if (fromBentleyAutorun) {
        setBentleyCompletionPhase("complete");
        setBentleyRunError(null);
        try {
          writeBentleySession(
            REVENUE_OS_BENTLEY_ANALYSIS_SESSION_KEY,
            JSON.stringify({ status: "complete", at: Date.now() })
          );
        } catch {
          // ignore
        }
      }
    } else {
      bentleyContinuityLog("full_analysis_completed", { ok: false, fromBentleyAutorun, message: result.message });
      if (fromBentleyAutorun) {
        setBentleyCompletionPhase("failed");
        setBentleyRunError(result.message);
        try {
          writeBentleySession(
            REVENUE_OS_BENTLEY_ANALYSIS_SESSION_KEY,
            JSON.stringify({ status: "failed", message: result.message, at: Date.now() })
          );
        } catch {
          // ignore
        }
      } else {
        alert(result.message);
      }
    }
    setLoading(false);
  }, [applySyncPatchFromBentleyMirror]);

  const runAnalysisFromCurrentForm = useCallback(() => {
    void runAnalysisWithForm(form);
  }, [form, runAnalysisWithForm]);

  const onHydratedFromBentleyCb = useCallback((v: boolean) => {
    setHydratedFromBentley(v);
    if (v) setBentleyPreparedBadge(true);
    if (v) {
      setBentleyCompletionPhase((prev) =>
        prev === "complete" ||
        prev === "failed" ||
        prev === "running" ||
        prev === "pipeline_running"
          ? prev
          : "prepared"
      );
    }
  }, []);

  const onBentleyAutorunScheduledCb = useCallback((detail: { mode: "analysis" | "pipeline" }) => {
    setBentleyAutorunKind(detail.mode === "pipeline" ? "pipeline" : "analysis");
    setBentleyCompletionPhase(detail.mode === "pipeline" ? "pipeline_running" : "running");
    setBentleyRunError(null);
  }, []);

  const onPipelineAutorunFinished = useCallback((ok: boolean, reason?: string) => {
    if (ok) {
      setBentleyCompletionPhase("complete");
      setBentleyRunError(null);
      if (bentleyAutorunKindRef.current === "pipeline") {
        try {
          const cid = coerceTrimmedString(loadWorkflowState().artifacts.bentleyDbCampaignId);
          if (cid) setBentleyExecutionCampaignId(cid);
        } catch {
          /* ignore */
        }
      }
      try {
        writeBentleySession(
          REVENUE_OS_BENTLEY_ANALYSIS_SESSION_KEY,
          JSON.stringify({ status: "complete", at: Date.now() })
        );
      } catch {
        // ignore
      }
    } else {
      setBentleyCompletionPhase("failed");
      setBentleyRunError(reason ?? "Pipeline failed");
      try {
        writeBentleySession(
          REVENUE_OS_BENTLEY_ANALYSIS_SESSION_KEY,
          JSON.stringify({ status: "failed", message: reason ?? "Pipeline failed", at: Date.now() })
        );
      } catch {
        // ignore
      }
    }
  }, []);

  async function saveSnapshot() {
    if (!res) return;
    setSnapshotSaving(true);
    setSnapshotResult(null);
    try {
      const month = new Date().toISOString().slice(0, 7); // YYYY-MM
      const r = await fetch("/api/revenue-os/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          clientId: clientId || undefined,
          trustId: trustId || undefined,
          month,
          traffic: form.monthlyTraffic,
          conversionRatePct: form.conversionRatePct,
          avgOrderValue: form.avgOrderValue,
          revenue: res.kpis.currentMonthlyRevenueModel,
          cac: form.cac,
          ltv: form.ltv,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message ?? "Failed to save");
      setSnapshotResult(`Snapshot saved for ${month}`);
      setSnapshotRefreshKey((k) => k + 1);
      setPlanActualsRefreshKey((k) => k + 1);
    } catch (e) {
      setSnapshotResult(e instanceof Error ? e.message : "Failed to save snapshot");
    } finally {
      setSnapshotSaving(false);
    }
  }

  const offerLadderProfile = useMemo(
    () => ({
      userId,
      businessName: safeForm.businessName,
      businessType: safeForm.businessType,
      currentMonthlyRevenue: form.currentMonthlyRevenue,
      targetMonthlyRevenue: form.targetMonthlyRevenue,
      avgOrderValue: form.avgOrderValue,
      conversionRatePct: form.conversionRatePct,
      cac: form.cac,
      grossMarginPct: form.grossMarginPct,
    }),
    [
      userId,
      form.businessName,
      form.businessType,
      form.currentMonthlyRevenue,
      form.targetMonthlyRevenue,
      form.avgOrderValue,
      form.conversionRatePct,
      form.cac,
      form.grossMarginPct,
    ]
  );

  return (
    <AiRevenueOsSharedStateProvider>
      <DashboardClientMountGate>
      <Suspense fallback={null}>
        <BentleyAiRevenueOsScopeSync userId={userId} />
      </Suspense>
      <BentleyPersistedSnapshotHydration />
      <BentleyDashboardFormSyncWithPipeline form={safeForm} />
      <BentleyDashboardBridge
        setForm={setForm}
        getDashboardFormForMerge={() => formMergeBaselineRef.current}
        onHydratedFromBentley={onHydratedFromBentleyCb}
        onBentleyAutorunScheduled={onBentleyAutorunScheduledCb}
        runAnalysisWithForm={runAnalysisWithForm}
      />
      <BentleyDashboardPipelineAutorun
        hydratedFromBentley={hydratedFromBentley}
        userId={userId}
        clientId={safeClientId}
        trustId={safeTrustId}
        onFinished={onPipelineAutorunFinished}
      />
      <BentleyDashboardMirrorToForm formRef={formRef} applySyncPatch={applySyncPatchFromBentleyMirror} />
      <div className="min-h-screen text-white px-6 py-10 bg-slate-950">
      {bentleyExecutionCampaignId ? (
        <div className="max-w-6xl mx-auto space-y-4 py-4">
          <ActiveClientIndicator compact />
          <p className="text-sm text-slate-300 max-w-2xl">
            Bentley finished the full pipeline, persisted your campaign, and synced scheduled posts. Use the tile
            below for prompts, uploads, timing, and publish — or open the full dashboard from the tile header.
          </p>
          <BentleyCampaignOutputTile
            campaignId={bentleyExecutionCampaignId}
            clientId={safeClientId}
            onShowFullDashboard={() => setBentleyExecutionCampaignId(null)}
            onGenerateNew={() => setBentleyExecutionCampaignId(null)}
          />
        </div>
      ) : (
      <>
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <ActiveClientIndicator compact />
        </div>
        <BentleyPipelineAmbientStatusForDashboard />
        <BentleyDashboardWorkflowPanel />
        <BentleyOptimizationInsightsPanel />
        {(bentleyCompletionPhase !== "idle" ||
          hydratedFromBentley ||
          bentleyPreparedBadge) && (
          <div className="mb-4 rounded-xl border border-cyan-500/45 bg-slate-900/75 px-4 py-3 text-sm text-slate-200 shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                {bentleyCompletionPhase === "prepared" && (
                  <>
                    <p className="font-medium text-cyan-100/95">Dashboard prepared</p>
                    <p className="text-xs text-slate-400">
                      Bentley loaded this workspace from guided intake. Run analysis when you are ready.
                    </p>
                  </>
                )}
                {bentleyCompletionPhase === "running" && (
                  <p className="flex items-center gap-2 font-medium text-cyan-200">
                    <span
                      className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-cyan-400"
                      aria-hidden
                    />
                    Full Analysis running…
                  </p>
                )}
                {bentleyCompletionPhase === "pipeline_running" && (
                  <p className="flex items-center gap-2 font-medium text-cyan-200">
                    <span
                      className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-cyan-400"
                      aria-hidden
                    />
                    Revenue OS pipeline running (research through analysis)…
                  </p>
                )}
                {bentleyCompletionPhase === "complete" && (
                  <>
                    <p className="font-medium text-cyan-100/95">
                      {bentleyAutorunKind === "pipeline"
                        ? "Bentley completed the full Revenue OS pipeline, including analysis."
                        : "Bentley prepared this dashboard and completed Full Analysis."}
                    </p>
                    <p className="text-xs text-slate-400">
                      {bentleyAutorunKind === "pipeline"
                        ? "Review workflow panels and lever targets below; open Run Analysis if you want to refresh charts in this session."
                        : res
                          ? "Start with your analysis output — lever gaps and targets — before moving downstream."
                          : "Your completion status was restored; charts from the last run are not in memory."}
                    </p>
                    {res ? (
                      <p className="text-xs text-slate-300/95 mt-1.5 border-l border-cyan-500/35 pl-2.5 leading-snug">
                        {bentleyCompletionSummaryLine(res)}
                      </p>
                    ) : null}
                    <p className="text-xs font-medium text-cyan-200/85 mt-2">
                      Next: review lever targets, then move into campaign launch.
                    </p>
                  </>
                )}
                {bentleyCompletionPhase === "failed" && (
                  <>
                    <p className="font-medium text-amber-200/95">
                      {bentleyAutorunKind === "pipeline"
                        ? "Bentley couldn’t complete the Revenue OS pipeline"
                        : "Bentley couldn’t complete Full Analysis"}
                    </p>
                    {bentleyRunError ? (
                      <p className="text-xs text-amber-100/80 break-words">{bentleyRunError}</p>
                    ) : (
                      <p className="text-xs text-slate-400">Try Run Analysis again or edit inputs.</p>
                    )}
                  </>
                )}
                {bentleyCompletionPhase === "idle" && (hydratedFromBentley || bentleyPreparedBadge) && (
                  <p className="text-cyan-100/90">Bentley loaded this workspace from guided intake.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  clearBentleyPreparedBadge();
                  setBentleyPreparedBadge(false);
                  setHydratedFromBentley(false);
                  setBentleyCompletionPhase("idle");
                  setBentleyAutorunKind(null);
                  setBentleyRunError(null);
                }}
                className="shrink-0 text-xs text-cyan-400/80 hover:text-cyan-300 underline"
              >
                Dismiss Bentley status
              </button>
            </div>
            {bentleyCompletionPhase === "complete" && (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                {res ? (
                  <>
                    <a
                      href="#lever-targets"
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-cyan-50 border-2 border-cyan-400/90 bg-cyan-950/70 hover:bg-cyan-900/55 shadow-[0_4px_0_#0e7490] active:translate-y-[2px] active:shadow-none transition-all"
                    >
                      Review lever targets & KPIs
                    </a>
                    <a
                      href="#campaign-launch"
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-cyan-400/95 border border-cyan-500/45 bg-black/30 hover:bg-cyan-950/40 transition-colors"
                    >
                      Continue to campaign launch
                    </a>
                    {form.postingPlatforms.length > 0 && (
                      <button
                        type="button"
                        onClick={() => scrollToFirstCampaignAssetCard()}
                        className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-cyan-300/95 border border-cyan-500/35 bg-black/35 hover:bg-cyan-950/35 transition-colors"
                      >
                        First campaign asset
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center w-full">
                    <p className="text-xs text-slate-400 max-w-xl">
                      Charts load after analysis — this session has no in-memory results (e.g. after refresh).
                    </p>
                    <button
                      type="button"
                      onClick={() => void runAnalysisFromCurrentForm()}
                      disabled={loading}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-black border border-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      style={{
                        background: "linear-gradient(180deg, #7DF9FF 0%, #00D1FF 50%, #06b6d4 100%)",
                      }}
                    >
                      {loading ? "Running…" : "Re-run Analysis"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {(res !== null || form.postingPlatforms.length > 0) && (
          <div className="mb-4">
            <SocialPostingPlatformsPanel
              postingPlatforms={form.postingPlatforms}
              strategyPlatforms={form.platforms}
              clientId={safeClientId}
              returnTo={oauthReturnTo}
              connectedAccounts={socialAccounts}
              analysis={res}
            />
          </div>
        )}
        <div className="flex items-start justify-between gap-6 flex-wrap mb-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold">
              <span style={{ color: ACCENT }}>AI Revenue OS</span> Dashboard
            </h1>
            {(clientId || trustId) && (
              <div className="mt-2 text-xs text-gray-500">
                Workspace: {clientId && `Client ${clientId.slice(0, 8)}…`}
                {clientId && trustId && " · "}
                {trustId && `Trust ${trustId.slice(0, 8)}…`}
              </div>
            )}
            <p className="text-gray-400 mt-2">
              Modeled revenue = Traffic × Conversion × AOV. Then we engineer
              lever targets.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href="/ai-revenue-os" className={btn3dOutline}>
              Road Map
            </Link>
            <Link
              href="/revenue-os/social-lead-intelligence"
              className="px-4 py-2 rounded-xl border border-amber-500/40 font-medium text-amber-100/95 hover:bg-amber-950/35 transition-colors"
            >
              Social Lead Intel
            </Link>
            <a
              href="#social-studio"
              className="px-4 py-2 rounded-xl border border-cyan-500/40 font-medium text-cyan-100/95 hover:bg-cyan-950/35 transition-colors"
            >
              Social Studio
            </a>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-xl border border-white/30 font-medium hover:bg-white/5 transition-colors"
            >
              Dashboard
            </Link>
            <button
              onClick={runAnalysisFromCurrentForm}
              disabled={loading}
              className={`${btn3dGold} disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-[0_2px_0_#06b6d4]`}
              style={{
                background: "linear-gradient(180deg, #7DF9FF 0%, #00D1FF 50%, #06b6d4 100%)",
              }}
            >
              {loading ? "Running..." : "Run Analysis"}
            </button>
          </div>
        </div>

        <div className="mt-10 grid md:grid-cols-3 gap-6">
          <Card title="Business">
            <Field
              label="Business Name"
              value={safeForm.businessName}
              onChange={(v) => patchForm({ businessName: v })}
            />
            <Field
              label="Business Type / Industry"
              value={safeForm.businessType}
              onChange={(v) => patchForm({ businessType: v })}
            />
            <Field
              label="Target Audience"
              value={safeForm.targetAudience}
              onChange={(v) => patchForm({ targetAudience: v })}
            />
            <Field
              label="Market"
              value={safeForm.market}
              onChange={(v) => patchForm({ market: v })}
            />
          </Card>

          <Card title="Revenue Targets">
            <NumField
              label="Current Monthly Revenue"
              value={form.currentMonthlyRevenue}
              onChange={(v) => patchForm({ currentMonthlyRevenue: v })}
            />
            <NumField
              label="Target Monthly Revenue"
              value={form.targetMonthlyRevenue}
              onChange={(v) => patchForm({ targetMonthlyRevenue: v })}
            />
            <NumField
              label="Gross Margin (%)"
              value={form.grossMarginPct}
              onChange={(v) => patchForm({ grossMarginPct: v })}
            />
          </Card>

          <Card title="Acquisition & Unit Economics">
            <NumField
              label="Monthly Traffic"
              value={form.monthlyTraffic}
              onChange={(v) => patchForm({ monthlyTraffic: v })}
            />
            <NumField
              label="Conversion Rate (%)"
              value={form.conversionRatePct}
              onChange={(v) => patchForm({ conversionRatePct: v })}
            />
            <NumField
              label="Avg Order Value"
              value={form.avgOrderValue}
              onChange={(v) => patchForm({ avgOrderValue: v })}
            />
            <NumField
              label="CAC"
              value={form.cac}
              onChange={(v) => patchForm({ cac: v })}
            />
            <NumField
              label="LTV"
              value={form.ltv}
              onChange={(v) => patchForm({ ltv: v })}
            />
          </Card>
        </div>

        <div className="mt-10">
          <Card title="Analysis context (Bentley / guided intake)">
            <p className="text-xs text-gray-500 mb-4 max-w-3xl">
              Optional strategic context from AI Revenue OS guided intake. Edit anytime — included in{" "}
              <span className="text-cyan-400/90">Run Analysis</span> as notes and structured context when present.
            </p>
            <p className="text-xs text-slate-400 mb-4 max-w-3xl border-l-2 border-cyan-500/35 pl-3 leading-relaxed">
              <span className="font-medium text-cyan-200/90">Strategy channels vs. OAuth posting:</span> the comma
              list is for <span className="text-slate-200">content strategy</span> (prompts, analysis, Content Engine
              defaults). The checkboxes are <span className="text-slate-200">publish targets</span> (which networks you
              connect for Hero Factory). Changing one does not change the other.
            </p>
            <div className="grid md:grid-cols-2 gap-x-6 gap-y-0">
              <Field
                label="Core offer"
                value={safeForm.coreOffer}
                onChange={(v) => patchForm({ coreOffer: v })}
              />
              <Field
                label="Transformation / outcome"
                value={safeForm.transformation}
                onChange={(v) => patchForm({ transformation: v })}
              />
              <Field
                label="Content strategy channels (comma-separated)"
                hint="Where you focus creation or distribution (e.g. Instagram, TikTok, YouTube). Feeds analysis, Bentley context, and Content Engine. Does not enable OAuth or change publish connections."
                value={form.platforms.join(", ")}
                onChange={(v) =>
                  patchForm({
                    platforms: coercePlatformLabelStrings(
                      v.split(/[,;]+/).map((s) => (typeof s === "string" ? s : String(s)))
                    ),
                  })
                }
              />
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-cyan-200/90 mb-1">OAuth posting targets (connect & publish)</p>
                <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                  Pick networks you want to connect for publishing. Optional: mirror your strategy by checking the same
                  networks you listed as channels — or add only the ones you will OAuth. Content Engine’s “Platform” chip
                  updates the <span className="text-slate-300">strategy channel list</span> (first channel), not these
                  checkboxes.
                </p>
                <div className="flex flex-wrap gap-2">
                  {OAUTH_CONNECTABLE_PLATFORMS.map((p) => (
                    <label
                      key={p}
                      className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-cyan-500/30 bg-black/30 px-2.5 py-1.5 text-xs text-cyan-100/90 hover:border-cyan-400/50"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-cyan-500/60"
                        checked={form.postingPlatforms.includes(p)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? dedupePostingPlatforms([...form.postingPlatforms, p])
                            : form.postingPlatforms.filter((x) => x !== p);
                          patchForm({ postingPlatforms: next });
                        }}
                      />
                      {postingPlatformDisplayName(p)}
                    </label>
                  ))}
                </div>
                <StrategyPostingAlignmentBadge
                  platforms={safeForm.platforms}
                  postingPlatforms={safeForm.postingPlatforms}
                  connectedAccounts={socialAccounts}
                />
              </div>
              <Field label="Tone" value={safeForm.tone} onChange={(v) => patchForm({ tone: v })} />
              <Field
                label="Content type focus"
                value={safeForm.contentTypeFocus}
                onChange={(v) => patchForm({ contentTypeFocus: v })}
              />
              <Field label="Image style" value={safeForm.imageStyle} onChange={(v) => patchForm({ imageStyle: v })} />
            </div>
            <TextAreaField
              label="Campaign / intake notes"
              value={safeForm.notes}
              onChange={(v) => patchForm({ notes: v })}
              rows={4}
            />
          </Card>
        </div>

        <div className="mt-10">
          <OfferLadderPanel
            profile={offerLadderProfile}
            industry={dashboardIndustryLine || undefined}
            clientId={safeClientId}
            trustId={safeTrustId}
          />
        </div>

        <PerformanceMemorySection
          userId={userId}
          clientId={safeClientId}
          trustId={safeTrustId}
          industry={dashboardIndustryLine}
          createWithMetrics={{
            traffic: form.monthlyTraffic,
            conversionRatePct: form.conversionRatePct,
            avgOrderValue: form.avgOrderValue,
            cac: form.cac,
            revenue:
              res?.kpis?.currentMonthlyRevenueModel ??
              form.monthlyTraffic * (form.conversionRatePct / 100) * form.avgOrderValue,
          }}
          refreshKey={snapshotRefreshKey}
        />

        <div
          id="campaign-launch"
          data-bentley-section="launch-campaigns"
          className="scroll-mt-24"
        >
          <BentleyLaunchReadinessSummary
            postingPlatforms={form.postingPlatforms}
            connectedAccounts={socialAccounts}
            analysis={res}
            contentEngineOutput={contentEngineOutput}
          />
          <CampaignLaunchSectionFromBentleySnapshot userId={userId} clientId={safeClientId} postingTargets={form.postingPlatforms} />
        </div>

        <WorkspaceIntegrationsSection
          userId={userId}
          clientId={safeClientId}
          trustId={safeTrustId}
        />

        <div className="mt-10 space-y-10">
          <TrendsLibrarySection
            defaultIndustry={dashboardIndustryLine}
            defaultTargetAudience={safeForm.targetAudience}
            clientId={safeClientId}
            trustId={safeTrustId}
            compact
            onTrendsResult={setTrendsResult}
            canonicalDashboardFields={{
              industry: dashboardIndustryLine,
              targetAudience: safeForm.targetAudience,
              onIndustryChange: onDashboardIndustryChange,
              onTargetAudienceChange: onDashboardTargetAudienceChange,
            }}
          />
          <EmailMarketingSection industry={dashboardIndustryLine} />
          <IntelligenceAccelerationPanel
            onApplyBrief={(brief) =>
              patchForm({
                notes: appendCampaignBriefIfMissing(safeForm.notes, brief),
              })
            }
          />
          <ContentEngineSection
            defaultBusinessName={safeForm.businessName}
            defaultIndustry={dashboardIndustryLine}
            defaultTargetAudience={safeForm.targetAudience}
            defaultCoreOffer={safeForm.coreOffer}
            defaultTransformation={safeForm.transformation}
            defaultTone={safeForm.tone || "Professional"}
            defaultContentTypeFocus={safeForm.contentTypeFocus || "Full Post"}
            defaultImageStyle={safeForm.imageStyle || "cinematic"}
            defaultContentPlatformId={dashboardContentPlatformId}
            defaultPlatforms={safeForm.platforms}
            compact
            onOutputChange={setContentEngineOutput}
            dashboardFormCanonical
            onDashboardFormPatch={patchForm}
            contentPlatformSectionHelper="Sets the main channel for generated copy and prompts and updates your first content strategy channel (Analysis context). It does not add or remove OAuth posting targets—use the OAuth checkboxes in Analysis context for connect & publish."
          />
          {clientId ? (
            <div className="mb-0">
              <RevenueOsConnectedAccountsPanel
                clientId={safeClientId}
                returnToPath={`${pathname}#connected-accounts`}
              />
            </div>
          ) : null}
          {clientId ? (
            <div className="mb-8 mt-8">
              <RevenueOsInboxPanel clientId={safeClientId} />
            </div>
          ) : null}
          <div className="mb-0">
            <SocialRevenueOsStudioPanel clientId={safeClientId} contentEngineOutput={contentEngineOutput} />
          </div>
          <VariantOptimizationPanel />
          <DistributionVolumePanel />
          <PastGenerationsPanel />
          {res && form.postingPlatforms.length > 0 && contentEngineOutput && (
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => scrollToFirstCampaignAssetCard()}
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
              >
                Jump to first campaign asset →
              </button>
            </div>
          )}
          {res && form.postingPlatforms.length > 0 && (
            <BentleyFirstCampaignAssetCard
              res={res}
              form={safeForm}
              postingPlatforms={form.postingPlatforms}
              connectedAccounts={socialAccounts}
              contentEngineOutput={contentEngineOutput}
              clientId={safeClientId}
              oauthReturnTo={oauthReturnTo}
            />
          )}
          <CampaignFromNotesSection
            defaultIndustry={dashboardIndustryLine}
            defaultTargetAudience={safeForm.targetAudience}
            compact
            canonicalNotes={{
              value: safeForm.notes,
              onChange: onDashboardCanonicalNotesChange,
            }}
            canonicalIndustryAudience={{
              industry: dashboardIndustryLine,
              onIndustryChange: onDashboardIndustryChange,
              targetAudience: safeForm.targetAudience,
              onTargetAudienceChange: onDashboardTargetAudienceChange,
            }}
            contextForNotes={{
              industry: dashboardIndustryLine,
              targetAudience: safeForm.targetAudience,
              form: {
                industry: dashboardIndustryLine,
                targetAudience: safeForm.targetAudience,
                market: safeForm.market,
                businessName: safeForm.businessName,
                currentMonthlyRevenue: form.currentMonthlyRevenue,
                targetMonthlyRevenue: form.targetMonthlyRevenue,
                avgOrderValue: form.avgOrderValue,
                monthlyTraffic: form.monthlyTraffic,
                conversionRatePct: form.conversionRatePct,
                cac: form.cac,
                ltv: form.ltv,
              },
              analysis: res
                ? {
                    kpis: res.kpis,
                    levers: res.levers,
                    plan: res.plan,
                  }
                : undefined,
              trends: trendsResult
                ? {
                    industry: trendsResult.industry,
                    targetAudience: trendsResult.targetAudience,
                    items: trendsResult.items,
                    campaignAngles: trendsResult.campaignAngles,
                    contentBlueprints: trendsResult.contentBlueprints,
                  }
                : undefined,
            }}
          />
        </div>

        {res && (() => {
          const focus = computePrimaryFocusLever(res);

          return (
          <div className="mt-10 space-y-8">
            {/* Recommended Focus Lever */}
            <div
              className="rounded-2xl p-6 border border-cyan-500/50 shadow-lg bg-slate-800/50"
              style={{ borderColor: ACCENT }}
            >
              <div className="text-sm text-gray-400 mb-2">Primary Focus Lever</div>
              <div className="text-xl font-semibold" style={{ color: ACCENT }}>
                {focus.name}
              </div>
              <p className="text-gray-300 mt-2 text-sm">
                Smallest adjustment required for maximum delta impact. Start here.
              </p>
            </div>

            <BenchmarkComparisonPanel
              industry={dashboardIndustryLine}
              yourConversionPct={res.levers.conversionRatePct.current}
              yourCac={res.levers.cac.current}
            />

            <MarketScanHistoryPanel
              industry={dashboardIndustryLine}
              geo={safeForm.market}
              offerType={dashboardOfferTypeLine}
              userId={userId}
              clientId={safeClientId}
            />

            <div className="grid md:grid-cols-4 gap-6">
              <Kpi
                title="Modeled Monthly Revenue"
                value={money(res.kpis.currentMonthlyRevenueModel)}
                sparkline
              />
              <Kpi
                title="Target Monthly Revenue"
                value={money(res.kpis.targetMonthlyRevenue)}
                delta={res.kpis.targetMonthlyRevenue - res.kpis.currentMonthlyRevenueModel}
                deltaMoney
                sparkline
              />
              <Kpi
                title="Revenue Gap"
                value={money(res.kpis.revenueGap)}
                isGap
                sparkline
              />
              <Kpi
                title="Implied Orders Needed"
                value={res.kpis.impliedOrdersNeeded.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                sparkline
              />
            </div>

            <div id="lever-targets" className="scroll-mt-24">
            <Card title="Lever Targets">
              <div className="grid md:grid-cols-4 gap-6">
                <Lever
                  name="Traffic"
                  cur={res.levers.traffic.current}
                  tgt={res.levers.traffic.target}
                  isFocus={focus.key === "traffic"}
                />
                <Lever
                  name="Conversion (%)"
                  cur={res.levers.conversionRatePct.current}
                  tgt={res.levers.conversionRatePct.target}
                  isFocus={focus.key === "conversionRatePct"}
                />
                <Lever
                  name="AOV"
                  cur={res.levers.avgOrderValue.current}
                  tgt={res.levers.avgOrderValue.target}
                  money
                  isFocus={focus.key === "avgOrderValue"}
                />
                <Lever
                  name="CAC"
                  cur={res.levers.cac.current}
                  tgt={res.levers.cac.target}
                  money
                  isFocus={focus.key === "cac"}
                />
              </div>
            </Card>
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-3 gap-6">
              <RevenueProjectionChart
                current={res.kpis.currentMonthlyRevenueModel}
                optimized={res.kpis.targetMonthlyRevenue}
                industryMedian={res.kpis.targetMonthlyRevenue * 0.6}
              />
              <LeverImpactChart
                baseRevenue={res.kpis.currentMonthlyRevenueModel}
                convOnly={res.levers.traffic.current * (res.levers.conversionRatePct.target / 100) * res.levers.avgOrderValue.current}
                aovOnly={res.levers.traffic.current * (res.levers.conversionRatePct.current / 100) * res.levers.avgOrderValue.target}
                trafficOnly={res.levers.traffic.target * (res.levers.conversionRatePct.current / 100) * res.levers.avgOrderValue.current}
              />
              <CacRiskGauge cac={res.levers.cac.current} aov={res.levers.avgOrderValue.current} />
            </div>

            <PlanVsActualsPanel
              userId={userId}
              clientId={safeClientId}
              trustId={safeTrustId}
              profileId={res.meta.profileId}
              refreshKey={planActualsRefreshKey}
            />

            <div className="grid md:grid-cols-2 gap-6">
              <PlanCard title="Offer Engineering" items={res.plan.offerEngineering} />
              <PlanCard title="Funnel Deployment" items={res.plan.funnel} />
              <PlanCard title="Sales Execution" items={res.plan.sales} />
              <PlanCard title="Capital Allocation" items={res.plan.capitalAllocation} />
              <PlanCard title="Optimization Loop" items={res.plan.optimization} />
              <Card title="Run Meta">
                <div className="text-gray-300 text-sm space-y-2">
                  <div>
                    <span className="text-gray-500">Hash:</span>{" "}
                    {res.meta.inputHash.slice(0, 16)}…
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>{" "}
                    {new Date(res.meta.createdAt).toLocaleString()}
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={saveSnapshot}
                      disabled={snapshotSaving}
                      className="px-4 py-2 rounded-xl border border-cyan-500/60 text-cyan-400 text-sm font-medium hover:bg-[#D4AF37]/10 disabled:opacity-60"
                    >
                      {snapshotSaving ? "Saving…" : "Save Monthly Snapshot"}
                    </button>
                    {snapshotResult && (
                      <div className={`mt-2 text-xs ${snapshotResult.includes("saved") ? "text-green-400" : "text-red-400"}`}>
                        {snapshotResult}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
          );
        })()}
      </div>
      <div className="max-w-6xl mx-auto mt-12 space-y-6 px-0">
        <DeploymentCenterPanel userId={userId} clientId={safeClientId} trustId={safeTrustId} />
      </div>
      <BentleyRunObservabilityDebugPanel />
      </>
      )}
      </div>
      {!bentleyExecutionCampaignId ? <BentleyRevenueOsChat /> : null}
      </DashboardClientMountGate>
    </AiRevenueOsSharedStateProvider>
  );
}

export default function RevenueOSDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-cyan-400 animate-pulse">Loading…</div></div>}>
      <RevenueOSDashboardInner />
    </Suspense>
  );
}
