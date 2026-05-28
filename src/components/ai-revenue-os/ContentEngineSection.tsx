"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  Image as ImageIcon,
  Lightbulb,
  MessageSquare,
  FileText,
  RefreshCw,
  Twitter,
  Youtube,
  Instagram,
  Linkedin,
  ExternalLink,
} from "lucide-react";
import { useAiRevenueOsContentCampaign, useAiRevenueOsProfile } from "./AiRevenueOsSharedState";
import { normalizeStrategyLabelToContentPlatformId } from "@/lib/social/platform-identity";
import type { RevenueOsDashboardFormValues } from "@/lib/revenue-os/run-revenue-os-analysis";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import { writeCachedContentEngineOutput } from "@/lib/revenue-os/content-engine-cache";
import { runViralContent } from "@/lib/revenue-os/run-viral-content";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import { ContentDeployPanel } from "@/components/ai-revenue-os/ContentDeployPanel";
import { BENTLEY_SET_CLONE_VARIANT_EVENT } from "@/components/ai-revenue-os/VariantOptimizationPanel";
import { loadWorkflowState, subscribeBentleyWorkflowCrossTab } from "@/lib/revenue-os/bentley-workflow";
import {
  clearWorkflowBentleyHandoff,
  getWorkflowBentleyHandoffForGeneration,
} from "@/lib/revenue-os/bentley-workflow-handoff-client";

const ACCENT = "#00D1FF";

/** Clipforge-style thumbnail template presets for quick copy */
const CLIPFORGE_TEMPLATE_PRESETS = [
  { id: "youtube-hook", name: "YouTube Hook", platform: "YouTube", overlayText: "You Won't Believe This...", description: "Bold hook text for maximum CTR" },
  { id: "tiktok-viral", name: "TikTok Viral", platform: "TikTok", overlayText: "Watch Till The End 👀", description: "Eye-catching top banner" },
  { id: "linkedin-pro", name: "LinkedIn Pro", platform: "LinkedIn", overlayText: "Key Insight:", description: "Clean professional lower-third" },
  { id: "instagram-reel", name: "Instagram Reel", platform: "Instagram", overlayText: "Save This! 🔖", description: "Centered save-worthy CTA" },
  { id: "twitter-punch", name: "Twitter/X Punch", platform: "Twitter/X", overlayText: "Thread 🧵", description: "Short punchy label" },
  { id: "podcast-clip", name: "Podcast Clip", platform: "General", overlayText: "Best Moment", description: "Warm quote-style overlay" },
];

/** Thumbnail style presets (from Clipforge) for image generation */
const THUMBNAIL_STYLES: Record<string, string> = {
  cinematic: "cinematic widescreen movie poster style, dramatic lighting, film grain, deep shadows, professional color grading",
  bold: "bold graphic design, large impactful typography overlay space, high contrast, eye-catching colors, social media optimized",
  minimal: "clean minimalist design, lots of white space, subtle gradients, modern sans-serif aesthetic, elegant",
  vibrant: "vibrant saturated colors, energetic, dynamic composition, pop art inspired, bright and exciting",
  dark: "dark moody atmosphere, deep blacks, neon accent lighting, cyberpunk aesthetic, dramatic shadows",
  neon: "neon glow effects, synthwave aesthetic, electric purple and cyan colors, retro-futuristic, glowing outlines",
};

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: Instagram, color: "#E4405F" },
  { id: "tiktok", label: "TikTok", icon: Zap, color: "#000000" },
  { id: "x", label: "X (Twitter)", icon: Twitter, color: "#1DA1F2" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "#0A66C2" },
  { id: "youtube", label: "YouTube", icon: Youtube, color: "#FF0000" },
];

const TONES = [
  "Professional",
  "Bold",
  "Educational",
  "Luxury",
  "Conversational",
  "Authoritative",
  "Playful",
  "Inspirational",
];

const CONTENT_TYPES = [
  "Full Post",
  "Caption Only",
  "Image Prompt",
  "Viral Content Idea",
  "Hooks",
];

