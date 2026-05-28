/**
 * Bentley / Revenue OS — orchestration layer calling the same shared functions as the UI (`run-*.ts` → `revenue-os-pipeline-actions.ts`).
 */

import type { ResearchResult } from "@/components/ai-revenue-os/ResearchAssistantSection";
import type { ClientReadinessAnswers } from "@/components/ai-revenue-os/ClientReadinessQuestionnaire";
import type { SocialPlatform } from "@/lib/social/config";
import { connectedSocialPlatformsSet } from "@/lib/social/platform-identity";
import {
  effectiveIntakeReadyForAutomation,
  structuredGuidedIntakeCompleteForCampaign,
  type BentleySnapshot,
} from "@/lib/revenue-os/bentley-orchestrator";
import {
  buildBaselineCampaignNotesFromIntake,
  BENTLEY_CAMPAIGN_NOTES_MIN,
} from "@/lib/revenue-os/bentley-auto-campaign-notes";
import {
  buildBentleyDashboardPayload,
  bentleySnapshotFromHandoffPayload,
  BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY,
  clearDashboardUserTouchedForIncomingBentleyHandoff,
  hasMinimumFieldsForFullAnalysis,
  payloadToDashboardFormState,
  serializeBentleyDashboardHandoff,
} from "@/lib/revenue-os/bentley-dashboard-handoff";
import { buildBentleyNotesPayload } from "@/lib/revenue-os/bentley-notes-payload";
import {
  effectiveIndustryLabelFromSnapshot,
} from "@/lib/revenue-os/bentley-section-readiness";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import { coercePlatformLabelStrings } from "@/lib/revenue-os/run-revenue-os-analysis";
import {
  ensureCampaignFromBentleyApi,
  runCampaignNotesCrawlApi,
  syncBentleyLaunchApi,
} from "@/lib/revenue-os/revenue-os-pipeline-actions";
import {
  getFirstIncompleteWorkflowPhase,
  loadWorkflowState,
  markPhaseComplete,
  saveWorkflowState,
  setWorkflowError,
  type BentleyWorkflowArtifacts,
  type BentleyWorkflowPhaseId,
  type BentleyWorkflowState,
} from "@/lib/revenue-os/bentley-workflow";
import {
  emitBentleyPipelineProgress,
  PIPELINE_STEP_BENTLEY_FOLLOWUP,
  PIPELINE_STEP_SUCCESS_LINE,
  pipelinePhaseLabel,
  type BentleyPipelineProgressDetail,
} from "@/lib/revenue-os/bentley-pipeline-progress";
import { runCampaignFromNotes } from "@/lib/revenue-os/run-campaign";
import { getBentleyCampaignPersistenceRunId } from "@/lib/revenue-os/bentley-campaign-persist-run-id";
import { runCompileMediaBrief } from "@/lib/revenue-os/run-media-brief";
import { researchResultToSnippet, runSynthesizePlan } from "@/lib/revenue-os/run-synthesize-plan";
import { runResearch as runResearchShared } from "@/lib/revenue-os/run-research";
import { runTrends as runTrendsShared } from "@/lib/revenue-os/run-trends";
import { runViralContent as runViralContentShared } from "@/lib/revenue-os/run-viral-content";
import { runMarketSweep } from "@/lib/revenue-os/run-market-sweep";
import type { MarketSweepResult } from "@/lib/revenue-os/market-sweep-schema";
import { getWorkflowBentleyHandoffForGeneration } from "@/lib/revenue-os/bentley-workflow-handoff-client";
import type { ContentEngineRequestBody } from "@/lib/revenue-os/revenue-os-pipeline-actions";
import { runRevenueOsFullAnalysis } from "@/lib/revenue-os/run-revenue-os-analysis";
import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { TrendsResponse } from "@/lib/revenue-os/trends-schema";
import type { SynthesizePlanResult } from "@/lib/revenue-os/revenue-os-pipeline-actions";
import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";
import { writeBentleySession } from "@/lib/revenue-os/bentley-storage-scope";
import { releaseRunLock, tryAcquireRunLock } from "@/lib/revenue-os/bentley-run-lock";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";
import { reconcileBentleySnapshotFromWorkflow } from "@/lib/revenue-os/bentley-pipeline-stage-sync";
import { getResolvedUserIdFromStorage } from "@/lib/revenue-os/bentley-user-session";
import {
  computeResumedFromWorkflow,
  endBentleyOrchestrationRun,
  getBentleyActiveRunId,
  recordBentleyRunBlockedByLock,
  recordBentleyRunBlockedIntake,
  startBentleyOrchestrationRun,
  syncBentleyRunFromPipelineDetail,
} from "@/lib/revenue-os/bentley-run-observability";

export type RevenueOsPipelineActionId =
  | "research_assistant"
  | "trends_library"
  | "content_engine_generate"
  | "campaign_from_notes_generate"
  | "campaign_media_brief"
  | "run_full_analysis";

export type PipelineActionStatus = "idle" | "running" | "complete" | "failed";

export type PipelineActionRecord = Partial<Record<RevenueOsPipelineActionId, PipelineActionStatus>>;

export type BentleyActionRunnerContext = {
  getSnapshot: () => BentleySnapshot;
  applyPatch: (patch: Partial<BentleySnapshot>, questionnairePatch?: Partial<ClientReadinessAnswers>) => void;
  userId: string;
  clientId?: string;
  trustId?: string;
  /** Live pipeline UI (progress strip + optional parent state). */
  onPipelineProgress?: (detail: BentleyPipelineProgressDetail) => void;
};

