"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { flushSync } from "react-dom";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";
import type { IndustryKey } from "@/lib/revenue-os/industry-profiles";
import { INDUSTRY_PROFILES, INDUSTRY_OPTIONS } from "@/lib/revenue-os/industry-profiles";
import {
  DEFAULT_ANSWERS,
  type ClientReadinessAnswers,
} from "@/components/ai-revenue-os/ClientReadinessQuestionnaire";
import type { SocialPlatform } from "@/lib/social/config";
import { dedupePostingPlatforms } from "@/lib/revenue-os/bentley-posting-platforms";
import type {
  BentleyLaunchPrefill,
  BentleyOptionalAck,
  BentleyPipelineStageState,
  BentleySnapshot,
} from "@/lib/revenue-os/bentley-orchestrator";
import { mergePipelineStages, structuredGuidedIntakeCompleteForCampaign } from "@/lib/revenue-os/bentley-orchestrator";
import { writeCanonicalBentleySnapshot } from "@/lib/revenue-os/bentley-canonical-snapshot";
import { clearBentleyPersistedStorageForFreshChat } from "@/lib/revenue-os/bentley-chat-session-reset";
import { reconcileBentleySnapshotFromWorkflow } from "@/lib/revenue-os/bentley-pipeline-stage-sync";
import { buildBaselineCampaignNotesFromIntake } from "@/lib/revenue-os/bentley-auto-campaign-notes";
import { usePathname } from "next/navigation";
import { loadWorkflowState, subscribeBentleyWorkflowCrossTab } from "@/lib/revenue-os/bentley-workflow";
import { deriveSystemSignals } from "@/lib/revenue-os/derive-system-signals";
import { enrichSystemSignalsFromFeedback } from "@/lib/revenue-os/derive-system-signals-from-feedback";
import { fetchRevenueOsDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-client-fetch";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";
import { getBentleyStorageScope } from "@/lib/revenue-os/bentley-storage-scope";
import { isRevenueOsDashboardPath } from "@/lib/revenue-os/revenue-os-dashboard-path";

/** Map questionnaire platform labels to Content Engine platform ids */
function platformLabelToContentPlatformId(label: string): string | null {
  const m: Record<string, string> = {
    Instagram: "instagram",
    TikTok: "tiktok",
    "X (Twitter)": "x",
    LinkedIn: "linkedin",
    YouTube: "youtube",
    Facebook: "instagram",
    Other: "instagram",
  };
  return m[label] ?? null;
}

// --- Domain value types (narrow subscriptions) ---

export type AiRevenueOsProfileValue = {
  isProviderActive: boolean;
  industryKey: IndustryKey | null;
  setIndustryKey: (k: IndustryKey | null) => void;
  industry: string;
  setIndustry: (label: string) => void;
  contentIndustry: string;
  setContentIndustry: (v: string) => void;
  effectiveIndustryLabel: string;
  targetAudience: string;
  setTargetAudience: (v: string) => void;
  platforms: string[];
  setPlatforms: (v: string[]) => void;
  questionnaireAnswers: ClientReadinessAnswers;
  setQuestionnaireAnswers: (
    a: ClientReadinessAnswers | ((prev: ClientReadinessAnswers) => ClientReadinessAnswers)
  ) => void;
  businessName: string;
  setBusinessName: (v: string) => void;
  coreOffer: string;
  setCoreOffer: (v: string) => void;
  transformation: string;
  setTransformation: (v: string) => void;
};

export type AiRevenueOsRevenueInputsValue = {
  isProviderActive: boolean;
  traffic: number;
  setTraffic: (n: number) => void;
  conversionRate: number;
  setConversionRate: (n: number) => void;
  aov: number;
  setAov: (n: number) => void;
};

export type AiRevenueOsContentCampaignValue = {
  isProviderActive: boolean;
  tone: string;
  setTone: (v: string) => void;
  contentType: string;
  setContentType: (v: string) => void;
  imageStyle: string;
  setImageStyle: (v: string) => void;
  contentPlatformId: string;
  setContentPlatformId: (v: string) => void;
  campaignNotes: string;
  setCampaignNotes: (v: string) => void;
};

export type AiRevenueOsPostingPlatformsValue = {
  isProviderActive: boolean;
  postingPlatforms: SocialPlatform[];
  setPostingPlatforms: (v: SocialPlatform[]) => void;
};

export type AiRevenueOsBentleyActionsValue = {
  isProviderActive: boolean;
  getBentleySnapshot: () => BentleySnapshot;
  applyBentleyPatch: (patch: Partial<BentleySnapshot>, questionnairePatch?: Partial<ClientReadinessAnswers>) => void;
  /** Clears session persistence and resets in-memory Revenue OS / Bentley fields (chat “start over”). */
  resetBentleyToFreshStart: () => void;
};

/** Full merged shape — use only when a component truly needs everything (re-renders on any domain change). */
export interface AiRevenueOsSharedState extends AiRevenueOsProfileValue, AiRevenueOsRevenueInputsValue, AiRevenueOsContentCampaignValue, AiRevenueOsPostingPlatformsValue, AiRevenueOsBentleyActionsValue {}

export type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";

export type AiRevenueOsSystemSignalsValue = {
  isProviderActive: boolean;
  systemSignals: RevenueOsSystemSignals;
  setSystemSignals: Dispatch<SetStateAction<RevenueOsSystemSignals>>;
};

const ProfileCtx = createContext<AiRevenueOsProfileValue | null>(null);
const RevenueCtx = createContext<AiRevenueOsRevenueInputsValue | null>(null);
const ContentCampaignCtx = createContext<AiRevenueOsContentCampaignValue | null>(null);
const PostingCtx = createContext<AiRevenueOsPostingPlatformsValue | null>(null);
const BentleyActionsCtx = createContext<AiRevenueOsBentleyActionsValue | null>(null);
/** String signature of all fields that feed `getBentleySnapshot` — subscribe for UI that must track intake/snapshot without pulling unrelated domains. */
const SnapshotSignatureCtx = createContext<string | null>(null);
const SystemSignalsCtx = createContext<AiRevenueOsSystemSignalsValue | null>(null);

const noop = () => {};
const noopSetSystemSignals: Dispatch<SetStateAction<RevenueOsSystemSignals>> = () => {};

function emptySnapshot(): BentleySnapshot {
  return {
    industryKey: null,
    contentIndustry: "",
    targetAudience: "",
    traffic: 0,
    conversionRate: 0,
    aov: 0,
    businessName: "",
    coreOffer: "",
    transformation: "",
    platforms: [],
    postingPlatforms: [],
    tone: "Professional",
    contentType: "Full Post",
    imageStyle: "cinematic",
    campaignNotes: "",
    pipeline: undefined,
    launchPrefill: undefined,
  };
}

export function useAiRevenueOsProfile(): AiRevenueOsProfileValue {
  const v = useContext(ProfileCtx);
  if (!v) {
    return {
      isProviderActive: false,
      industryKey: null,
      setIndustryKey: noop,
      industry: "",
      setIndustry: noop,
      contentIndustry: "",
      setContentIndustry: noop,
      effectiveIndustryLabel: "",
      targetAudience: "",
      setTargetAudience: noop,
      platforms: [],
      setPlatforms: noop,
      questionnaireAnswers: DEFAULT_ANSWERS,
      setQuestionnaireAnswers: noop,
      businessName: "",
      setBusinessName: noop,
      coreOffer: "",
      setCoreOffer: noop,
      transformation: "",
      setTransformation: noop,
    };
  }
  return v;
}

export function useAiRevenueOsRevenueInputs(): AiRevenueOsRevenueInputsValue {
  const v = useContext(RevenueCtx);
  if (!v) {
    return {
      isProviderActive: false,
      traffic: 0,
      setTraffic: noop,
      conversionRate: 0,
      setConversionRate: noop,
      aov: 0,
      setAov: noop,
    };
  }
  return v;
}

export function useAiRevenueOsContentCampaign(): AiRevenueOsContentCampaignValue {
  const v = useContext(ContentCampaignCtx);
  if (!v) {
    return {
      isProviderActive: false,
      tone: "Professional",
      setTone: noop,
      contentType: "Full Post",
      setContentType: noop,
      imageStyle: "cinematic",
      setImageStyle: noop,
      contentPlatformId: "instagram",
      setContentPlatformId: noop,
      campaignNotes: "",
      setCampaignNotes: noop,
    };
  }
  return v;
}

export function useAiRevenueOsPostingPlatforms(): AiRevenueOsPostingPlatformsValue {
  const v = useContext(PostingCtx);
  if (!v) {
    return {
      isProviderActive: false,
      postingPlatforms: [],
      setPostingPlatforms: noop,
    };
  }
  return v;
}

/** Stable `getBentleySnapshot` / `applyBentleyPatch` — pair with `useAiRevenueOsSnapshotSignature()` when UI must refresh on snapshot changes. */
export function useAiRevenueOsBentleyActions(): AiRevenueOsBentleyActionsValue {
  const v = useContext(BentleyActionsCtx);
  if (!v) {
    return {
      isProviderActive: false,
      getBentleySnapshot: emptySnapshot,
      applyBentleyPatch: noop,
      resetBentleyToFreshStart: noop,
    };
  }
  return v;
}

/** Re-render when any field that affects `getBentleySnapshot()` changes (cheap string compare in provider). */
export function useAiRevenueOsSnapshotSignature(): string {
  return useContext(SnapshotSignatureCtx) ?? "";
}

/** 5-system diagnostic scores — updated after pipeline / pipeline UI sync (not continuously polled). */
export function useAiRevenueOsSystemSignals(): AiRevenueOsSystemSignalsValue {
  const v = useContext(SystemSignalsCtx);
  if (!v) {
    return {
      isProviderActive: false,
      systemSignals: {},
      setSystemSignals: noopSetSystemSignals,
    };
  }
  return v;
}

/**
 * @deprecated Prefer domain hooks (`useAiRevenueOsProfile`, `useAiRevenueOsRevenueInputs`, …) to avoid
 * re-rendering on unrelated updates. This hook subscribes to all domains.
 */
export function useAiRevenueOsSharedState(): AiRevenueOsSharedState {
  const profile = useAiRevenueOsProfile();
  const revenue = useAiRevenueOsRevenueInputs();
  const content = useAiRevenueOsContentCampaign();
  const posting = useAiRevenueOsPostingPlatforms();
  const bentley = useAiRevenueOsBentleyActions();
  useAiRevenueOsSnapshotSignature();

  return useMemo(
    () => ({
      ...profile,
      ...revenue,
      ...content,
      ...posting,
      ...bentley,
    }),
    [profile, revenue, content, posting, bentley]
  );
}

/** Dashboard route only: enrich system signals from deployment feedback when Step 4 pipeline is not mounted. */
function RevenueOsDashboardFeedbackSignalsEffect() {
  const pathname = usePathname();
  const snapshotSignature = useAiRevenueOsSnapshotSignature();
  const { getBentleySnapshot } = useAiRevenueOsBentleyActions();
  const { setSystemSignals } = useAiRevenueOsSystemSignals();
  const genRef = useRef(0);

  useEffect(() => {
    if (!isRevenueOsDashboardPath(pathname)) return;

    const gen = ++genRef.current;
    const wf = loadWorkflowState();
    const base = deriveSystemSignals({
      trends: wf.artifacts.trends ?? null,
      research: wf.artifacts.research ?? null,
      workflow: wf,
      snapshot: getBentleySnapshot(),
    });
    setSystemSignals(base);

    const ac = new AbortController();
    const cid = getBentleyStorageScope()?.clientId ?? "";
    void fetchRevenueOsDeploymentFeedback(cid === "_" ? "" : cid, { signal: ac.signal })
      .then((pack) => {
        if (ac.signal.aborted || genRef.current !== gen || !pack) return;
        setSystemSignals(enrichSystemSignalsFromFeedback(base, pack.signalsInput));
        try {
          sessionStorage.setItem("airos_dashboard_deployment_feedback_enriched", "1");
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});

    return () => ac.abort();
  }, [pathname, snapshotSignature, getBentleySnapshot, setSystemSignals]);

  return null;
}

export function AiRevenueOsSharedStateProvider({ children }: { children: ReactNode }) {
  const [systemSignals, setSystemSignals] = useState<RevenueOsSystemSignals>({});

  const [industryKey, setIndustryKeyState] = useState<IndustryKey | null>(null);

  const [traffic, setTraffic] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [aov, setAov] = useState(0);

  const [questionnaireAnswers, setQuestionnaireAnswers] =
    useState<ClientReadinessAnswers>(DEFAULT_ANSWERS);

  const [businessName, setBusinessName] = useState("");
  const [coreOffer, setCoreOffer] = useState("");
  const [transformation, setTransformation] = useState("");
  const [tone, setTone] = useState("Professional");
  const [contentType, setContentType] = useState("Full Post");
  const [imageStyle, setImageStyle] = useState("cinematic");
  const [contentPlatformId, setContentPlatformId] = useState("instagram");
  const [campaignNotes, setCampaignNotes] = useState("");
  const [postingPlatforms, setPostingPlatforms] = useState<SocialPlatform[]>([]);
  const [contentIndustry, setContentIndustry] = useState("");

  const [bentleyMeta, setBentleyMeta] = useState({
    skipTraffic: false,
    skipConversion: false,
    skipAov: false,
    skipTone: false,
    skipContentType: false,
    skipImageStyle: false,
    skipCampaignNotes: false,
    optionalAck: {} as BentleyOptionalAck,
  });

  const [pipeline, setPipeline] = useState<Partial<BentleyPipelineStageState>>({});
  const [launchPrefill, setLaunchPrefill] = useState<BentleyLaunchPrefill | undefined>(undefined);

  const industry = industryKey != null ? (INDUSTRY_PROFILES[industryKey]?.label ?? "") : "";
  const effectiveIndustryLabel = contentIndustry.trim() || industry.trim();

  useEffect(() => {
    setBentleyMeta((m) => ({
      ...m,
      optionalAck: {
        ...m.optionalAck,
        ...(traffic > 0 ? { traffic: true } : {}),
        ...(conversionRate > 0 ? { conversion: true } : {}),
        ...(aov > 0 ? { aov: true } : {}),
        ...(campaignNotes.trim().length > 0 ? { campaignNotes: true } : {}),
        ...(tone !== "Professional" ? { tone: true } : {}),
        ...(contentType !== "Full Post" ? { contentType: true } : {}),
        ...(imageStyle !== "cinematic" ? { imageStyle: true } : {}),
      },
    }));
  }, [traffic, conversionRate, aov, campaignNotes, tone, contentType, imageStyle]);

  const setIndustryKey = useCallback((k: IndustryKey | null) => {
    setIndustryKeyState(k);
    const label = k != null ? INDUSTRY_PROFILES[k]?.label : undefined;
    if (label) setContentIndustry(label);
  }, []);

  const setIndustry = useCallback((label: string) => {
    const found = INDUSTRY_OPTIONS.find(
      (o) => o.label.toLowerCase() === label.trim().toLowerCase()
    );
    if (found) setIndustryKey(found.value);
  }, [setIndustryKey]);

  const setTargetAudience = useCallback((v: string) => {
    setQuestionnaireAnswers((prev) => ({ ...prev, targetAudience: v || "" }));
  }, []);

  const setPlatforms = useCallback((plats: string[]) => {
    setQuestionnaireAnswers((prev) => ({ ...prev, socialPlatforms: Array.isArray(plats) ? plats : [] }));
  }, []);

  type SettersRef = {
    setIndustryKeyState: typeof setIndustryKeyState;
    setContentIndustry: typeof setContentIndustry;
    setQuestionnaireAnswers: typeof setQuestionnaireAnswers;
    setTraffic: typeof setTraffic;
    setConversionRate: typeof setConversionRate;
    setAov: typeof setAov;
    setBusinessName: typeof setBusinessName;
    setCoreOffer: typeof setCoreOffer;
    setTransformation: typeof setTransformation;
    setPostingPlatforms: typeof setPostingPlatforms;
    setTone: typeof setTone;
    setContentType: typeof setContentType;
    setImageStyle: typeof setImageStyle;
    setCampaignNotes: typeof setCampaignNotes;
    setContentPlatformId: typeof setContentPlatformId;
    setBentleyMeta: typeof setBentleyMeta;
    setPipeline: typeof setPipeline;
    setLaunchPrefill: typeof setLaunchPrefill;
  };

  const settersRef = useRef<SettersRef>({
    setIndustryKeyState,
    setContentIndustry,
    setQuestionnaireAnswers,
    setTraffic,
    setConversionRate,
    setAov,
    setBusinessName,
    setCoreOffer,
    setTransformation,
    setPostingPlatforms,
    setTone,
    setContentType,
    setImageStyle,
    setCampaignNotes,
    setContentPlatformId,
    setBentleyMeta,
    setPipeline,
    setLaunchPrefill,
  });
  settersRef.current = {
    setIndustryKeyState,
    setContentIndustry,
    setQuestionnaireAnswers,
    setTraffic,
    setConversionRate,
    setAov,
    setBusinessName,
    setCoreOffer,
    setTransformation,
    setPostingPlatforms,
    setTone,
    setContentType,
    setImageStyle,
    setCampaignNotes,
    setContentPlatformId,
    setBentleyMeta,
    setPipeline,
    setLaunchPrefill,
  };

  const snapshotStateRef = useRef({
    industryKey,
    contentIndustry,
    questionnaireAnswers,
    postingPlatforms,
    traffic,
    conversionRate,
    aov,
    businessName,
    coreOffer,
    transformation,
    tone,
    contentType,
    imageStyle,
    campaignNotes,
    bentleyMeta,
    pipeline,
    launchPrefill,
  });
  snapshotStateRef.current = {
    industryKey,
    contentIndustry,
    questionnaireAnswers,
    postingPlatforms,
    traffic,
    conversionRate,
    aov,
    businessName,
    coreOffer,
    transformation,
    tone,
    contentType,
    imageStyle,
    campaignNotes,
    bentleyMeta,
    pipeline,
    launchPrefill,
  };

  const getBentleySnapshot = useCallback((): BentleySnapshot => {
    const s = snapshotStateRef.current;
    return {
      industryKey: s.industryKey,
      contentIndustry: s.contentIndustry.trim(),
      targetAudience: s.questionnaireAnswers.targetAudience?.trim() ?? "",
      traffic: s.traffic,
      conversionRate: s.conversionRate,
      aov: s.aov,
      businessName: s.businessName.trim(),
      coreOffer: s.coreOffer.trim(),
      transformation: s.transformation.trim(),
      platforms: s.questionnaireAnswers.socialPlatforms ?? [],
      postingPlatforms: dedupePostingPlatforms(s.postingPlatforms),
      tone: s.tone,
      contentType: s.contentType,
      imageStyle: s.imageStyle,
      campaignNotes: s.campaignNotes.trim(),
      skipTraffic: s.bentleyMeta.skipTraffic,
      skipConversion: s.bentleyMeta.skipConversion,
      skipAov: s.bentleyMeta.skipAov,
      skipTone: s.bentleyMeta.skipTone,
      skipContentType: s.bentleyMeta.skipContentType,
      skipImageStyle: s.bentleyMeta.skipImageStyle,
      skipCampaignNotes: s.bentleyMeta.skipCampaignNotes,
      optionalAck: s.bentleyMeta.optionalAck,
      pipeline: s.pipeline,
      launchPrefill: s.launchPrefill,
    };
  }, []);

  const snapshotSignature = useMemo(() => {
    const payload = {
      industryKey,
      contentIndustry,
      targetAudience: questionnaireAnswers.targetAudience,
      socialPlatforms: questionnaireAnswers.socialPlatforms,
      postingPlatforms,
      traffic,
      conversionRate,
      aov,
      businessName,
      coreOffer,
      transformation,
      tone,
      contentType,
      imageStyle,
      campaignNotes,
      bentleyMeta,
      pipeline,
      launchPrefill,
    };
    try {
      return JSON.stringify(payload);
    } catch {
      return `fallback|${industryKey ?? ""}|${contentIndustry}|${traffic}|${campaignNotes.length}`;
    }
  }, [
    industryKey,
    contentIndustry,
    questionnaireAnswers,
    postingPlatforms,
    traffic,
    conversionRate,
    aov,
    businessName,
    coreOffer,
    transformation,
    tone,
    contentType,
    imageStyle,
    campaignNotes,
    bentleyMeta,
    pipeline,
    launchPrefill,
  ]);

  /** When structured guided intake is complete and the user has not entered notes, seed a baseline brief (manual notes stay as override). */
  useEffect(() => {
    try {
      const snap = getBentleySnapshot();
      if (!structuredGuidedIntakeCompleteForCampaign(snap)) return;
      if (snap.skipCampaignNotes) return;
      if (snap.campaignNotes.trim().length > 0) return;
      const baseline = buildBaselineCampaignNotesFromIntake(snap);
      setCampaignNotes(baseline);
      bentleyContinuityLog("campaign_brief_generated", { source: "baseline_intake", length: baseline.length });
    } catch {
      /* avoid crashing the page if snapshot/baseline ever throws on bad persisted state */
    }
  }, [snapshotSignature, getBentleySnapshot]);

  const applyBentleyPatch = useCallback(
    (patch: Partial<BentleySnapshot>, questionnairePatch?: Partial<ClientReadinessAnswers>) => {
      const f = settersRef.current;
      if (patch.industryKey !== undefined) {
        f.setIndustryKeyState(patch.industryKey);
        if (patch.industryKey) {
          const lbl = INDUSTRY_PROFILES[patch.industryKey]?.label;
          if (lbl) f.setContentIndustry(lbl);
        }
      }
      if (patch.contentIndustry !== undefined && (patch.industryKey === undefined || patch.industryKey === null)) {
        f.setContentIndustry(patch.contentIndustry);
      }
      if (patch.targetAudience !== undefined) {
        f.setQuestionnaireAnswers((prev) => ({ ...prev, targetAudience: patch.targetAudience ?? "" }));
      }
      if (patch.traffic !== undefined) f.setTraffic(patch.traffic);
      if (patch.conversionRate !== undefined) f.setConversionRate(patch.conversionRate);
      if (patch.aov !== undefined) f.setAov(patch.aov);
      if (patch.businessName !== undefined) f.setBusinessName(patch.businessName);
      if (patch.coreOffer !== undefined) f.setCoreOffer(patch.coreOffer);
      if (patch.transformation !== undefined) f.setTransformation(patch.transformation);
      if (patch.postingPlatforms !== undefined) {
        f.setPostingPlatforms(dedupePostingPlatforms(patch.postingPlatforms ?? []));
      }
      if (patch.platforms !== undefined) {
        const plats = patch.platforms ?? [];
        f.setQuestionnaireAnswers((prev) => ({ ...prev, socialPlatforms: plats }));
        const first = plats[0];
        if (first) {
          const pid = platformLabelToContentPlatformId(first);
          if (pid) f.setContentPlatformId(pid);
        }
      }
      if (patch.tone !== undefined) f.setTone(patch.tone);
      if (patch.contentType !== undefined) f.setContentType(patch.contentType);
      if (patch.imageStyle !== undefined) f.setImageStyle(patch.imageStyle);
      if (patch.campaignNotes !== undefined) f.setCampaignNotes(patch.campaignNotes);

      if (patch.pipeline !== undefined) {
        f.setPipeline((prev) => mergePipelineStages(prev, patch.pipeline));
      }
      if (patch.launchPrefill !== undefined) {
        f.setLaunchPrefill((prev) => ({ ...prev, ...patch.launchPrefill }));
      }

      f.setBentleyMeta((m) => {
        const next = { ...m };
        if (patch.skipTraffic !== undefined) next.skipTraffic = patch.skipTraffic;
        if (patch.skipConversion !== undefined) next.skipConversion = patch.skipConversion;
        if (patch.skipAov !== undefined) next.skipAov = patch.skipAov;
        if (patch.skipTone !== undefined) next.skipTone = patch.skipTone;
        if (patch.skipContentType !== undefined) next.skipContentType = patch.skipContentType;
        if (patch.skipImageStyle !== undefined) next.skipImageStyle = patch.skipImageStyle;
        if (patch.skipCampaignNotes !== undefined) next.skipCampaignNotes = patch.skipCampaignNotes;
        if (patch.optionalAck) {
          next.optionalAck = { ...m.optionalAck, ...patch.optionalAck };
        }
        return next;
      });

      if (questionnairePatch) {
        f.setQuestionnaireAnswers((prev) => ({ ...prev, ...questionnairePatch }));
      }
    },
    []
  );

  const resetBentleyToFreshStart = useCallback(() => {
    if (typeof window !== "undefined") {
      clearBentleyPersistedStorageForFreshChat();
    }
    flushSync(() => {
      setSystemSignals({});
      setIndustryKeyState(null);
      setTraffic(0);
      setConversionRate(0);
      setAov(0);
      setQuestionnaireAnswers(DEFAULT_ANSWERS);
      setBusinessName("");
      setCoreOffer("");
      setTransformation("");
      setTone("Professional");
      setContentType("Full Post");
      setImageStyle("cinematic");
      setContentPlatformId("instagram");
      setCampaignNotes("");
      setPostingPlatforms([]);
      setContentIndustry("");
      setBentleyMeta({
        skipTraffic: false,
        skipConversion: false,
        skipAov: false,
        skipTone: false,
        skipContentType: false,
        skipImageStyle: false,
        skipCampaignNotes: false,
        optionalAck: {},
      });
      setPipeline({});
      setLaunchPrefill(undefined);
    });
    try {
      reconcileBentleySnapshotFromWorkflow(applyBentleyPatch, getBentleySnapshot);
    } catch {
      /* ignore */
    }
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("bentley-workflow-updated"));
      }
    } catch {
      /* ignore */
    }
    bentleyContinuityLog("session_reset", { source: "bentley_fresh_start" });
  }, [applyBentleyPatch, getBentleySnapshot]);

  /** Structured guided intake complete → lock pipeline intake (never re-ask industry). */
  useEffect(() => {
    try {
      const snap = getBentleySnapshot();
      if (!structuredGuidedIntakeCompleteForCampaign(snap)) return;
      if (snap.pipeline?.intakeComplete) return;
      applyBentleyPatch({ pipeline: mergePipelineStages(snap.pipeline, { intakeComplete: true }) });
    } catch {
      /* ignore */
    }
  }, [snapshotSignature, getBentleySnapshot, applyBentleyPatch]);

  /** Single canonical JSON blob (session + localStorage mirror). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = window.setTimeout(() => {
      try {
        writeCanonicalBentleySnapshot(getBentleySnapshot());
      } catch {
        /* ignore */
      }
    }, 450);
    return () => clearTimeout(t);
  }, [snapshotSignature, getBentleySnapshot]);

  const workflowStagesSyncedRef = useRef(false);
  useLayoutEffect(() => {
    if (typeof window === "undefined" || workflowStagesSyncedRef.current) return;
    workflowStagesSyncedRef.current = true;
    try {
      reconcileBentleySnapshotFromWorkflow(applyBentleyPatch, getBentleySnapshot);
    } catch {
      /* ignore */
    }
  }, [applyBentleyPatch, getBentleySnapshot]);

  /** Cross-tab / same-tab workflow writes update sessionStorage; re-derive pipeline so UI cannot stay stale. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const run = () => {
      try {
        reconcileBentleySnapshotFromWorkflow(applyBentleyPatch, getBentleySnapshot);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("bentley-workflow-updated", run);
    const unsub = subscribeBentleyWorkflowCrossTab(run);
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("bentley-workflow-updated", run);
      unsub();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [applyBentleyPatch, getBentleySnapshot]);

  const profileValue = useMemo<AiRevenueOsProfileValue>(
    () => ({
      isProviderActive: true,
      industryKey,
      setIndustryKey,
      industry,
      setIndustry,
      contentIndustry,
      setContentIndustry,
      effectiveIndustryLabel,
      targetAudience: questionnaireAnswers.targetAudience?.trim() ?? "",
      setTargetAudience,
      platforms: questionnaireAnswers.socialPlatforms ?? [],
      setPlatforms,
      questionnaireAnswers,
      setQuestionnaireAnswers,
      businessName,
      setBusinessName,
      coreOffer,
      setCoreOffer,
      transformation,
      setTransformation,
    }),
    [
      industryKey,
      setIndustryKey,
      industry,
      setIndustry,
      contentIndustry,
      effectiveIndustryLabel,
      questionnaireAnswers,
      setTargetAudience,
      setPlatforms,
      businessName,
      coreOffer,
      transformation,
    ]
  );

  const revenueValue = useMemo<AiRevenueOsRevenueInputsValue>(
    () => ({
      isProviderActive: true,
      traffic,
      setTraffic,
      conversionRate,
      setConversionRate,
      aov,
      setAov,
    }),
    [traffic, conversionRate, aov]
  );

  const contentCampaignValue = useMemo<AiRevenueOsContentCampaignValue>(
    () => ({
      isProviderActive: true,
      tone,
      setTone,
      contentType,
      setContentType,
      imageStyle,
      setImageStyle,
      contentPlatformId,
      setContentPlatformId,
      campaignNotes,
      setCampaignNotes,
    }),
    [tone, contentType, imageStyle, contentPlatformId, campaignNotes]
  );

  const postingValue = useMemo<AiRevenueOsPostingPlatformsValue>(
    () => ({
      isProviderActive: true,
      postingPlatforms,
      setPostingPlatforms,
    }),
    [postingPlatforms]
  );

  const bentleyActionsValue = useMemo<AiRevenueOsBentleyActionsValue>(
    () => ({
      isProviderActive: true,
      getBentleySnapshot,
      applyBentleyPatch,
      resetBentleyToFreshStart,
    }),
    [getBentleySnapshot, applyBentleyPatch, resetBentleyToFreshStart]
  );

  const systemSignalsValue = useMemo<AiRevenueOsSystemSignalsValue>(
    () => ({
      isProviderActive: true,
      systemSignals,
      setSystemSignals,
    }),
    [systemSignals]
  );

  return (
    <ProfileCtx.Provider value={profileValue}>
      <RevenueCtx.Provider value={revenueValue}>
        <ContentCampaignCtx.Provider value={contentCampaignValue}>
          <PostingCtx.Provider value={postingValue}>
            <BentleyActionsCtx.Provider value={bentleyActionsValue}>
              <SnapshotSignatureCtx.Provider value={snapshotSignature}>
                <SystemSignalsCtx.Provider value={systemSignalsValue}>
                  <RevenueOsDashboardFeedbackSignalsEffect />
                  {children}
                </SystemSignalsCtx.Provider>
              </SnapshotSignatureCtx.Provider>
            </BentleyActionsCtx.Provider>
          </PostingCtx.Provider>
        </ContentCampaignCtx.Provider>
      </RevenueCtx.Provider>
    </ProfileCtx.Provider>
  );
}