export interface ContentEngineSectionProps {
  defaultBusinessName?: string;
  defaultIndustry?: string;
  defaultTargetAudience?: string;
  defaultCoreOffer?: string;
  defaultTransformation?: string;
  defaultTone?: string;
  defaultContentTypeFocus?: string;
  defaultImageStyle?: string;
  /** Canonical platform id (instagram, tiktok, …) derived from dashboard `form.postingPlatforms` / `form.platforms`. */
  defaultContentPlatformId?: string;
  defaultPlatforms?: string[];
  compact?: boolean;
  /** Fires when generation completes or clears — used by Revenue OS dashboard for first-post flow. */
  onOutputChange?: (output: ContentEngineOutput | null) => void;
  /**
   * On `/revenue-os/dashboard`, drive all overlapping fields from dashboard `form` via `onDashboardFormPatch`
   * instead of AiRevenueOs shared profile/content state (avoids drift vs Bentley mirror + debounced sync).
   */
  dashboardFormCanonical?: boolean;
  onDashboardFormPatch?: (patch: Partial<RevenueOsDashboardFormValues>) => void;
  /** Shown under the Platform chips (e.g. dashboard: clarify strategy channel vs OAuth). */
  contentPlatformSectionHelper?: string;
}

export function ContentEngineSection({
  defaultBusinessName = "",
  defaultIndustry = "",
  defaultTargetAudience = "",
  defaultCoreOffer = "",
  defaultTransformation = "",
  defaultTone = "Professional",
  defaultContentTypeFocus = "Full Post",
  defaultImageStyle = "cinematic",
  defaultContentPlatformId = "instagram",
  defaultPlatforms = [],
  compact = false,
  onOutputChange,
  dashboardFormCanonical = false,
  onDashboardFormPatch,
  contentPlatformSectionHelper,
}: ContentEngineSectionProps) {
  const profile = useAiRevenueOsProfile();
  const contentCampaign = useAiRevenueOsContentCampaign();
  const isDashboardCanonical = Boolean(dashboardFormCanonical && onDashboardFormPatch);
  const shared = {
    isProviderActive: profile.isProviderActive,
    businessName: profile.businessName,
    setBusinessName: profile.setBusinessName,
    effectiveIndustryLabel: profile.effectiveIndustryLabel,
    setContentIndustry: profile.setContentIndustry,
    targetAudience: profile.targetAudience,
    setTargetAudience: profile.setTargetAudience,
    coreOffer: profile.coreOffer,
    setCoreOffer: profile.setCoreOffer,
    transformation: profile.transformation,
    setTransformation: profile.setTransformation,
    tone: contentCampaign.tone,
    setTone: contentCampaign.setTone,
    contentPlatformId: contentCampaign.contentPlatformId,
    setContentPlatformId: contentCampaign.setContentPlatformId,
    contentType: contentCampaign.contentType,
    setContentType: contentCampaign.setContentType,
    imageStyle: contentCampaign.imageStyle,
    setImageStyle: contentCampaign.setImageStyle,
    campaignNotes: contentCampaign.campaignNotes,
  };

  const useShared = shared.isProviderActive && !isDashboardCanonical;
  const campaignNotesForUnified = useShared ? coerceTrimmedString(shared.campaignNotes) : "";

  const [lb, setLb] = useState(defaultBusinessName);
  const [li, setLi] = useState(defaultIndustry);
  const [lta, setLta] = useState(defaultTargetAudience);
  const [lco, setLco] = useState(defaultCoreOffer);
  const [ltr, setLtr] = useState("");
  const [ltone, setLtone] = useState("Professional");
  const [lpl, setLpl] = useState("instagram");
  const [lct, setLct] = useState("Full Post");
  const [lis, setLis] = useState<keyof typeof THUMBNAIL_STYLES>("cinematic");

  const businessName = isDashboardCanonical
    ? defaultBusinessName
    : useShared
      ? shared.businessName
      : lb;
  const setBusinessName = (v: string) => {
    if (isDashboardCanonical) onDashboardFormPatch!({ businessName: v });
    else if (useShared) shared.setBusinessName(v);
    else setLb(v);
  };

  const industry = isDashboardCanonical
    ? defaultIndustry
    : useShared
      ? shared.effectiveIndustryLabel
      : li;
  const setIndustry = (v: string) => {
    if (isDashboardCanonical) onDashboardFormPatch!({ businessType: v });
    else if (useShared) shared.setContentIndustry(v);
    else setLi(v);
  };

  const targetAudience = isDashboardCanonical
    ? defaultTargetAudience
    : useShared
      ? shared.targetAudience
      : lta;
  const setTargetAudience = (v: string) => {
    if (isDashboardCanonical) onDashboardFormPatch!({ targetAudience: v });
    else if (useShared) shared.setTargetAudience(v);
    else setLta(v);
  };

  const coreOffer = isDashboardCanonical ? defaultCoreOffer : useShared ? shared.coreOffer : lco;
  const setCoreOffer = (v: string) => {
    if (isDashboardCanonical) onDashboardFormPatch!({ coreOffer: v });
    else if (useShared) shared.setCoreOffer(v);
    else setLco(v);
  };

  const transformation = isDashboardCanonical
    ? defaultTransformation
    : useShared
      ? shared.transformation
      : ltr;
  const setTransformation = (v: string) => {
    if (isDashboardCanonical) onDashboardFormPatch!({ transformation: v });
    else if (useShared) shared.setTransformation(v);
    else setLtr(v);
  };

  const tone = isDashboardCanonical ? defaultTone : useShared ? shared.tone : ltone;
  const setTone = (v: string) => {
    if (isDashboardCanonical) onDashboardFormPatch!({ tone: v });
    else if (useShared) shared.setTone(v);
    else setLtone(v);
  };

  const platform = isDashboardCanonical
    ? defaultContentPlatformId
    : useShared
      ? shared.contentPlatformId
      : lpl;
  const setPlatform = (id: string) => {
    if (isDashboardCanonical) {
      const label =
        PLATFORMS.find((p) => p.id === id)?.label ??
        (id === "instagram"
          ? "Instagram"
          : id === "tiktok"
            ? "TikTok"
            : id === "x"
              ? "X (Twitter)"
              : id === "linkedin"
                ? "LinkedIn"
                : id === "youtube"
                  ? "YouTube"
                  : "Instagram");
      onDashboardFormPatch!({ platforms: [label] });
    } else if (useShared) shared.setContentPlatformId(id);
    else setLpl(id);
  };

  const contentType = isDashboardCanonical
    ? defaultContentTypeFocus
    : useShared
      ? shared.contentType
      : lct;
  const setContentType = (v: string) => {
    if (isDashboardCanonical) onDashboardFormPatch!({ contentTypeFocus: v });
    else if (useShared) shared.setContentType(v);
    else setLct(v);
  };

  const imageStyleStr = isDashboardCanonical
    ? defaultImageStyle in THUMBNAIL_STYLES
      ? defaultImageStyle
      : "cinematic"
    : useShared
      ? shared.imageStyle
      : lis;

  useEffect(() => {
    if (isDashboardCanonical) return;
    if (useShared) return;
    if (defaultIndustry) setLi(defaultIndustry);
  }, [defaultIndustry, useShared, isDashboardCanonical]);
  useEffect(() => {
    if (isDashboardCanonical) return;
    if (useShared) return;
    if (defaultTargetAudience) setLta(defaultTargetAudience);
  }, [defaultTargetAudience, useShared, isDashboardCanonical]);
  useEffect(() => {
    if (isDashboardCanonical) return;
    if (useShared) return;
    if (defaultPlatforms?.length) {
      const first = defaultPlatforms[0];
      const id = normalizeStrategyLabelToContentPlatformId(first ?? "");
      if (PLATFORMS.some((p) => p.id === id)) setLpl(id);
    }
  }, [defaultPlatforms, useShared, isDashboardCanonical]);

  const imageStyle = imageStyleStr as keyof typeof THUMBNAIL_STYLES;
  const setImageStyle = (k: keyof typeof THUMBNAIL_STYLES) => {
    if (isDashboardCanonical) onDashboardFormPatch!({ imageStyle: k });
    else if (useShared) shared.setImageStyle(k);
    else setLis(k);
  };

  // Results state
  const [result, setResult] = useState<ContentEngineOutput | null>(null);
  const [unifiedGenMeta, setUnifiedGenMeta] = useState<{
    hadBentley: boolean;
    hadConversion: boolean;
    hadCampaignBrief: boolean;
  } | null>(null);
  const [lastUnifiedSnapshot, setLastUnifiedSnapshot] = useState<Record<string, unknown> | null>(null);
  const [experimentGroupId, setExperimentGroupId] = useState(() =>
    typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `exp-${Date.now()}`
  );
  const [variantTag, setVariantTag] = useState("A");
  const [lastSavedVariantId, setLastSavedVariantId] = useState<string | null>(null);
  /** Phase 4I — next generate POSTs cloneFromVariantId for unified prompt bias. */
  const [cloneFromVariantId, setCloneFromVariantId] = useState<string | null>(null);
  const [savingMemory, setSavingMemory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    onOutputChange?.(result);
    writeCachedContentEngineOutput(result);
  }, [result, onOutputChange]);

  // Expanded sections
  const [expandedSection, setExpandedSection] = useState<string | null>("fullPost");

  const [workflowTick, setWorkflowTick] = useState(0);
  const [useBentleyIntel, setUseBentleyIntel] = useState(true);

  useEffect(() => {
    const onLocal = () => setWorkflowTick((t) => t + 1);
    window.addEventListener("bentley-workflow-updated", onLocal);
    const unsub = subscribeBentleyWorkflowCrossTab(() => setWorkflowTick((t) => t + 1));
    return () => {
      window.removeEventListener("bentley-workflow-updated", onLocal);
      unsub();
    };
  }, []);

  useEffect(() => {
    const onClone = (e: Event) => {
      const ce = e as CustomEvent<{
        variantId?: string;
        experimentGroupId?: string;
        nextVariantTag?: string;
      }>;
      const id = ce.detail?.variantId?.trim();
      if (id) setCloneFromVariantId(id);
      if (typeof ce.detail?.experimentGroupId === "string" && ce.detail.experimentGroupId.trim()) {
        setExperimentGroupId(ce.detail.experimentGroupId.trim());
      }
      if (typeof ce.detail?.nextVariantTag === "string" && ce.detail.nextVariantTag.trim()) {
        setVariantTag(ce.detail.nextVariantTag.trim().slice(0, 16));
      }
    };
    window.addEventListener(BENTLEY_SET_CLONE_VARIANT_EVENT, onClone);
    return () => window.removeEventListener(BENTLEY_SET_CLONE_VARIANT_EVENT, onClone);
  }, []);

  const workflowHandoff = useMemo(
    () => loadWorkflowState().artifacts.bentleySliContentHandoff,
    [workflowTick]
  );
  const hasWorkflowHandoff = Boolean(workflowHandoff);

  async function saveGenerationMemory() {
    if (!result || !lastUnifiedSnapshot) {
      setError("Generate content first so a snapshot is available.");
      return;
    }
    setSavingMemory(true);
    setError(null);
    try {
      const r = await fetch("/api/bentley-social-leads/generation-variants", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentGroupId,
          variantTag,
          engineKind: "content_engine",
          title: `${businessName.slice(0, 80)} · ${variantTag}`,
          unifiedContextSnapshot: lastUnifiedSnapshot,
          generatedOutput: result as unknown as Record<string, unknown>,
        }),
      });
      const data = (await r.json()) as { variant?: { id: string }; error?: string };
      if (!r.ok) throw new Error(data?.error ?? "Save failed");
      setLastSavedVariantId(data.variant?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingMemory(false);
    }
  }

  const generateContent = async () => {
    if (
      !coerceTrimmedString(businessName) ||
      !coerceTrimmedString(industry) ||
      !coerceTrimmedString(targetAudience) ||
      !coerceTrimmedString(coreOffer)
    ) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const bentley =
        useBentleyIntel && hasWorkflowHandoff ? getWorkflowBentleyHandoffForGeneration() : {};
      const { content, unifiedGeneration, unifiedGenerationSnapshot } = await runViralContent({
        businessName,
        industry,
        targetAudience,
        coreOffer,
        transformation,
        tone,
        platform: PLATFORMS.find(p => p.id === platform)?.label || platform,
        contentType,
        ...bentley,
        ...(useBentleyIntel === false ? { useBentleyIntelligence: false } : {}),
        ...(campaignNotesForUnified
          ? { notes: campaignNotesForUnified, campaignNotes: campaignNotesForUnified }
          : {}),
        ...(cloneFromVariantId ? { cloneFromVariantId } : {}),
      });

      setResult(content);
      setLastSavedVariantId(null);
      setCloneFromVariantId(null);
      setLastUnifiedSnapshot(unifiedGenerationSnapshot ?? null);
      setUnifiedGenMeta(
        unifiedGeneration
          ? {
              hadBentley: unifiedGeneration.hadBentley,
              hadConversion: unifiedGeneration.hadConversion,
              hadCampaignBrief: unifiedGeneration.hadCampaignBrief,
            }
          : null
      );
      setExpandedSection("fullPost");
    } catch (err: any) {
      setError(err?.message || "Failed to generate content");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  const copyPromptForApp = async (prompt: string, fieldId: string) => {
    try {
      const res = await fetch("/api/revenue-os/image-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style: imageStyleStr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to format prompt");
      const fullPrompt = data?.fullPrompt ?? prompt;
      await navigator.clipboard.writeText(fullPrompt);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to copy prompt");
    }
  };

  const CopyButton = ({ text, fieldId }: { text: string; fieldId: string }) => (
    <button
      onClick={() => copyToClipboard(text, fieldId)}
      className="p-1.5 rounded hover:bg-white/10 transition-colors"
      title="Copy to clipboard"
    >
      {copiedField === fieldId ? (
        <Check className="w-4 h-4 text-green-400" />
      ) : (
        <Copy className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );

  const SectionHeader = ({
    title,
    icon: Icon,
    sectionId,
    count,
  }: {
    title: string;
    icon: typeof Sparkles;
    sectionId: string;
    count?: number;
  }) => (
    <button
      onClick={() => setExpandedSection(expandedSection === sectionId ? null : sectionId)}
      className="w-full flex items-center justify-between p-4 bg-black/30 rounded-lg hover:bg-black/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" style={{ color: ACCENT }} />
        <span className="font-semibold text-white">{title}</span>
        {count !== undefined && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
            {count}
          </span>
        )}
      </div>
      {expandedSection === sectionId ? (
        <ChevronUp className="w-5 h-5 text-gray-400" />
      ) : (
        <ChevronDown className="w-5 h-5 text-gray-400" />
      )}
    </button>
  );

  return (
    <section className={compact ? "" : "py-8"}>
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/80 via-black/60 to-gray-900/80 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${ACCENT}20` }}
            >
              <Sparkles className="w-6 h-6" style={{ color: ACCENT }} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Content Engine™
              </h2>
              <p className="text-sm text-gray-400">
                Generate viral social media content optimized for attention and conversion
              </p>
            </div>
          </div>
          {hasWorkflowHandoff ? (
            <div className="mt-4 rounded-xl border border-violet-500/35 bg-black/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-violet-300">Bentley-assisted</span>
                <span className="text-slate-400">
                  SLI handoff
                  {workflowHandoff?.handoffId ? (
                    <span className="font-mono text-slate-500"> · {workflowHandoff.handoffId.slice(0, 8)}…</span>
                  ) : null}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
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
                  className="text-rose-300/90 hover:underline"
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
        </div>

        {/* Input Form */}
        <div className="p-6 space-y-6">
          {/* Business Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Business Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                data-bentley-field="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g., Hero Factory"
                className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Industry <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                data-bentley-field="contentIndustry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g., Business Consulting"
                className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Target Audience <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                data-bentley-field="targetAudience"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., Entrepreneurs and small business owners"
                className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Core Offer <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                data-bentley-field="coreOffer"
                value={coreOffer}
                onChange={(e) => setCoreOffer(e.target.value)}
                placeholder="e.g., AI-powered revenue optimization system"
                className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Transformation / Outcome
              </label>
              <input
                type="text"
                data-bentley-field="transformation"
                value={transformation}
                onChange={(e) => setTransformation(e.target.value)}
                placeholder="e.g., Predictable revenue growth and business clarity"
                className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          {/* Platform Selection — primary channel for copy/prompts; on dashboard updates form.platforms[0] */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              {isDashboardCanonical ? "Primary channel (content strategy)" : "Platform"}
            </label>
            {contentPlatformSectionHelper ? (
              <p className="text-xs text-gray-500 mb-2 leading-relaxed">{contentPlatformSectionHelper}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                const isSelected = platform === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/10 text-white"
                        : "border-white/10 bg-black/20 text-gray-400 hover:border-white/30"
                    }`}
                  >
                    <Icon className="w-4 h-4" style={{ color: isSelected ? p.color : undefined }} />
                    <span className="text-sm">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tone Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tone
            </label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                    tone === t
                      ? "border-cyan-500 bg-cyan-500/10 text-white"
                      : "border-white/10 bg-black/20 text-gray-400 hover:border-white/30"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Content Type Focus
            </label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct}
                  onClick={() => setContentType(ct)}
                  className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                    contentType === ct
                      ? "border-cyan-500 bg-cyan-500/10 text-white"
                      : "border-white/10 bg-black/20 text-gray-400 hover:border-white/30"
                  }`}
                >
                  {ct}
                </button>
              ))}
            </div>
          </div>

          {/* Image style appended when copying prompt for external apps */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Image Style (appended when copying for app)
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(THUMBNAIL_STYLES) as Array<keyof typeof THUMBNAIL_STYLES>).map((s) => (
                <button
                  key={s}
                  onClick={() => setImageStyle(s)}
                  className={`px-3 py-1.5 rounded-lg border text-xs capitalize transition-all ${
                    imageStyle === s
                      ? "border-cyan-500 bg-cyan-500/10 text-white"
                      : "border-white/10 bg-black/20 text-gray-400 hover:border-white/30"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {unifiedGenMeta && result && (unifiedGenMeta.hadConversion || unifiedGenMeta.hadBentley || unifiedGenMeta.hadCampaignBrief) ? (
            <div className="rounded-lg border border-cyan-500/35 bg-cyan-950/25 px-3 py-2 text-xs text-cyan-100/90">
              Using unified generation context:{" "}
              {[
                unifiedGenMeta.hadConversion && "conversion performance",
                unifiedGenMeta.hadBentley && "Bentley market intelligence",
                unifiedGenMeta.hadCampaignBrief && "campaign brief in notes",
              ]
                .filter(Boolean)
                .join(" · ")}
              .
            </div>
          ) : null}

          {cloneFromVariantId ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100/90">
              <span>
                Variant optimization: next generate biases toward saved variant{" "}
                <span className="font-mono">{cloneFromVariantId.slice(0, 8)}…</span> (structure &amp; angles).
              </span>
              <button
                type="button"
                onClick={() => setCloneFromVariantId(null)}
                className="shrink-0 underline text-amber-200/90 hover:text-white"
              >
                Clear
              </button>
            </div>
          ) : null}

          {result && lastUnifiedSnapshot ? (
            <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Experiment memory</p>
              <div className="flex flex-wrap gap-2 items-center text-xs">
                <label className="text-slate-400">
                  Variant{" "}
                  <select
                    value={variantTag}
                    onChange={(e) => setVariantTag(e.target.value)}
                    className="ml-1 bg-black/50 border border-white/15 rounded px-2 py-1 text-white"
                  >
                    {["A", "B", "C", "control"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setExperimentGroupId(globalThis.crypto?.randomUUID?.() ?? `exp-${Date.now()}`)}
                  className="text-slate-500 hover:text-slate-300 underline"
                >
                  New experiment id
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingMemory}
                  onClick={() => void saveGenerationMemory()}
                  className="px-3 py-2 rounded-lg bg-violet-600/70 text-white text-xs hover:bg-violet-500/80 disabled:opacity-50"
                >
                  {savingMemory ? "Saving…" : "Save to memory"}
                </button>
                {lastSavedVariantId ? (
                  <span className="text-[10px] text-emerald-400/90 font-mono self-center">
                    Saved variant {lastSavedVariantId.slice(0, 8)}… — link deploy below
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Generate Button */}
          <button
            onClick={generateContent}
            disabled={loading}
            className="w-full py-4 rounded-xl font-semibold text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: loading
                ? "linear-gradient(135deg, #666 0%, #888 100%)"
                : `linear-gradient(135deg, ${ACCENT} 0%, #7DF9FF 50%, ${ACCENT} 100%)`,
            }}
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Generating Content...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Viral Content
              </>
            )}
          </button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-white/10"
            >
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5" style={{ color: ACCENT }} />
                  Generated Content
                </h3>

                <ContentDeployPanel
                  output={result}
                  platformLabel={PLATFORMS.find((p) => p.id === platform)?.label || platform}
                  businessName={businessName}
                  generationVariantId={lastSavedVariantId}
                />

                {/* Full Post Section */}
                <div className="space-y-2">
                  <SectionHeader
                    title="Full Post Ready to Publish"
                    icon={FileText}
                    sectionId="fullPost"
                  />
                  <AnimatePresence>
                    {expandedSection === "fullPost" && result.fullPost && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 bg-black/20 rounded-lg space-y-4"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-400">Caption</span>
                            <CopyButton text={result.fullPost.caption} fieldId="fp-caption" />
                          </div>
                          <p className="text-white font-medium">{result.fullPost.caption}</p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-400">Content</span>
                            <CopyButton text={result.fullPost.content} fieldId="fp-content" />
                          </div>
                          <p className="text-gray-300 whitespace-pre-line">{result.fullPost.content}</p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-400">Visual Prompt</span>
                            <CopyButton text={result.fullPost.visualPrompt} fieldId="fp-visual" />
                          </div>
                          <p className="text-gray-400 text-sm italic bg-black/30 p-3 rounded">
                            {result.fullPost.visualPrompt}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-400">Hashtags</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {result.fullPost.hashtags.map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 text-sm rounded bg-cyan-500/20 text-cyan-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Scroll-Stopping Captions */}
                <div className="space-y-2">
                  <SectionHeader
                    title="Scroll-Stopping Captions"
                    icon={MessageSquare}
                    sectionId="captions"
                    count={5}
                  />
                  <AnimatePresence>
                    {expandedSection === "captions" && result.captions && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 bg-black/20 rounded-lg space-y-3"
                      >
                        {Object.entries(result.captions).map(([style, caption]) => (
                          <div key={style} className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <span className="text-xs uppercase tracking-wider text-cyan-400/80">
                                {style.replace(/([A-Z])/g, " $1").trim()}
                              </span>
                              <p className="text-white mt-1">{caption}</p>
                            </div>
                            <CopyButton text={caption} fieldId={`caption-${style}`} />
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Viral Hooks */}
                <div className="space-y-2">
                  <SectionHeader
                    title="Viral Hooks"
                    icon={Zap}
                    sectionId="hooks"
                    count={result.hooks?.length}
                  />
                  <AnimatePresence>
                    {expandedSection === "hooks" && result.hooks && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 bg-black/20 rounded-lg"
                      >
                        <div className="grid gap-2">
                          {result.hooks.map((hook, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-4 p-2 rounded bg-black/30"
                            >
                              <span className="text-gray-300">{hook}</span>
                              <CopyButton text={hook} fieldId={`hook-${i}`} />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Content Ideas */}
                <div className="space-y-2">
                  <SectionHeader
                    title="Viral Content Ideas"
                    icon={Lightbulb}
                    sectionId="ideas"
                    count={result.viralIdeas?.length}
                  />
                  <AnimatePresence>
                    {expandedSection === "ideas" && result.viralIdeas && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 bg-black/20 rounded-lg space-y-3"
                      >
                        {result.viralIdeas.map((idea, i) => (
                          <div key={i} className="p-3 rounded bg-black/30">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h4 className="font-semibold text-white">{idea.title}</h4>
                                <p className="text-gray-400 text-sm mt-1">{idea.description}</p>
                              </div>
                              <CopyButton
                                text={`${idea.title}\n\n${idea.description}`}
                                fieldId={`idea-${i}`}
                              />
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Image Prompts — copy formatted prompt for external apps (no API cost) */}
                <div className="space-y-2">
                  <SectionHeader
                    title="AI Image Prompts"
                    icon={ImageIcon}
                    sectionId="images"
                    count={result.imagePrompts?.length}
                  />
                  <AnimatePresence>
                    {expandedSection === "images" && result.imagePrompts && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 bg-black/20 rounded-lg space-y-3"
                      >
                        {result.imagePrompts.map((prompt, i) => (
                          <div
                            key={i}
                            className="flex items-start justify-between gap-4 p-3 rounded bg-black/30"
                          >
                            <p className="text-gray-300 text-sm italic flex-1">{prompt}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              <CopyButton text={prompt} fieldId={`img-${i}`} />
                              <button
                                onClick={() => copyPromptForApp(prompt, `img-app-${i}`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                style={{
                                  background: `${ACCENT}20`,
                                  color: ACCENT,
                                  border: `1px solid ${ACCENT}40`,
                                }}
                                title="Copy prompt with style — paste into Midjourney, DALL·E, etc."
                              >
                                {copiedField === `img-app-${i}` ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                {copiedField === `img-app-${i}` ? "Copied!" : "Copy for app"}
                              </button>
                            </div>
                          </div>
                        ))}
                        <p className="text-xs text-gray-500">
                          Copy prompt (with selected style) and paste into Midjourney, DALL·E, Stable Diffusion, Sora, etc. No API cost.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Clipforge Template Presets */}
                <div className="space-y-2">
                  <SectionHeader
                    title="Clipforge Thumbnail Templates"
                    icon={Zap}
                    sectionId="clipforge"
                  />
                  <AnimatePresence>
                    {expandedSection === "clipforge" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 bg-black/20 rounded-lg space-y-3"
                      >
                        <p className="text-xs text-gray-500 mb-2">
                          Quick-copy overlay text presets from Clipforge AI. Use these for thumbnails and short-form video.
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {CLIPFORGE_TEMPLATE_PRESETS.map((t) => (
                            <div
                              key={t.id}
                              className="flex items-center justify-between gap-3 p-3 rounded bg-black/30 hover:bg-black/40 transition-colors"
                            >
                              <div>
                                <div className="text-sm font-medium text-white">{t.name}</div>
                                <div className="text-xs text-gray-500">
                                  {t.overlayText} &middot; {t.description}
                                </div>
                              </div>
                              <CopyButton text={t.overlayText} fieldId={`tpl-${t.id}`} />
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                          <p className="text-xs text-gray-500">
                            From Clipforge AI — video clip & thumbnail workflow.
                          </p>
                          {process.env.NEXT_PUBLIC_CLIPFORGE_URL && (
                            <a
                              href={process.env.NEXT_PUBLIC_CLIPFORGE_URL}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                            >
                              Open Clipforge <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

export default ContentEngineSection;