/** Structured outcome for each orchestrated step (and for `createBentleyActionRunner`). */
export type BentleyActionResult<T = unknown> = {
  ok: boolean;
  status: "idle" | "blocked" | "running" | "complete" | "failed";
  reason?: string;
  data?: T;
  workflow?: BentleyWorkflowState;
};

export type BentleyActionOptions = { force?: boolean };

export type BentleyFullPipelineResult = BentleyActionResult<void> & {
  /** Per-step success lines for chat (e.g. “Research complete…”). */
  milestones?: string[];
};

function persist(next: BentleyWorkflowState, ctx: BentleyActionRunnerContext): BentleyWorkflowState {
  saveWorkflowState(next);
  reconcileBentleySnapshotFromWorkflow(ctx.applyPatch, ctx.getSnapshot);
  return next;
}

function block<T>(reason: string, state: BentleyWorkflowState, ctx: BentleyActionRunnerContext): BentleyActionResult<T> {
  const s = persist(setWorkflowError(state, reason), ctx);
  return { ok: false, status: "blocked", reason, workflow: s };
}

function fail<T>(
  reason: string,
  state: BentleyWorkflowState,
  ctx: BentleyActionRunnerContext,
  failedPhase?: BentleyWorkflowPhaseId
): BentleyActionResult<T> {
  const s = persist(setWorkflowError(state, reason, failedPhase ?? null), ctx);
  return { ok: false, status: "failed", reason, workflow: s };
}

function done<T>(data: T | undefined, state: BentleyWorkflowState): BentleyActionResult<T> {
  return { ok: true, status: "complete", data, workflow: state };
}

function pushPipelineProgress(
  ctx: BentleyActionRunnerContext,
  partial: Partial<BentleyPipelineProgressDetail> & Pick<BentleyPipelineProgressDetail, "mode">
): void {
  const st = loadWorkflowState();
  const completedPhases = (Object.keys(st.completed) as BentleyWorkflowPhaseId[]).filter(
    (k) => Boolean(st.completed[k])
  );
  const detail: BentleyPipelineProgressDetail = {
    activePhase: null,
    statusLine: "",
    ...partial,
    completedPhases: partial.completedPhases ?? completedPhases,
  };
  emitBentleyPipelineProgress(detail);
  ctx.onPipelineProgress?.(detail);
  syncBentleyRunFromPipelineDetail(detail);
}

function persistHandoffSnapshot(snap: BentleySnapshot, autoRunFullAnalysis: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const payload = buildBentleyDashboardPayload(snap, { autoRunFullAnalysis });
    clearDashboardUserTouchedForIncomingBentleyHandoff();
    writeBentleySession(BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY, serializeBentleyDashboardHandoff({ payload }));
    bentleyContinuityLog("intake_saved", { source: "pipeline_persist", autoRun: autoRunFullAnalysis, businessName: payload.businessName });
  } catch {
    // ignore
  }
}

/** @deprecated Import from `@/lib/revenue-os/bentley-user-session` — re-exported for compatibility. */
export { getResolvedUserIdFromStorage };

function contentPlatformLabelForApi(snap: BentleySnapshot): string {
  const LABEL_BY_ID: Record<string, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    x: "X (Twitter)",
    linkedin: "LinkedIn",
    youtube: "YouTube",
  };
  const LABEL_TO_ID: Record<string, string> = {
    Instagram: "instagram",
    TikTok: "tiktok",
    "X (Twitter)": "x",
    LinkedIn: "linkedin",
    YouTube: "youtube",
    Twitter: "x",
  };
  const first = coercePlatformLabelStrings(snap.platforms)[0] ?? "";
  if (!first) return "Instagram";
  let id = LABEL_TO_ID[first];
  if (!id) {
    const low = first.toLowerCase();
    if (low.includes("instagram")) id = "instagram";
    else if (low.includes("tiktok")) id = "tiktok";
    else if (low.includes("linkedin")) id = "linkedin";
    else if (low.includes("youtube")) id = "youtube";
    else if (low.includes("twitter") || /^x\b/i.test(first)) id = "x";
  }
  return (id && LABEL_BY_ID[id]) || first;
}

function buildContentEngineBody(snap: BentleySnapshot): ContentEngineRequestBody {
  const industry = effectiveIndustryLabelFromSnapshot(snap);
  return {
    businessName: coerceTrimmedString(snap.businessName) || "Your business",
    industry: industry || "General",
    targetAudience: coerceTrimmedString(snap.targetAudience) || "general audience",
    coreOffer: coerceTrimmedString(snap.coreOffer),
    transformation: coerceTrimmedString(snap.transformation),
    tone: coerceTrimmedString(snap.tone) || "Professional",
    platform: contentPlatformLabelForApi(snap),
    contentType: coerceTrimmedString(snap.contentType) || "Full Post",
  };
}

function verifyResearchOutput(r: { whatPeopleWant?: unknown }): boolean {
  return Array.isArray(r.whatPeopleWant);
}

function verifyTrendsOutput(t: { items?: unknown }): boolean {
  return Array.isArray(t.items);
}

function verifyContentOutput(c: { fullPost?: { caption?: string }; hooks?: unknown }): boolean {
  return Boolean(
    coerceTrimmedString(c?.fullPost?.caption) || (Array.isArray(c.hooks) && c.hooks.length > 0)
  );
}

function platformsForMarketSweep(snap: BentleySnapshot): string[] {
  const p = snap.platforms ?? [];
  if (p.length) return p;
  return ["TikTok", "YouTube", "Reddit"];
}

function verifyMarketSweepOutput(m: MarketSweepResult): boolean {
  const n =
    (m.trendingTopics?.length ?? 0) +
    (m.viralHooks?.length ?? 0) +
    (m.painPoints?.length ?? 0) +
    (m.commentInsights?.length ?? 0);
  return n >= 2;
}

