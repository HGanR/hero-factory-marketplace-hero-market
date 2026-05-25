"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Sparkles,
  Lightbulb,
  FileText,
  AlertTriangle,
  MessageSquare,
  Target,
  Copy,
  Check,
  Globe,
} from "lucide-react";
import {
  useAiRevenueOsBentleyActions,
  useAiRevenueOsContentCampaign,
  useAiRevenueOsProfile,
  useAiRevenueOsSnapshotSignature,
} from "./AiRevenueOsSharedState";
import { structuredGuidedIntakeCompleteForCampaign } from "@/lib/revenue-os/bentley-orchestrator";
import { buildBaselineCampaignNotesFromIntake } from "@/lib/revenue-os/bentley-auto-campaign-notes";
import type {
  CampaignResponse,
  LongFormOutline,
} from "@/lib/revenue-os/campaign-schema";
import { buildNotesFromContext, type NotesEngineContext } from "@/lib/revenue-os/notes-engine";
import { runCampaignFromNotes } from "@/lib/revenue-os/run-campaign";
import { runCompileMediaBrief as runCompileMediaBriefApi } from "@/lib/revenue-os/run-media-brief";
import { runCampaignNotesCrawlApi } from "@/lib/revenue-os/revenue-os-pipeline-actions";
import { loadWorkflowState, subscribeBentleyWorkflowCrossTab } from "@/lib/revenue-os/bentley-workflow";
import {
  clearWorkflowBentleyHandoff,
  getWorkflowBentleyHandoffForGeneration,
} from "@/lib/revenue-os/bentley-workflow-handoff-client";
import {
  CampaignIntelligenceNotesPanel,
  isBentleyPipelineNotesBlob,
} from "@/components/ai-revenue-os/CampaignIntelligenceNotesPanel";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

const ACCENT = "#00D1FF";
const NOTES_MIN_LENGTH = 10;

export interface CampaignFromNotesSectionProps {
  defaultIndustry?: string;
  defaultTargetAudience?: string;
  compact?: boolean;
  /** Pre-filled notes from trends/research synthesis. */
  initialNotes?: string;
  /** Campaign angles from trends for solution roadmap. */
  campaignAngles?: string[];
  /** When set, shows compiled media brief for pasting into external platforms. */
  enableMediaGeneration?: boolean;
  /** Dashboard context for notes engine — auto-populates Notes when provided. */
  contextForNotes?: NotesEngineContext;
  /**
   * On `/revenue-os/dashboard`, bind notes to dashboard form state (single source of truth).
   * When set, shared `campaignNotes` is not used for the textarea.
   */
  canonicalNotes?: {
    value: string;
    onChange: (value: string) => void;
  };
  /**
   * When set with dashboard, industry / target audience read/write `form.businessType` and `form.targetAudience`
   * (avoids drift vs Content Engine + Trends + Bentley mirror).
   */
  canonicalIndustryAudience?: {
    industry: string;
    onIndustryChange: (v: string) => void;
    targetAudience: string;
    onTargetAudienceChange: (v: string) => void;
  };
}

