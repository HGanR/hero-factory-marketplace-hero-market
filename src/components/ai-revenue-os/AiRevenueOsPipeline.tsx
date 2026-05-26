"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  startTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import { FileText, Sparkles } from "lucide-react";
import { ResearchAssistantSection } from "@/components/ai-revenue-os/ResearchAssistantSection";
import { TrendsLibrarySection } from "@/components/ai-revenue-os/TrendsLibrarySection";
import { EmailMarketingSection } from "@/components/ai-revenue-os/EmailMarketingSection";
import { ContentEngineSection } from "@/components/ai-revenue-os/ContentEngineSection";
import { PastGenerationsPanel } from "@/components/ai-revenue-os/PastGenerationsPanel";
import { VariantOptimizationPanel } from "@/components/ai-revenue-os/VariantOptimizationPanel";
import { DistributionVolumePanel } from "@/components/ai-revenue-os/DistributionVolumePanel";
import { CampaignFromNotesSection } from "@/components/ai-revenue-os/CampaignFromNotesSection";
import {
  useAiRevenueOsBentleyActions,
  useAiRevenueOsProfile,
  useAiRevenueOsSnapshotSignature,
  useAiRevenueOsSystemSignals,
} from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import { deriveSystemSignals } from "@/lib/revenue-os/derive-system-signals";
import { enrichSystemSignalsFromFeedback } from "@/lib/revenue-os/derive-system-signals-from-feedback";
import { fetchRevenueOsDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-client-fetch";
import { getBentleyStorageScope } from "@/lib/revenue-os/bentley-storage-scope";
import { parseIndustryKey } from "@/lib/revenue-os/bentley-orchestrator";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import type { IndustryKey } from "@/lib/revenue-os/industry-profiles";
import type { TrendsResponse } from "@/lib/revenue-os/trends-schema";
import type { ResearchResult } from "@/components/ai-revenue-os/ResearchAssistantSection";
import {
  buildSynthesisInputSignature,
  researchResultToSnippet,
  runSynthesizePlan,
} from "@/lib/revenue-os/run-synthesize-plan";
import { loadWorkflowState, subscribeBentleyWorkflowCrossTab } from "@/lib/revenue-os/bentley-workflow";
import { fingerprintWorkflowBentleyHandoff } from "@/lib/revenue-os/revenue-os-pipeline-actions";

const ACCENT = "#00D1FF";

const SYNTH_DEV_LOG =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

function synthDevLog(
  phase: "start" | "skip" | "abort" | "stale" | "commit" | "error",
  detail: string,
  extra?: Record<string, unknown>
): void {
  if (!SYNTH_DEV_LOG) return;
  const payload = extra && Object.keys(extra).length > 0 ? extra : undefined;
  // eslint-disable-next-line no-console -- dev-only synthesis trace (remove when stable)
  console.debug(`[AiRevenueOsPipeline:synthesis] ${phase}`, detail, payload ?? "");
}

type AiRevenueOsPipelineProps = {
  /** When true, omit `data-bentley-section` on the content-engine block (parent accordion owns the marker). */
  omitContentEngineBentleyMarker?: boolean;
};

export function AiRevenueOsPipeline({ omitContentEngineBentleyMarker = false }: AiRevenueOsPipelineProps = {}) {
  const {
    effectiveIndustryLabel,
    targetAudience: sharedTargetAudience,
    platforms: sharedPlatforms,
    setIndustryKey,
    setContentIndustry,
    setTargetAudience: setSharedTargetAudience,
  } = useAiRevenueOsProfile();
  const { getBentleySnapshot } = useAiRevenueOsBentleyActions();
  const { setSystemSignals } = useAiRevenueOsSystemSignals();
  const snapshotSignature = useAiRevenueOsSnapshotSignature();
  const effectiveIndustry = effectiveIndustryLabel;
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [trendsResult, setTrendsResult] = useState<TrendsResponse | null>(null);
  const [consultantPlan, setConsultantPlan] = useState<string>("");
  const [campaignBrief, setCampaignBrief] = useState<string>("");
  const [pipelineIndustry, setPipelineIndustry] = useState<string>("");
  const [pipelineTargetAudience, setPipelineTargetAudience] = useState<string>("");
  const [campaignAngles, setCampaignAngles] = useState<string[]>([]);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  /** Monotonic generation for stale async response detection (not React state). */
  const synthesisGenRef = useRef(0);
  const systemSignalsFeedbackGenRef = useRef(0);

  const synthesisSettersRef = useRef<{
    setIndustryKey: (k: IndustryKey | null) => void;
    setContentIndustry: Dispatch<SetStateAction<string>>;
    setSharedTargetAudience: (v: string) => void;
  }>({ setIndustryKey, setContentIndustry, setSharedTargetAudience });
  synthesisSettersRef.current = { setIndustryKey, setContentIndustry, setSharedTargetAudience };

  const trendsRef = useRef(trendsResult);
  const researchRef = useRef(researchResult);
  trendsRef.current = trendsResult;
  researchRef.current = researchResult;

  const [workflowTick, setWorkflowTick] = useState(0);

  useEffect(() => {
    const onLocal = () => setWorkflowTick((t) => t + 1);
    window.addEventListener("bentley-workflow-updated", onLocal);
    const unsub = subscribeBentleyWorkflowCrossTab(() => setWorkflowTick((t) => t + 1));
    return () => {
      window.removeEventListener("bentley-workflow-updated", onLocal);
      unsub();
    };
  }, []);

  /** Sync 5-system scores; then optionally enrich from deployment feedback (conservative, async). */
  useEffect(() => {
    const gen = ++systemSignalsFeedbackGenRef.current;
    const wf = loadWorkflowState();
    const base = deriveSystemSignals({
      trends: trendsResult ?? wf.artifacts.trends ?? null,
      research: researchResult ?? wf.artifacts.research ?? null,
      workflow: wf,
      snapshot: getBentleySnapshot(),
    });
    setSystemSignals(base);

    if (typeof window === "undefined") return;
    const ac = new AbortController();
    const cid = getBentleyStorageScope()?.clientId ?? "";
    void fetchRevenueOsDeploymentFeedback(cid === "_" ? "" : cid, { signal: ac.signal })
      .then((pack) => {
        if (ac.signal.aborted || systemSignalsFeedbackGenRef.current !== gen || !pack) return;
        setSystemSignals(enrichSystemSignalsFromFeedback(base, pack.signalsInput));
      })
      .catch(() => {});

    return () => ac.abort();
  }, [trendsResult, researchResult, workflowTick, snapshotSignature, getBentleySnapshot, setSystemSignals]);

  const synthesisInputSignature = useMemo(
    () =>
      buildSynthesisInputSignature(
        trendsResult,
        researchResult,
        typeof window !== "undefined"
          ? fingerprintWorkflowBentleyHandoff(loadWorkflowState().artifacts.bentleySliContentHandoff ?? null)
          : ""
      ),
    [trendsResult, researchResult, workflowTick]
  );

  useEffect(() => {
    if (!synthesisInputSignature) {
      synthDevLog("skip", "no trends / empty signature");
      return;
    }

    const ac = new AbortController();
    const gen = ++synthesisGenRef.current;

    synthDevLog("start", "synthesis run", {
      gen,
      signaturePrefix: synthesisInputSignature.slice(0, 120),
    });

    setSynthesizing(true);
    setSynthesisError(null);

    (async () => {
      const trends = trendsRef.current;
      const research = researchRef.current;
      if (!trends) {
        if (gen === synthesisGenRef.current) setSynthesizing(false);
        return;
      }

      const { setIndustryKey: setIk, setContentIndustry: setCi, setSharedTargetAudience: setTa } =
        synthesisSettersRef.current;

      try {
        const wf = loadWorkflowState();
        const bh = wf.artifacts.bentleySliContentHandoff ?? undefined;
        const parsed = await runSynthesizePlan({
          trends,
          research: research ? researchResultToSnippet(research) : null,
          signal: ac.signal,
          ...(bh && {
            bentleySliContentHandoff: bh,
            ...(bh.handoffId ? { bentleyHandoffId: bh.handoffId } : {}),
          }),
        });

        if (gen !== synthesisGenRef.current) {
          synthDevLog("stale", "ignored response (newer synthesis started)", { gen });
          return;
        }

        setConsultantPlan(parsed.consultantPlan ?? "");
        setCampaignBrief(parsed.campaignBrief ?? "");
        const ind = coerceTrimmedString(parsed.industry ?? trends.industry);
        const aud = coerceTrimmedString(parsed.targetAudience ?? trends.targetAudience);
        setPipelineIndustry(ind);
        setPipelineTargetAudience(aud);
        setCampaignAngles(parsed.campaignAngles ?? trends.campaignAngles ?? []);
        // Defer shared-context updates so synthesis completion does not synchronously cascade
        // profile → Research/Trends consumers in the same commit (Firefox: "too much recursion").
        startTransition(() => {
          if (ind) {
            const key = parseIndustryKey(ind);
            if (key) setIk(key);
            else {
              setIk(null);
              setCi(ind);
            }
          }
          if (aud) setTa(aud);
        });

        synthDevLog("commit", "state updated", {
          gen,
          signaturePrefix: synthesisInputSignature.slice(0, 80),
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          synthDevLog("abort", "request aborted (deps changed or unmount)", { gen });
          return;
        }
        if (gen !== synthesisGenRef.current) {
          synthDevLog("stale", "ignored error from stale run", { gen });
          return;
        }
        synthDevLog("error", e instanceof Error ? e.message : "unknown", { gen });
        setSynthesisError(e instanceof Error ? e.message : "Failed to create plan");
        setConsultantPlan("");
        setCampaignBrief("");
        setPipelineIndustry("");
        setPipelineTargetAudience("");
        setCampaignAngles([]);
      } finally {
        if (gen === synthesisGenRef.current) {
          setSynthesizing(false);
        }
      }
    })();

    return () => {
      ac.abort();
      synthDevLog("abort", "effect cleanup", { abortedGen: gen });
    };
  }, [synthesisInputSignature]);

  const handleTrendsResult = useCallback((data: TrendsResponse) => {
    setTrendsResult(data);
  }, []);

  /** Defer parent research state so child `setResult` + effects don't synchronously stack with pipeline updates (Chrome stack overflow on Run Research). */
  const handleResearchResult = useCallback((data: ResearchResult) => {
    startTransition(() => setResearchResult(data));
  }, []);

  const trendsLibraryProps = useMemo(
    () => ({
      defaultIndustry: effectiveIndustry,
      defaultTargetAudience: sharedTargetAudience,
    }),
    [effectiveIndustry, sharedTargetAudience]
  );

  const contentEngineDefaults = useMemo(
    () => ({
      defaultIndustry: pipelineIndustry || effectiveIndustry,
      defaultTargetAudience: pipelineTargetAudience || sharedTargetAudience,
      defaultPlatforms: sharedPlatforms,
    }),
    [pipelineIndustry, effectiveIndustry, pipelineTargetAudience, sharedTargetAudience, sharedPlatforms]
  );

  const campaignDefaults = useMemo(
    () => ({
      defaultIndustry: pipelineIndustry || effectiveIndustry,
      defaultTargetAudience: pipelineTargetAudience || sharedTargetAudience,
      initialNotes: campaignBrief,
      campaignAngles,
    }),
    [
      pipelineIndustry,
      effectiveIndustry,
      pipelineTargetAudience,
      sharedTargetAudience,
      campaignBrief,
      campaignAngles,
    ]
  );

  return (
    <>
      <ResearchAssistantSection onResult={handleResearchResult} />
      <TrendsLibrarySection
        {...trendsLibraryProps}
        onTrendsResult={handleTrendsResult}
      />
      <EmailMarketingSection industry={pipelineIndustry || effectiveIndustry} />
      {synthesizing && (
        <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <span>Creating consultant plan & campaign brief…</span>
        </div>
      )}
      {synthesisError && (
        <div className="max-w-6xl mx-auto px-6 py-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-sm">
          {synthesisError}
        </div>
      )}
      {consultantPlan && !synthesizing && (
        <section id="consultant-plan" className="py-12 bg-black/80">
          <div className="max-w-6xl mx-auto px-6">
            <div
              className="rounded-2xl border p-6"
              style={{
                backgroundColor: "rgba(0,0,0,0.6)",
                borderColor: "rgba(212,175,55,0.5)",
              }}
            >
              <h3 className="flex items-center gap-2 text-xl font-semibold mb-4" style={{ color: ACCENT }}>
                <FileText className="h-6 w-6" />
                Consultant Plan — Instruct Your Client
              </h3>
              <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                {consultantPlan}
              </div>
              <p className="mt-4 text-xs text-gray-500">
                This plan will be used to pre-fill the campaign generator below.
              </p>
            </div>
          </div>
        </section>
      )}
      <section
        id="content-engine"
        data-bentley-section={omitContentEngineBentleyMarker ? undefined : "content-engine"}
        className="py-12 bg-black/60"
      >
        <div className="max-w-6xl mx-auto px-6">
          <ContentEngineSection
            defaultIndustry={contentEngineDefaults.defaultIndustry}
            defaultTargetAudience={contentEngineDefaults.defaultTargetAudience}
            defaultPlatforms={contentEngineDefaults.defaultPlatforms}
          />
          <div className="mt-8 space-y-8">
            <div id="launch-variant-optimization" className="scroll-mt-24">
              <VariantOptimizationPanel />
            </div>
            <div id="launch-distribution-volume" className="scroll-mt-24">
              <DistributionVolumePanel />
            </div>
            <div id="launch-past-generations" className="scroll-mt-24">
              <PastGenerationsPanel />
            </div>
          </div>
        </div>
      </section>
      <CampaignFromNotesSection
        defaultIndustry={campaignDefaults.defaultIndustry}
        defaultTargetAudience={campaignDefaults.defaultTargetAudience}
        initialNotes={campaignDefaults.initialNotes}
        campaignAngles={campaignDefaults.campaignAngles}
        enableMediaGeneration={true}
      />
    </>
  );
}