// ——— Standalone actions (same shared calls as UI) ———

export async function runResearchAction(
  ctx: BentleyActionRunnerContext,
  opts?: BentleyActionOptions
): Promise<BentleyActionResult<ResearchResult>> {
  let state = loadWorkflowState();
  if (!opts?.force && state.completed.research && state.artifacts.research) {
    return done(state.artifacts.research, state);
  }
  if (!effectiveIntakeReadyForAutomation(ctx.getSnapshot())) {
    return block("Intake incomplete — industry and audience are required.", state, ctx);
  }
  state = { ...state, lastError: null };
  persist(state, ctx);
  try {
    const snap = ctx.getSnapshot();
    const market = effectiveIndustryLabelFromSnapshot(snap).trim();
    if (market.length < 2) return block("Industry is too short for research.", loadWorkflowState(), ctx);
    const research = await runResearchShared({
      marketOrService: market,
      clientId: ctx.clientId,
      trustId: ctx.trustId,
    });
    if (!verifyResearchOutput(research)) {
      return fail("Research returned no usable data.", loadWorkflowState(), ctx, "research");
    }
    state = loadWorkflowState();
    state = markPhaseComplete(state, "research", { research });
    return done(research, persist(state, ctx));
  } catch (e) {
    state = loadWorkflowState();
    return fail(e instanceof Error ? e.message : "Research failed", state, ctx, "research");
  }
}

export async function runTrendsAction(
  ctx: BentleyActionRunnerContext,
  opts?: BentleyActionOptions
): Promise<BentleyActionResult<{ trends: TrendsResponse; synthesis: SynthesizePlanResult }>> {
  let state = loadWorkflowState();
  if (!opts?.force && state.completed.trends && state.artifacts.trends && state.artifacts.synthesis) {
    return done(
      { trends: state.artifacts.trends, synthesis: state.artifacts.synthesis },
      state
    );
  }
  if (!state.completed.research && !state.artifacts.research) {
    return block("Run research first (or resume from a saved workflow with research).", state, ctx);
  }
  const snap = ctx.getSnapshot();
  const industry = effectiveIndustryLabelFromSnapshot(snap).trim();
  if (industry.length < 2) return block("Industry is required for trends.", state, ctx);

  state = { ...state, lastError: null };
  persist(state, ctx);
  try {
    const bentley = getWorkflowBentleyHandoffForGeneration();
    const trends = await runTrendsShared({
      industry,
      targetAudience: coerceTrimmedString(snap.targetAudience) || "general audience",
      clientId: ctx.clientId,
      trustId: ctx.trustId,
      ...bentley,
    });
    if (!verifyTrendsOutput(trends)) {
      return fail("Trends returned no items.", loadWorkflowState(), ctx, "trends");
    }
    state = loadWorkflowState();
    const research = state.artifacts.research;
    const snippet = research ? researchResultToSnippet(research) : null;
    const synthesis = await runSynthesizePlan({ trends, research: snippet, ...bentley });
    state = markPhaseComplete(state, "trends", { trends, synthesis });
    const next = persist(state, ctx);
    return done({ trends, synthesis }, next);
  } catch (e) {
    state = loadWorkflowState();
    return fail(e instanceof Error ? e.message : "Trends or synthesis failed", state, ctx, "trends");
  }
}

export async function runMarketSweepAction(
  ctx: BentleyActionRunnerContext,
  opts?: BentleyActionOptions
): Promise<BentleyActionResult<MarketSweepResult>> {
  let state = loadWorkflowState();
  if (!opts?.force && state.completed.market_sweep && state.artifacts.marketSweep) {
    return done(state.artifacts.marketSweep, state);
  }
  if (!state.completed.trends || !state.artifacts.synthesis) {
    return block("Complete trends (and synthesis) before market intelligence sweep.", state, ctx);
  }
  const snap = ctx.getSnapshot();
  const industry = effectiveIndustryLabelFromSnapshot(snap).trim();
  if (industry.length < 2) return block("Industry is required for market sweep.", state, ctx);

  state = { ...state, lastError: null };
  persist(state, ctx);
  try {
    const result = await runMarketSweep({
      industry,
      targetAudience: coerceTrimmedString(snap.targetAudience) || "general audience",
      platforms: platformsForMarketSweep(snap),
      clientId: ctx.clientId,
      trustId: ctx.trustId,
    });
    if (!verifyMarketSweepOutput(result)) {
      return fail("Market sweep returned no usable signals.", loadWorkflowState(), ctx, "market_sweep");
    }
    state = loadWorkflowState();
    state = markPhaseComplete(state, "market_sweep", { marketSweep: result });
    return done(result, persist(state, ctx));
  } catch (e) {
    state = loadWorkflowState();
    return fail(e instanceof Error ? e.message : "Market sweep failed", state, ctx, "market_sweep");
  }
}