export function CampaignFromNotesSection({
  defaultIndustry = "",
  defaultTargetAudience = "",
  compact = false,
  initialNotes = "",
  campaignAngles = [],
  enableMediaGeneration = false,
  contextForNotes,
  canonicalNotes,
  canonicalIndustryAudience,
}: CampaignFromNotesSectionProps) {
  const profile = useAiRevenueOsProfile();
  const content = useAiRevenueOsContentCampaign();
  const bentleyActions = useAiRevenueOsBentleyActions();
  const shared = {
    isProviderActive: profile.isProviderActive,
    effectiveIndustryLabel: profile.effectiveIndustryLabel,
    setContentIndustry: profile.setContentIndustry,
    targetAudience: profile.targetAudience,
    setTargetAudience: profile.setTargetAudience,
    campaignNotes: content.campaignNotes,
    setCampaignNotes: content.setCampaignNotes,
  };
  const [localIndustry, setLocalIndustry] = useState(defaultIndustry);
  const [localAudience, setLocalAudience] = useState(defaultTargetAudience);
  const [localNotes, setLocalNotes] = useState(initialNotes);

  const useSharedProfile = shared.isProviderActive && !canonicalIndustryAudience;

  const industry = canonicalIndustryAudience
    ? canonicalIndustryAudience.industry
    : useSharedProfile
      ? shared.effectiveIndustryLabel
      : localIndustry;
  const setIndustry = canonicalIndustryAudience
    ? canonicalIndustryAudience.onIndustryChange
    : useSharedProfile
      ? shared.setContentIndustry
      : setLocalIndustry;
  const targetAudience = canonicalIndustryAudience
    ? canonicalIndustryAudience.targetAudience
    : useSharedProfile
      ? shared.targetAudience
      : localAudience;
  const setTargetAudience = canonicalIndustryAudience
    ? canonicalIndustryAudience.onTargetAudienceChange
    : useSharedProfile
      ? shared.setTargetAudience
      : setLocalAudience;
  const notes = canonicalNotes
    ? canonicalNotes.value
    : shared.isProviderActive
      ? shared.campaignNotes
      : localNotes;
  const setNotes = canonicalNotes
    ? canonicalNotes.onChange
    : shared.isProviderActive
      ? shared.setCampaignNotes
      : setLocalNotes;

  const industryText = coerceTrimmedString(industry);
  const targetAudienceText = coerceTrimmedString(targetAudience);
  const notesText = coerceTrimmedString(notes);
  const [result, setResult] = useState<CampaignResponse | null>(null);
  const [mediaBriefLoading, setMediaBriefLoading] = useState(false);
  const [compiledMediaBrief, setCompiledMediaBrief] = useState<string>("");
  const [mediaBriefError, setMediaBriefError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (shared.isProviderActive) return;
    if (initialNotes) setLocalNotes(initialNotes);
  }, [initialNotes, shared.isProviderActive]);

  useEffect(() => {
    if (canonicalIndustryAudience) return;
    if (useSharedProfile) return;
    if (defaultIndustry) setLocalIndustry(defaultIndustry);
  }, [defaultIndustry, useSharedProfile, canonicalIndustryAudience]);

  useEffect(() => {
    if (canonicalIndustryAudience) return;
    if (useSharedProfile) return;
    if (defaultTargetAudience) setLocalAudience(defaultTargetAudience);
  }, [defaultTargetAudience, useSharedProfile, canonicalIndustryAudience]);

  useEffect(() => {
    if (!shared.isProviderActive || canonicalNotes) return;
    if (initialNotes && initialNotes.length >= NOTES_MIN_LENGTH && !coerceTrimmedString(shared.campaignNotes)) {
      shared.setCampaignNotes(initialNotes);
    }
  }, [initialNotes, shared.isProviderActive, shared.campaignNotes, shared.setCampaignNotes, canonicalNotes]);

  // Auto-populate notes from dashboard context when engine has enough to build ≥ min length
  const ctxKey = contextForNotes
    ? `${contextForNotes.industry}|${contextForNotes.targetAudience}|${!!contextForNotes.analysis}|${contextForNotes.trends?.items?.length ?? 0}|${contextForNotes.trends?.campaignAngles?.length ?? 0}`
    : "";
  useEffect(() => {
    if (!contextForNotes || !ctxKey || canonicalNotes) return;
    const built = buildNotesFromContext(contextForNotes);
    if (built.length >= NOTES_MIN_LENGTH) {
      setNotes((prev) => {
        // Only auto-fill when notes are empty or very short (avoid overwriting user input)
        if (prev.length < NOTES_MIN_LENGTH) return built;
        return prev;
      });
    }
  }, [ctxKey, contextForNotes, canonicalNotes]); // ctxKey gates reruns; contextForNotes provides current data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [workflowTick, setWorkflowTick] = useState(0);
  const [useBentleyIntel, setUseBentleyIntel] = useState(true);
  const [rawNotesEditor, setRawNotesEditor] = useState(false);

  const snapshotSig = useAiRevenueOsSnapshotSignature();
  const snapshotGuidedForCampaign = useMemo(() => {
    if (!shared.isProviderActive || !bentleyActions.isProviderActive) return false;
    try {
      return structuredGuidedIntakeCompleteForCampaign(bentleyActions.getBentleySnapshot());
    } catch {
      return false;
    }
  }, [shared.isProviderActive, bentleyActions, snapshotSig]);

  const showIntelligencePanel =
    shared.isProviderActive && isBentleyPipelineNotesBlob(notesText) && notesText.length >= NOTES_MIN_LENGTH;

  useEffect(() => {
    if (!isBentleyPipelineNotesBlob(notes)) setRawNotesEditor(false);
  }, [notes]);

  useEffect(() => {
    const onLocal = () => setWorkflowTick((t) => t + 1);
    window.addEventListener("bentley-workflow-updated", onLocal);
    const unsub = subscribeBentleyWorkflowCrossTab(() => setWorkflowTick((t) => t + 1));
    return () => {
      window.removeEventListener("bentley-workflow-updated", onLocal);
      unsub();
    };
  }, []);

  const workflowHandoff = useMemo(
    () => loadWorkflowState().artifacts.bentleySliContentHandoff,
    [workflowTick]
  );
  const hasWorkflowHandoff = Boolean(workflowHandoff);

  const handleCompileMediaBrief = async () => {
    setMediaBriefLoading(true);
    setMediaBriefError(null);
    setCompiledMediaBrief("");
    try {
      const brief = await runCompileMediaBriefApi({
        industry: industryText || coerceTrimmedString(result?.industry) || "General",
        targetAudience: targetAudienceText || result?.targetAudience || "general audience",
        offerStatement: result?.offerStatement,
        messagePillars: result?.messagePillars,
        shortFormHooks: result?.shortFormHooks,
        campaignAngles: campaignAngles.length ? campaignAngles : undefined,
        objectionReplies: result?.objectionReplies,
        longFormOutlines: result?.longFormOutlines,
        notes: notesText.slice(0, 1000),
      });
      setCompiledMediaBrief(brief);
    } catch (e) {
      setMediaBriefError(e instanceof Error ? e.message : "Failed to compile");
    } finally {
      setMediaBriefLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!compiledMediaBrief) return;
    try {
      await navigator.clipboard.writeText(compiledMediaBrief);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const runGenerate = async () => {
    const trimmedIndustry = industryText;
    const trimmedNotes = notesText;
    let notesForApi = trimmedNotes;
    if (trimmedNotes.length < NOTES_MIN_LENGTH && snapshotGuidedForCampaign) {
      try {
        notesForApi = buildBaselineCampaignNotesFromIntake(bentleyActions.getBentleySnapshot());
      } catch {
        notesForApi = trimmedNotes;
      }
    }

    if (!trimmedIndustry || trimmedIndustry.length < 2) return;
    if (!notesForApi || notesForApi.length < NOTES_MIN_LENGTH) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const bentley =
        useBentleyIntel && hasWorkflowHandoff ? getWorkflowBentleyHandoffForGeneration() : {};
      const data = await runCampaignFromNotes({
        industry: trimmedIndustry,
        targetAudience: targetAudienceText || "general audience",
        notes: notesForApi,
        ...bentley,
        ...(useBentleyIntel === false ? { useBentleyIntelligence: false } : {}),
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const canRun =
    industryText.length >= 2 &&
    (notesText.length >= NOTES_MIN_LENGTH || snapshotGuidedForCampaign);

  const runIndustryCrawl = async () => {
    const ind = industryText;
    if (ind.length < 2) return;
    setCrawlLoading(true);
    setCrawlError(null);
    try {
      const { notesBlock } = await runCampaignNotesCrawlApi({
        industry: ind,
        targetAudience: targetAudienceText || "general audience",
      });
      const sep = notesText ? "\n\n---\n\n" : "";
      setNotes(`${notesText}${sep}${notesBlock}`.trim());
    } catch (e) {
      setCrawlError(e instanceof Error ? e.message : "Crawl failed");
    } finally {
      setCrawlLoading(false);
    }
  };

  return (
    <section
      id="campaign-from-notes"
      data-bentley-section="campaign-from-notes"
      className={`py-24 bg-black/80 ${compact ? "py-12" : ""}`}
    >
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-4xl font-bold text-center" style={{ color: ACCENT }}>
          {shared.isProviderActive ? "Campaign intelligence → Generate" : "Paste Notes → Generate Campaign"}
        </h2>
        <p className="text-gray-400 text-center max-w-2xl mx-auto mt-4">
          {shared.isProviderActive ? (
            <>
              Bentley assembles intake, research, trends, market sweep, and synthesis into a single intelligence
              bundle. The AI then produces offer statement, pillars, hooks, outlines, and objection replies.
            </>
          ) : (
            <>
              Paste your research, links, and observations. The AI synthesizes offer statement, message pillars,
              short-form hooks, long-form outlines, and objection replies.
            </>
          )}
        </p>

        <div
          className="mt-8 max-w-2xl mx-auto rounded-2xl border border-cyan-500/35 bg-slate-900/40 p-5"
          data-bentley-section="campaign-notes-crawl"
        >
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 shrink-0 mt-0.5" style={{ color: ACCENT }} aria-hidden />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-cyan-200">Industry web crawler</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Fetches public reference context (e.g. Wikipedia) and asks Bentley to draft notes tailored to your{" "}
                <strong className="text-gray-400">industry</strong> and <strong className="text-gray-400">audience</strong>.
                Results append to the Notes field — edit before generating.
              </p>
              <button
                type="button"
                onClick={() => void runIndustryCrawl()}
                disabled={crawlLoading || industryText.length < 2}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {crawlLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                {crawlLoading ? "Gathering…" : "Gather industry intel into Notes"}
              </button>
              {crawlError && <p className="mt-2 text-xs text-amber-400">{crawlError}</p>}
            </div>
          </div>
        </div>

        <div className="mt-10 max-w-2xl mx-auto space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Client industry
            </label>
            <input
              data-bentley-field="campaignIndustry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. B2B SaaS, fitness coaching, e-commerce skincare"
              className="w-full p-4 rounded-xl bg-slate-800/50 border-2 border-[#00D1FF]/50 text-white placeholder-gray-500 focus:outline-none focus:border-[#00D1FF]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Target audience (optional)
            </label>
            <input
              data-bentley-field="campaignTargetAudience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. SMB owners, Gen Z fitness enthusiasts"
              className="w-full p-4 rounded-xl bg-slate-800/50 border-2 border-[#00D1FF]/50 text-white placeholder-gray-500 focus:outline-none focus:border-[#00D1FF]"
            />
          </div>
          {hasWorkflowHandoff ? (
            <div className="rounded-xl border border-violet-500/40 bg-slate-900/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-violet-300">Bentley-assisted</span>
                <p className="text-slate-400 text-xs mt-0.5">
                  Market intelligence attached (notes below stay yours; Bentley is sent as a separate block).
                  {workflowHandoff?.handoffId ? (
                    <span className="font-mono text-slate-500"> · {workflowHandoff.handoffId.slice(0, 8)}…</span>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-slate-400 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={useBentleyIntel}
                    onChange={(e) => setUseBentleyIntel(e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  Use intelligence
                </label>
                <button
                  type="button"
                  className="text-xs text-rose-300/90 hover:underline"
                  onClick={() => {
                    clearWorkflowBentleyHandoff();
                    setWorkflowTick((t) => t + 1);
                  }}
                >
                  Clear from workflow
                </button>
              </div>
            </div>
          ) : null}

          {showIntelligencePanel && !rawNotesEditor ? (
            <CampaignIntelligenceNotesPanel notes={notes} onEditRaw={() => setRawNotesEditor(true)} />
          ) : null}

          {(!showIntelligencePanel || rawNotesEditor) && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className="block text-sm text-gray-400">
                  {showIntelligencePanel ? "Raw intelligence bundle" : "Campaign notes"}{" "}
                  {snapshotGuidedForCampaign
                    ? `(optional — auto-filled from guided intake when empty; min ${NOTES_MIN_LENGTH} chars if you replace with your own)`
                    : `(required, min ${NOTES_MIN_LENGTH} characters)`}
                </label>
                {showIntelligencePanel && rawNotesEditor ? (
                  <button
                    type="button"
                    onClick={() => setRawNotesEditor(false)}
                    className="text-xs text-cyan-400 hover:underline"
                  >
                    Back to intelligence view
                  </button>
                ) : null}
              </div>
              <textarea
                data-bentley-field="campaignNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste research, links, observations, trends, pain points, language from comments, etc."
                className="w-full p-4 rounded-xl bg-slate-800/50 border-2 border-[#00D1FF]/50 text-white placeholder-gray-500 focus:outline-none focus:border-[#00D1FF] min-h-[160px] resize-y"
                rows={6}
              />
            </div>
          )}
          <button
            onClick={runGenerate}
            disabled={loading || !canRun}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-black disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            style={{
              background:
                "linear-gradient(180deg, #F5C518 0%, #00D1FF 50%, #B8860B 100%)",
              boxShadow: "0 4px 0 #B8860B",
            }}
          >
            {loading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Generating campaign…
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Campaign
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-6 max-w-2xl mx-auto p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 space-y-10"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-gray-400">
                Campaign for <span style={{ color: ACCENT }}>{result.industry}</span>
                {result.targetAudience && <> · {result.targetAudience}</>}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>Generated {new Date(result.generatedAt).toLocaleString()}</span>
                {result.traceId && (
                  <span title={result.traceId}>
                    Support code: {result.traceId.slice(0, 8)}
                  </span>
                )}
              </div>
            </div>

            {result.disclaimers && result.disclaimers.length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-amber-200 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Notes
                </h3>
                <ul className="text-xs text-amber-200/80 space-y-1">
                  {result.disclaimers.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.offerStatement && (
              <div
                className="rounded-2xl border p-6"
                style={{
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderColor: "rgba(212,175,55,0.5)",
                }}
              >
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: ACCENT }}>
                  <Target className="h-5 w-5" />
                  Offer statement
                </h3>
                <p className="text-gray-300">{result.offerStatement}</p>
              </div>
            )}

            {result.messagePillars && result.messagePillars.length > 0 && (
              <div
                className="rounded-2xl border p-6"
                style={{
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderColor: "rgba(212,175,55,0.5)",
                }}
              >
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: ACCENT }}>
                  <Lightbulb className="h-5 w-5" />
                  Message pillars
                </h3>
                <ul className="space-y-2">
                  {result.messagePillars.map((pillar, i) => (
                    <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                      <span style={{ color: ACCENT }}>•</span>
                      {pillar}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.shortFormHooks && result.shortFormHooks.length > 0 && (
              <div
                className="rounded-2xl border p-6"
                style={{
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderColor: "rgba(212,175,55,0.5)",
                }}
              >
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: ACCENT }}>
                  Short-form hooks
                </h3>
                <ul className="grid md:grid-cols-2 gap-2">
                  {result.shortFormHooks.map((hook, i) => (
                    <li
                      key={i}
                      className="text-gray-300 text-sm p-3 rounded-xl bg-black/30 border border-white/5"
                    >
                      &quot;{hook}&quot;
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.longFormOutlines && result.longFormOutlines.length > 0 && (
              <div
                className="rounded-2xl border p-6"
                style={{
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderColor: "rgba(212,175,55,0.5)",
                }}
              >
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: ACCENT }}>
                  <FileText className="h-5 w-5" />
                  Long-form outlines
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {result.longFormOutlines.map((outline, i) => (
                    <LongFormOutlineCard key={i} outline={outline} />
                  ))}
                </div>
              </div>
            )}

            {result.objectionReplies && result.objectionReplies.length > 0 && (
              <div
                className="rounded-2xl border p-6"
                style={{
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderColor: "rgba(212,175,55,0.5)",
                }}
              >
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: ACCENT }}>
                  <MessageSquare className="h-5 w-5" />
                  Objection replies
                </h3>
                <ul className="space-y-2">
                  {result.objectionReplies.map((reply, i) => (
                    <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                      <span style={{ color: ACCENT }}>•</span>
                      {reply}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {enableMediaGeneration && (
              <div
                id="campaign-media-brief"
                className="rounded-2xl border p-6 scroll-mt-24"
                style={{
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderColor: "rgba(212,175,55,0.5)",
                }}
              >
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-2" style={{ color: ACCENT }}>
                  <Copy className="h-5 w-5" />
                  Compiled Media Brief — Paste Into Any Platform
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Compiles all your campaign input into an industry-standard brief with image prompts, video scripts, camera settings, angles, lenses, and style options (realistic/cartoon/both). Copy and paste into ChatGPT, Sora, Midjourney, Runway, or DALL·E on those platforms — no API cost here.
                </p>
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    onClick={() => void handleCompileMediaBrief()}
                    disabled={mediaBriefLoading}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-black disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    style={{
                      background: "linear-gradient(180deg, #F5C518 0%, #00D1FF 50%, #B8860B 100%)",
                      boxShadow: "0 3px 0 #B8860B",
                    }}
                  >
                    {mediaBriefLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Compile Media Brief
                  </button>
                  {compiledMediaBrief && (
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium border-2 transition-all"
                      style={{
                        borderColor: "rgba(212,175,55,0.7)",
                        color: ACCENT,
                      }}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied ? "Copied" : "Copy to Clipboard"}
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Paste into: ChatGPT · Sora · Midjourney · Runway · DALL·E · Claude · etc.
                </p>
                {mediaBriefError && (
                  <p className="mt-3 text-sm text-red-400">{mediaBriefError}</p>
                )}
                {compiledMediaBrief && (
                  <div className="mt-4">
                    <label className="block text-sm text-gray-400 mb-2">Output — select all and copy, or use the button above</label>
                    <textarea
                      readOnly
                      value={compiledMediaBrief}
                      className="w-full p-4 rounded-xl bg-slate-800/50 border border-[#00D1FF]/40 text-gray-300 text-sm font-mono min-h-[280px] resize-y focus:outline-none focus:ring-2 focus:ring-[#00D1FF]/50"
                      rows={14}
                    />
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}

function LongFormOutlineCard({ outline }: { outline: LongFormOutline }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.4)",
        borderColor: "rgba(212,175,55,0.3)",
      }}
    >
      <div className="font-semibold text-gray-200">{outline.title}</div>
      {outline.sections && outline.sections.length > 0 && (
        <ol className="mt-2 space-y-1 text-sm text-gray-400 list-decimal list-inside">
          {outline.sections.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      {outline.cta && (
        <div className="mt-3 text-sm">
          <span className="text-gray-500">CTA:</span>{" "}
          <span className="text-gray-300">{outline.cta}</span>
        </div>
      )}
    </div>
  );
}