export async function runViralContentAction(
  ctx: BentleyActionRunnerContext,
  opts?: BentleyActionOptions
): Promise<BentleyActionResult<ContentEngineOutput>> {
  let state = loadWorkflowState();
  if (!opts?.force && state.completed.content && state.artifacts.contentEngine) {
    return done(state.artifacts.contentEngine, state);
  }
  if (!state.completed.trends || !state.artifacts.trends || !state.artifacts.synthesis) {
    return block("Complete trends (and synthesis) before viral content.", state, ctx);
  }
  if (!state.completed.market_sweep || !state.artifacts.marketSweep) {
    return block("Complete market intelligence sweep before viral content.", state, ctx);
  }
  const snap = ctx.getSnapshot();
  const body = buildContentEngineBody(snap);
  if (!body.coreOffer.trim()) {
    return block("Core offer is required for Content Engine.", state, ctx);
  }

  state = { ...state, lastError: null };
  persist(state, ctx);
  try {
    const ms = state.artifacts.marketSweep;
    const ep = ms?.experimentPlan;
    const v0 = ep?.variants?.[0];
    const v0id = v0?.variantKey && ep?.variantIdsByKey?.[v0.variantKey];
    const { content: contentEngine } = await runViralContentShared({
      ...body,
      ...getWorkflowBentleyHandoffForGeneration(),
      ...(ms?.contentGenerationMode && { contentGenerationMode: ms.contentGenerationMode }),
      ...(ms?.growthGuidance && { marketSweepGrowthGuidance: ms.growthGuidance }),
      ...(ms?.intelligenceDiff && { marketIntelligenceDiff: ms.intelligenceDiff }),
      ...(ep?.experimentId &&
        v0 &&
        v0id && {
          experimentId: ep.experimentId,
          experimentVariantId: v0id,
          hookType: v0.hookType,
          angle: v0.angle,
          ctaType: v0.ctaType,
          experimentTheme: ep.experimentTheme,
        }),
    });
    if (!verifyContentOutput(contentEngine)) {
      return fail("Content Engine returned empty output.", loadWorkflowState(), ctx, "content");
    }
    state = loadWorkflowState();
    const notesWereAssembledWithoutViral =
      Boolean(state.completed.campaign_notes) && !state.artifacts.contentEngine;
    state = markPhaseComplete(state, "content", { contentEngine });
    // If Paste Notes were filled before Content Engine ran, re-assemble so viral hooks/caption merge in.
    if (notesWereAssembledWithoutViral) {
      state = {
        ...state,
        completed: { ...state.completed, campaign_notes: false },
      };
    }
    return done(contentEngine, persist(state, ctx));
  } catch (e) {
    state = loadWorkflowState();
    return fail(e instanceof Error ? e.message : "Content engine failed", state, ctx, "content");
  }
}

/** Merge intake + workflow artifacts (+ optional crawl) into shared `campaignNotes` for Paste Notes → Generate Campaign. */
export async function runAssembleCampaignNotesAction(
  ctx: BentleyActionRunnerContext,
  opts?: BentleyActionOptions
): Promise<BentleyActionResult<void>> {
  let state = loadWorkflowState();
  if (!opts?.force && state.completed.campaign_notes) {
    return done(undefined, state);
  }
  const snapEarly = ctx.getSnapshot();
  /** Notes merge intake, research, trends, market sweep, synthesis; viral content optional. */
  if (!state.completed.trends || !state.artifacts.synthesis) {
    if (structuredGuidedIntakeCompleteForCampaign(snapEarly)) {
      const baseline = buildBaselineCampaignNotesFromIntake(snapEarly);
      ctx.applyPatch({ campaignNotes: baseline });
      state = loadWorkflowState();
      state = markPhaseComplete(state, "campaign_notes", {});
      return done(undefined, persist(state, ctx));
    }
    return block(
      "Run **research**, then **trends** (with synthesis) before assembling campaign notes — Bentley needs that pipeline output to fill Paste Notes.",
      state,
      ctx
    );
  }
  if (!state.completed.market_sweep || !state.artifacts.marketSweep) {
    const sweepR = await runMarketSweepAction(ctx, opts);
    if (!sweepR.ok) {
      const w = sweepR.workflow ?? loadWorkflowState();
      return {
        ok: false,
        status: sweepR.status,
        reason: sweepR.reason,
        workflow: w,
      };
    }
    state = sweepR.workflow ?? loadWorkflowState();
  }
  const snap = ctx.getSnapshot();
  let crawlPrefix = "";
  try {
    const industry = effectiveIndustryLabelFromSnapshot(snap).trim();
    if (industry.length >= 2) {
      const crawl = await runCampaignNotesCrawlApi({
        industry,
        targetAudience: coerceTrimmedString(snap.targetAudience) || "general audience",
      });
      crawlPrefix = `${coerceTrimmedString(crawl.notesBlock)}\n\n`;
    }
  } catch {
    // optional — pipeline still works from research/trends/content alone
  }
  let notes = (crawlPrefix + buildBentleyNotesPayload({ snapshot: snap, ...state.artifacts })).trim();
  if (notes.trim().length < BENTLEY_CAMPAIGN_NOTES_MIN) {
    if (structuredGuidedIntakeCompleteForCampaign(snap)) {
      notes = buildBaselineCampaignNotesFromIntake(snap);
    } else {
      return block("Assembled notes are too short for campaign generation.", state, ctx);
    }
  }
  ctx.applyPatch({ campaignNotes: notes });
  state = loadWorkflowState();
  state = markPhaseComplete(state, "campaign_notes", {});
  return done(undefined, persist(state, ctx));
}

export async function runCampaignAction(
  ctx: BentleyActionRunnerContext,
  opts?: BentleyActionOptions
): Promise<BentleyActionResult<CampaignResponse>> {
  let state = loadWorkflowState();
  if (!opts?.force && state.completed.campaign_generation && state.artifacts.campaign) {
    const cid = coerceTrimmedString(state.artifacts.bentleyDbCampaignId);
    if (cid && !coerceTrimmedString(state.artifacts.bentleyLaunchSyncedAt)) {
      try {
        await syncBentleyLaunchApi({
          campaignId: cid,
          scheduleStrategy: "staggered",
          staggerMinutes: 30,
        });
        state = loadWorkflowState();
        state = {
          ...state,
          artifacts: { ...state.artifacts, bentleyLaunchSyncedAt: new Date().toISOString() },
        };
        saveWorkflowState(state);
        reconcileBentleySnapshotFromWorkflow(ctx.applyPatch, ctx.getSnapshot);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        bentleyContinuityLog("campaign_posts_create_failed", { campaignId: cid, error: msg, resume: true });
        console.warn("[Bentley] resume sync-launch failed:", msg);
      }
    }
    return done(state.artifacts.campaign!, loadWorkflowState());
  }
  if (!state.completed.campaign_notes) {
    const assembled = await runAssembleCampaignNotesAction(ctx, opts);
    if (!assembled.ok) {
      const w = assembled.workflow ?? loadWorkflowState();
      return {
        ok: false,
        status: assembled.status,
        reason: assembled.reason,
        workflow: w,
      };
    }
    state = assembled.workflow ?? loadWorkflowState();
  }
  const snap = ctx.getSnapshot();
  let notes = coerceTrimmedString(snap.campaignNotes);
  if (notes.length < BENTLEY_CAMPAIGN_NOTES_MIN) {
    if (structuredGuidedIntakeCompleteForCampaign(snap)) {
      notes = buildBaselineCampaignNotesFromIntake(snap);
      ctx.applyPatch({ campaignNotes: notes });
    } else {
      return block("Campaign notes are too short.", loadWorkflowState(), ctx);
    }
  }
  const industry = effectiveIndustryLabelFromSnapshot(snap).trim();
  if (industry.length < 2) return block("Industry is required for campaign generation.", loadWorkflowState(), ctx);

  state = { ...state, lastError: null };
  persist(state, ctx);
  try {
    const campaign = await runCampaignFromNotes({
      industry,
      targetAudience: coerceTrimmedString(snap.targetAudience) || "general audience",
      notes,
      ...getWorkflowBentleyHandoffForGeneration(),
    });
    const hasContent =
      Boolean(coerceTrimmedString(campaign.offerStatement)) ||
      (campaign.messagePillars?.length ?? 0) > 0 ||
      (campaign.shortFormHooks?.length ?? 0) > 0;
    if (!hasContent) {
      return fail("Campaign generation returned no usable content.", loadWorkflowState(), ctx, "campaign_generation");
    }

    let bentleyDbCampaignId: string | undefined;
    let bentleyLaunchSyncedAt: string | undefined;
    let campaignPersistenceError: string | undefined;
    try {
      const runId = getBentleyCampaignPersistenceRunId();
      const ensured = await ensureCampaignFromBentleyApi({
        bentleyRunId: runId,
        clientId: coerceTrimmedString(ctx.clientId) ?? "",
        businessName: snap.businessName,
        platforms: snap.platforms ?? [],
        postingPlatforms: (snap.postingPlatforms ?? []).map((p) => String(p)),
        tone: snap.tone,
        imageStyle: snap.imageStyle,
        campaign,
      });
      bentleyDbCampaignId = ensured.id;
      bentleyContinuityLog("campaign_persisted_db", {
        campaignId: ensured.id,
        created: ensured.created,
        bentleyRunId: runId,
      });

      try {
        const sync = await syncBentleyLaunchApi({
          campaignId: ensured.id,
          scheduleStrategy: "staggered",
          staggerMinutes: 30,
        });
        bentleyLaunchSyncedAt = new Date().toISOString();
        bentleyContinuityLog("campaign_posts_created", {
          campaignId: ensured.id,
          created: sync.created,
          skipped: sync.skipped,
        });
        bentleyContinuityLog("campaign_posts_scheduled", {
          campaignId: ensured.id,
          rescheduled: sync.rescheduled,
          postCount: sync.postIds.length,
          requireApproval: sync.requireApproval,
        });
      } catch (syncErr) {
        const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
        bentleyContinuityLog("campaign_posts_create_failed", { campaignId: ensured.id, error: msg });
        bentleyContinuityLog("campaign_posts_schedule_failed", { campaignId: ensured.id, error: msg });
        console.warn("[Bentley] sync-launch failed after DB campaign:", msg);
      }
    } catch (e) {
      campaignPersistenceError = e instanceof Error ? e.message : String(e);
      bentleyContinuityLog("campaign_persist_db_failed", {
        error: campaignPersistenceError,
      });
    }

    state = loadWorkflowState();
    const genArtifacts: Partial<BentleyWorkflowArtifacts> = {
      campaign,
      ...(bentleyDbCampaignId
        ? { bentleyDbCampaignId, campaignPersistenceError: null }
        : campaignPersistenceError
          ? { campaignPersistenceError }
          : {}),
      ...(bentleyLaunchSyncedAt ? { bentleyLaunchSyncedAt } : {}),
    };
    state = markPhaseComplete(state, "campaign_generation", genArtifacts);
    return done(campaign, persist(state, ctx));
  } catch (e) {
    state = loadWorkflowState();
    return fail(e instanceof Error ? e.message : "Campaign generation failed", state, ctx, "campaign_generation");
  }
}

export async function runMediaBriefAction(
  ctx: BentleyActionRunnerContext,
  opts?: BentleyActionOptions
): Promise<BentleyActionResult<string>> {
  let state = loadWorkflowState();
  if (!opts?.force && state.completed.media_brief && state.artifacts.mediaBriefText) {
    return done(state.artifacts.mediaBriefText, state);
  }
  const campaign = state.artifacts.campaign;
  if (!state.completed.campaign_generation || !campaign) {
    return block("Generate campaign before media brief.", state, ctx);
  }
  const snap = ctx.getSnapshot();
  const industry = effectiveIndustryLabelFromSnapshot(snap).trim() || campaign.industry || "";
  const angles =
    state.artifacts.synthesis?.campaignAngles?.length
      ? state.artifacts.synthesis.campaignAngles
      : state.artifacts.trends?.campaignAngles;

  state = { ...state, lastError: null };
  persist(state, ctx);
  try {
    const mediaBriefText = await runCompileMediaBrief({
      industry,
      targetAudience: coerceTrimmedString(snap.targetAudience) || campaign.targetAudience || "general audience",
      offerStatement: campaign.offerStatement,
      messagePillars: campaign.messagePillars,
      shortFormHooks: campaign.shortFormHooks,
      campaignAngles: angles?.length ? angles : undefined,
      objectionReplies: campaign.objectionReplies,
      longFormOutlines: campaign.longFormOutlines,
      notes: coerceTrimmedString(snap.campaignNotes).slice(0, 1000),
    });
    if (!mediaBriefText.trim()) {
      return fail("Media brief was empty.", loadWorkflowState(), ctx, "media_brief");
    }
    state = loadWorkflowState();
    state = markPhaseComplete(state, "media_brief", { mediaBriefText });
    return done(mediaBriefText, persist(state, ctx));
  } catch (e) {
    state = loadWorkflowState();
    return fail(e instanceof Error ? e.message : "Media brief failed", state, ctx, "media_brief");
  }
}

export async function runFullAnalysisAction(
  ctx: BentleyActionRunnerContext,
  opts?: BentleyActionOptions
): Promise<BentleyActionResult<RevenueOsAnalyzeResponse | undefined>> {
  let state = loadWorkflowState();
  if (!opts?.force && state.completed.analysis && state.artifacts.analysisComplete) {
    return { ok: true, status: "complete", data: undefined, workflow: state };
  }
  if (!state.completed.media_brief) {
    return block("Compile media brief before full analysis.", state, ctx);
  }

  const snap = ctx.getSnapshot();
  const notes = buildBentleyNotesPayload({ snapshot: snap, ...state.artifacts });
  const campaignNotes =
    notes.trim().length >= BENTLEY_CAMPAIGN_NOTES_MIN
      ? notes
      : coerceTrimmedString(snap.campaignNotes).length >= BENTLEY_CAMPAIGN_NOTES_MIN
        ? snap.campaignNotes
        : structuredGuidedIntakeCompleteForCampaign(snap)
          ? buildBaselineCampaignNotesFromIntake(snap)
          : snap.campaignNotes;
  const merged: BentleySnapshot = {
    ...snap,
    campaignNotes,
  };
  const payload = buildBentleyDashboardPayload(merged, { autoRunFullAnalysis: false });
  const check = hasMinimumFieldsForFullAnalysis(payload);
  if (!check.ok) {
    return block(`Full analysis needs valid numbers: ${check.missing.slice(0, 4).join("; ")}`, state, ctx);
  }
  const form = payloadToDashboardFormState(payload);
  persistHandoffSnapshot(merged, false);

  state = { ...state, lastError: null };
  persist(state, ctx);
  try {
    const result = await runRevenueOsFullAnalysis(ctx.userId, form);
    if (!result.ok) {
      return fail(result.message, loadWorkflowState(), ctx, "analysis");
    }
    state = loadWorkflowState();
    state = markPhaseComplete(state, "analysis", { analysisComplete: true });
    return done(result.data, persist(state, ctx));
  } catch (e) {
    state = loadWorkflowState();
    return fail(e instanceof Error ? e.message : "Full analysis failed", state, ctx, "analysis");
  }
}

export async function runFullPipelineAction(
  ctx: BentleyActionRunnerContext,
  opts?: BentleyActionOptions
): Promise<BentleyFullPipelineResult> {
  let state = loadWorkflowState();
  if (!effectiveIntakeReadyForAutomation(ctx.getSnapshot())) {
    recordBentleyRunBlockedIntake({ userId: ctx.userId, clientId: ctx.clientId });
    const b = block<void>("Intake incomplete — finish Bentley’s questions first.", state, ctx);
    return { ...b, milestones: [] };
  }

  if (!tryAcquireRunLock()) {
    recordBentleyRunBlockedByLock({ userId: ctx.userId, clientId: ctx.clientId });
    return {
      ok: false,
      status: "blocked",
      reason: "Pipeline already running — wait for it to finish or open Bentley to watch progress.",
      milestones: [],
    };
  }

  const wfBeforeRun = loadWorkflowState();
  startBentleyOrchestrationRun({
    userId: ctx.userId,
    clientId: ctx.clientId,
    resumedFromWorkflow: computeResumedFromWorkflow(wfBeforeRun),
  });

  try {
    if (!state.completed.intake) {
      state = markPhaseComplete(state, "intake", {});
      persist(state, ctx);
    }

    const steps: Array<{
      phase: BentleyWorkflowPhaseId;
      run: () => Promise<BentleyActionResult<unknown>>;
    }> = [
    { phase: "research", run: () => runResearchAction(ctx, opts) },
    { phase: "trends", run: () => runTrendsAction(ctx, opts) },
    { phase: "market_sweep", run: () => runMarketSweepAction(ctx, opts) },
    { phase: "content", run: () => runViralContentAction(ctx, opts) },
    { phase: "campaign_notes", run: () => runAssembleCampaignNotesAction(ctx, opts) },
    { phase: "campaign_generation", run: () => runCampaignAction(ctx, opts) },
    { phase: "media_brief", run: () => runMediaBriefAction(ctx, opts) },
    { phase: "analysis", run: () => runFullAnalysisAction(ctx, opts) },
  ];

  const milestones: string[] = [];
  const st0 = loadWorkflowState();
  const firstIncomplete = getFirstIncompleteWorkflowPhase(st0);
  const resumeHint =
    st0.lastFailedPhase && firstIncomplete
      ? `Resuming from **${pipelinePhaseLabel(firstIncomplete)}** (last failure: ${pipelinePhaseLabel(st0.lastFailedPhase)}). Completed steps are skipped.`
      : firstIncomplete && firstIncomplete !== "intake"
        ? `Continuing from **${pipelinePhaseLabel(firstIncomplete)}** — completed steps stay skipped.`
        : undefined;

  pushPipelineProgress(ctx, {
    mode: "running",
    activePhase: firstIncomplete ?? "research",
    statusLine: resumeHint ?? "Starting Revenue OS pipeline…",
    resumeHint,
  });

  for (const { phase, run } of steps) {
    const st = loadWorkflowState();
    if (!opts?.force && st.completed[phase]) {
      const line = PIPELINE_STEP_SUCCESS_LINE[phase];
      const follow = PIPELINE_STEP_BENTLEY_FOLLOWUP[phase];
      if (line) milestones.push(follow ? `${line}\n\n${follow}` : line);
      pushPipelineProgress(ctx, {
        mode: "running",
        activePhase: phase,
        statusLine: `${pipelinePhaseLabel(phase)} already done — skipped.`,
        resumeHint,
      });
      continue;
    }

    pushPipelineProgress(ctx, {
      mode: "running",
      activePhase: phase,
      statusLine: `Running ${pipelinePhaseLabel(phase)}…`,
      resumeHint,
    });

    const r = await run();
    if (!r.ok) {
      pushPipelineProgress(ctx, {
        mode: "failed",
        activePhase: phase,
        failedPhase: phase,
        errorMessage: r.reason,
        statusLine: r.reason ?? "Failed",
        resumeHint: `Fix the issue, then tap **Resume pipeline** — Bentley will retry from **${pipelinePhaseLabel(phase)}**.`,
      });
      endBentleyOrchestrationRun({
        wf: loadWorkflowState(),
        snapshot: ctx.getSnapshot(),
        outcome: "failed",
        failedPhase: phase,
        lastError: r.reason,
      });
      const pipelineFailed: BentleyFullPipelineResult = {
        ok: r.ok,
        status: r.status,
        reason: r.reason,
        workflow: r.workflow,
        milestones,
      };
      return pipelineFailed;
    }

    const line = PIPELINE_STEP_SUCCESS_LINE[phase];
    const follow = PIPELINE_STEP_BENTLEY_FOLLOWUP[phase];
    if (line) milestones.push(follow ? `${line}\n\n${follow}` : line);

    const st2 = loadWorkflowState();
    const completedPhases = (Object.keys(st2.completed) as BentleyWorkflowPhaseId[]).filter(
      (k) => st2.completed[k]
    );
    pushPipelineProgress(ctx, {
      mode: "running",
      activePhase: phase,
      completedPhases,
      statusLine: line ?? `${pipelinePhaseLabel(phase)} complete.`,
      resumeHint,
    });
  }

  const finalState = loadWorkflowState();
  pushPipelineProgress(ctx, {
    mode: "complete",
    activePhase: null,
    completedPhases: (Object.keys(finalState.completed) as BentleyWorkflowPhaseId[]).filter(
      (k) => finalState.completed[k]
    ),
    statusLine: "Pipeline complete — open the dashboard when ready.",
  });

  endBentleyOrchestrationRun({
    wf: finalState,
    snapshot: ctx.getSnapshot(),
    outcome: "complete",
  });

  return { ok: true, status: "complete", data: undefined, workflow: finalState, milestones };
  } finally {
    try {
      reconcileBentleySnapshotFromWorkflow(ctx.applyPatch, ctx.getSnapshot);
    } catch {
      /* ignore */
    }
    releaseRunLock();
    if (getBentleyActiveRunId()) {
      endBentleyOrchestrationRun({
        wf: loadWorkflowState(),
        snapshot: ctx.getSnapshot(),
        outcome: "aborted",
        lastError: "Pipeline ended without completion record (exception or early exit)",
      });
    }
  }
}

/**
 * Completes `launch_ready`: idempotent sync-launch (posts + schedule / approval UTM), then marks phase complete.
 */
export async function runBentleyLaunchFinalizeAction(
  ctx: BentleyActionRunnerContext
): Promise<BentleyActionResult<void>> {
  let state = loadWorkflowState();
  const cid = coerceTrimmedString(state.artifacts.bentleyDbCampaignId);
  if (!cid) {
    return block(
      "No Bentley DB campaign — finish campaign generation (with persistence) first.",
      state,
      ctx
    );
  }
  try {
    const sync = await syncBentleyLaunchApi({
      campaignId: cid,
      scheduleStrategy: "staggered",
      staggerMinutes: 30,
    });
    if (!sync.postIds.length) {
      bentleyContinuityLog("launch_finalize_blocked_empty_posts", {
        campaignId: cid,
        created: sync.created,
        skipped: sync.skipped,
        rescheduled: sync.rescheduled,
      });
      return fail(
        "Launch sync returned no campaign posts — cannot complete launch_ready.",
        loadWorkflowState(),
        ctx,
        "launch_ready"
      );
    }
    const syncedAt = new Date().toISOString();
    bentleyContinuityLog("campaign_posts_created", {
      campaignId: cid,
      created: sync.created,
      skipped: sync.skipped,
      finalize: true,
    });
    bentleyContinuityLog("campaign_posts_scheduled", {
      campaignId: cid,
      rescheduled: sync.rescheduled,
      postCount: sync.postIds.length,
      requireApproval: sync.requireApproval,
    });
    state = loadWorkflowState();
    state = markPhaseComplete(state, "launch_ready", { bentleyLaunchSyncedAt: syncedAt });
    bentleyContinuityLog("launch_ready_completed", { campaignId: cid });
    return done(undefined, persist(state, ctx));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    bentleyContinuityLog("campaign_posts_create_failed", { campaignId: cid, error: msg, finalize: true });
    bentleyContinuityLog("campaign_posts_schedule_failed", { error: msg });
    console.warn("[Bentley] launch_ready finalize failed:", msg);
    return fail(msg, loadWorkflowState(), ctx, "launch_ready");
  }
}

export async function advanceToNextIncompleteStepAction(
  ctx: BentleyActionRunnerContext,
  opts?: BentleyActionOptions
): Promise<BentleyActionResult<unknown>> {
  const state = loadWorkflowState();
  const next = getFirstIncompleteWorkflowPhase(state);
  if (!next) return { ok: true, status: "complete", workflow: state };

  switch (next) {
    case "intake":
      if (!effectiveIntakeReadyForAutomation(ctx.getSnapshot())) {
        return block("Intake incomplete.", state, ctx);
      }
      return done(undefined, persist(markPhaseComplete(state, "intake", {}), ctx));
    case "research":
      return runResearchAction(ctx, opts);
    case "trends":
      return runTrendsAction(ctx, opts);
    case "market_sweep":
      return runMarketSweepAction(ctx, opts);
    case "content":
      return runViralContentAction(ctx, opts);
    case "campaign_notes":
      return runAssembleCampaignNotesAction(ctx, opts);
    case "campaign_generation":
      return runCampaignAction(ctx, opts);
    case "media_brief":
      return runMediaBriefAction(ctx, opts);
    case "analysis":
      return runFullAnalysisAction(ctx, opts);
    case "dashboard":
      return done(undefined, persist(markPhaseComplete(state, "dashboard", {}), ctx));
    case "launch_ready":
      return runBentleyLaunchFinalizeAction(ctx);
    default:
      return done(undefined, state);
  }
}

export function createBentleyActionRunner(ctx: BentleyActionRunnerContext) {
  return {
    runResearch: (opts?: BentleyActionOptions) => runResearchAction(ctx, opts),
    runTrends: (opts?: BentleyActionOptions) => runTrendsAction(ctx, opts),
    runMarketSweep: (opts?: BentleyActionOptions) => runMarketSweepAction(ctx, opts),
    runViralContent: (opts?: BentleyActionOptions) => runViralContentAction(ctx, opts),
    assembleCampaignNotes: (opts?: BentleyActionOptions) => runAssembleCampaignNotesAction(ctx, opts),
    runCampaign: (opts?: BentleyActionOptions) => runCampaignAction(ctx, opts),
    runMediaBrief: (opts?: BentleyActionOptions) => runMediaBriefAction(ctx, opts),
    runFullAnalysis: (opts?: BentleyActionOptions) => runFullAnalysisAction(ctx, opts),
    runFullPipeline: (opts?: BentleyActionOptions) => runFullPipelineAction(ctx, opts),
    runFullLifecycle: async (opts?: import("@/lib/revenue-os/bentley-full-lifecycle-orchestrator").BentleyFullLifecycleOptions) => {
      const { runBentleyFullLifecycleAction } = await import("@/lib/revenue-os/bentley-full-lifecycle-orchestrator");
      return runBentleyFullLifecycleAction(ctx, opts);
    },
    advanceToNextIncompleteStep: (opts?: BentleyActionOptions) =>
      advanceToNextIncompleteStepAction(ctx, opts),
    finalizeBentleyLaunch: () => runBentleyLaunchFinalizeAction(ctx),
  };
}

export type BentleyLaunchReadiness = {
  ready: boolean;
  missingOAuthFor: SocialPlatform[];
  message: string;
};

export async function fetchBentleyLaunchReadiness(
  postingPlatforms: SocialPlatform[],
  clientId: string | undefined
): Promise<BentleyLaunchReadiness> {
  const uniq = [...new Set(postingPlatforms)];
  if (!uniq.length) {
    return {
      ready: false,
      missingOAuthFor: [],
      message: "Choose posting platforms in guided intake before launch.",
    };
  }
  if (!coerceTrimmedString(clientId)) {
    return {
      ready: false,
      missingOAuthFor: uniq,
      message: "Open Workspace integrations and connect OAuth for each selected platform.",
    };
  }
  try {
    const r = await fetch(
      `/api/social/accounts?clientId=${encodeURIComponent(coerceTrimmedString(clientId))}`
    );
    const data = (await r.json()) as {
      accounts?: Array<{ platform?: string; platformCanonical?: SocialPlatform | null }>;
    };
    if (!r.ok) {
      return {
        ready: false,
        missingOAuthFor: uniq,
        message: "Could not load connected accounts. Try again after signing in.",
      };
    }
    const accountRows = (data.accounts ?? []).map((a) => ({
      platform: typeof a.platform === "string" ? a.platform : "",
      platformCanonical: a.platformCanonical,
    }));
    const connected = connectedSocialPlatformsSet(accountRows);
    const missingOAuthFor = uniq.filter((p) => !connected.has(p));
    return {
      ready: missingOAuthFor.length === 0,
      missingOAuthFor,
      message:
        missingOAuthFor.length === 0
          ? "Accounts are connected. Review your content bundle, then click Launch when ready."
          : `Connect OAuth for: ${missingOAuthFor.join(", ")}. Then return to Launch — nothing auto-publishes.`,
    };
  } catch {
    return {
      ready: false,
      missingOAuthFor: uniq,
      message: "Network error checking social accounts.",
    };
  }
}

/** Server/automation helpers: direct vs manual publish given adapters + connections. */
export {
  resolveSocialStudioPublishMode,
  recommendBentleySocialStudioPromote,
} from "@/lib/revenue-os/bentley-social-studio-hints";
