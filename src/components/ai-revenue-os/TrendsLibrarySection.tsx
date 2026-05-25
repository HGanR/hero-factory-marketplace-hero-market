"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink,
  TrendingUp,
  Youtube,
  MessageCircle,
  Video,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  FileText,
  AlertTriangle,
  Wand2,
  Copy,
  Check,
  Twitter,
} from "lucide-react";
import type {
  TrendsResponse,
  TrendItem,
  ContentBlueprint,
} from "@/lib/revenue-os/trends-schema";
import { runTrends as runTrendsApi } from "@/lib/revenue-os/run-trends";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import { loadWorkflowState, subscribeBentleyWorkflowCrossTab } from "@/lib/revenue-os/bentley-workflow";
import {
  clearWorkflowBentleyHandoff,
  getWorkflowBentleyHandoffForGeneration,
} from "@/lib/revenue-os/bentley-workflow-handoff-client";

const ACCENT = "#00D1FF";
const GOLD = "#D4AF37";
const PLATFORM_ICONS: Record<string, typeof Youtube> = {
  youtube: Youtube,
  tiktok: Video,
  reddit: MessageCircle,
  x: Twitter,
  twitter: Twitter,
};
const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  reddit: "Reddit",
  x: "X",
  twitter: "X (Twitter)",
};
const PLATFORM_COLORS: Record<string, string> = {
  youtube: "#FF0000",
  tiktok: "#000000",
  reddit: "#FF4500",
  x: "#1DA1F2",
  twitter: "#1DA1F2",
};

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  try {
    return Intl.NumberFormat().format(n);
  } catch {
    return String(n);
  }
}

/** Extract embed URL for YouTube or TikTok when item has a direct video URL */
function getVideoEmbedUrl(url: string, platform: string): string | null {
  if (!url) return null;
  try {
    if (platform === "youtube") {
      const m1 = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (m1) return `https://www.youtube.com/embed/${m1[1]}`;
    }
    if (platform === "tiktok") {
      const m2 = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
      if (m2) return `https://www.tiktok.com/embed/v2/${m2[1]}`;
    }
  } catch {
    // ignore
  }
  return null;
}

export interface TrendsLibraryCanonicalDashboardFields {
  industry: string;
  targetAudience: string;
  onIndustryChange: (v: string) => void;
  onTargetAudienceChange: (v: string) => void;
}

export interface TrendsLibrarySectionProps {
  defaultIndustry?: string;
  defaultTargetAudience?: string;
  compact?: boolean;
  clientId?: string;
  trustId?: string;
  onTrendsResult?: (data: TrendsResponse) => void;
  /**
   * When set (e.g. `/revenue-os/dashboard`), industry/audience inputs read/write dashboard `form`
   * so they stay aligned with Content Engine + Campaign + Bentley mirror.
   */
  canonicalDashboardFields?: TrendsLibraryCanonicalDashboardFields;
}

function TrendsLibrarySectionInner({
  defaultIndustry = "",
  defaultTargetAudience = "",
  compact = false,
  clientId,
  trustId,
  onTrendsResult,
  canonicalDashboardFields,
}: TrendsLibrarySectionProps) {
  const [localIndustry, setLocalIndustry] = useState(defaultIndustry);
  const [localTargetAudience, setLocalTargetAudience] = useState(defaultTargetAudience);

  const industry = canonicalDashboardFields
    ? canonicalDashboardFields.industry
    : localIndustry;
  const setIndustry = canonicalDashboardFields
    ? canonicalDashboardFields.onIndustryChange
    : setLocalIndustry;

  const targetAudience = canonicalDashboardFields
    ? canonicalDashboardFields.targetAudience
    : localTargetAudience;
  const setTargetAudience = canonicalDashboardFields
    ? canonicalDashboardFields.onTargetAudienceChange
    : setLocalTargetAudience;

  const industryText = coerceTrimmedString(industry);
  const targetAudienceText = coerceTrimmedString(targetAudience);

  useEffect(() => {
    if (canonicalDashboardFields) return;
    if (!defaultIndustry) return;
    setLocalIndustry((prev) => (prev === defaultIndustry ? prev : defaultIndustry));
  }, [defaultIndustry, canonicalDashboardFields]);
  useEffect(() => {
    if (canonicalDashboardFields) return;
    if (!defaultTargetAudience) return;
    setLocalTargetAudience((prev) => (prev === defaultTargetAudience ? prev : defaultTargetAudience));
  }, [defaultTargetAudience, canonicalDashboardFields]);
  const [result, setResult] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundle, setBundle] = useState<{
    soraPrompt: string;
    hedraPrompt: string;
    voiceoverScript: string;
    onScreenText: string[];
    scenes: string[];
    caption: string;
    hashtags: string[];
    cta: string;
  } | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [bundlePlatform, setBundlePlatform] = useState<"tiktok" | "youtube_shorts" | "youtube_long">("tiktok");
  const [bundleDuration, setBundleDuration] = useState(30);
  const [bundleBaseIndex, setBundleBaseIndex] = useState(0);
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

  const workflowHandoff = useMemo(
    () => loadWorkflowState().artifacts.bentleySliContentHandoff,
    [workflowTick]
  );
  const hasWorkflowHandoff = Boolean(workflowHandoff);

  const runTrends = async () => {
    const trimmedIndustry = industryText;
    if (!trimmedIndustry) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const bentley =
        useBentleyIntel && hasWorkflowHandoff ? getWorkflowBentleyHandoffForGeneration() : {};
      const data = await runTrendsApi({
        industry: trimmedIndustry,
        targetAudience: targetAudienceText || "general audience",
        clientId,
        trustId,
        ...bentley,
        ...(useBentleyIntel === false ? { useBentleyIntelligence: false } : {}),
      });
      setResult(data);
      setBundle(null);
      setBundleError(null);
      onTrendsResult?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  async function generateBundle() {
    if (!result?.items?.length) return;
    const item = result.items[bundleBaseIndex];
    if (!item) return;

    setBundleLoading(true);
    setBundleError(null);
    setBundle(null);
    try {
      const bentley =
        useBentleyIntel && hasWorkflowHandoff ? getWorkflowBentleyHandoffForGeneration() : {};
      const res = await fetch("/api/trends/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerName: industryText || "AI Revenue OS",
          platform: bundlePlatform,
          durationSec: bundleDuration,
          voice: "authoritative",
          trends: [
            {
              platform: item.platform,
              title: item.title,
              description: item.summary || item.whyTrending,
              summary: item.summary,
              whyTrending: item.whyTrending,
              tags: item.tags ?? [],
            },
          ],
          ...bentley,
          ...(useBentleyIntel === false ? { useBentleyIntelligence: false } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Generation failed");
      setBundle(data);
    } catch (e) {
      setBundleError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBundleLoading(false);
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }

  return (
    <section
      id="trends-library"
      data-bentley-section="trends-library"
      className={`py-24 bg-black/80 ${compact ? "py-12" : ""}`}
    >
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-4xl font-bold text-center" style={{ color: ACCENT }}>
          Trends Library
        </h2>
        <p className="text-gray-400 text-center max-w-2xl mx-auto mt-4">
          Search current trends and popular content across YouTube, TikTok, and Reddit.
          Identify top-performing videos, posts, and discussions from the past month.
          Shape your campaign strategy based on what&apos;s resonating in the market.
        </p>

        {hasWorkflowHandoff ? (
          <div className="mt-6 max-w-2xl mx-auto rounded-xl border border-violet-500/40 bg-slate-900/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-violet-300">Bentley-assisted</span>
              <span className="text-slate-400">
                Seeded by SLI handoff
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

        <div className="mt-10 max-w-2xl mx-auto space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Client industry
            </label>
            <input
              value={industryText}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. B2B SaaS, fitness coaching, e-commerce skincare"
              className="w-full p-4 rounded-xl bg-slate-800/50 border-2 border-[#00D1FF]/50 text-white placeholder-gray-500 focus:outline-none focus:border-[#00D1FF]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Target audience
            </label>
            <input
              value={targetAudienceText}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. SMB owners, Gen Z fitness enthusiasts, skincare-conscious women 25-40"
              className="w-full p-4 rounded-xl bg-slate-800/50 border-2 border-[#00D1FF]/50 text-white placeholder-gray-500 focus:outline-none focus:border-[#00D1FF]"
            />
          </div>
          <button
            onClick={runTrends}
            disabled={loading || !industryText}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-black disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            style={{
              background:
                "linear-gradient(180deg, #7DF9FF 0%, #00D1FF 50%, #B8860B 100%)",
              boxShadow: "0 4px 0 #B8860B",
            }}
          >
            {loading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Searching YouTube, TikTok, Reddit…
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Identify Trending Content
              </>
            )}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
          <TrendingUp className="h-4 w-4" />
          <span>
            Powered by Bentley • Editable by admins at{" "}
            <a
              href="/admin/npc/knowledge?npcId=ai-revenue-trends"
              className="text-[#00D1FF] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Admin → NPC Knowledge
            </a>
          </span>
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
                Results for <span style={{ color: ACCENT }}>{result.industry}</span>
                {result.targetAudience && <> · {result.targetAudience}</>}
              </div>
              <div className="flex items-center gap-3">
                {(() => {
                  const ci = (result as TrendsResponse & { connectedIntegrations?: string[] }).connectedIntegrations;
                  return ci && ci.length > 0 ? (
                    <span className="text-xs text-gray-500">Workspace: {ci.join(", ")}</span>
                  ) : null;
                })()}
                <span className="text-xs text-gray-500">
                  Generated {new Date(result.generatedAt).toLocaleString()}
                </span>
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

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {result.items.map((item, i) => (
                <TrendCard
                  key={`${item.platform}-${i}`}
                  item={item}
                  index={i}
                  expanded={expandedId === `item-${i}`}
                  onToggle={() =>
                    setExpandedId((id) =>
                      id === `item-${i}` ? null : `item-${i}`
                    )
                  }
                />
              ))}
            </div>

            {result.campaignAngles && result.campaignAngles.length > 0 && (
              <div
                className="rounded-2xl border p-6"
                style={{
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderColor: "rgba(212,175,55,0.5)",
                }}
              >
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: ACCENT }}>
                  <Lightbulb className="h-5 w-5" />
                  Campaign Angles
                </h3>
                <ul className="space-y-2">
                  {result.campaignAngles.map((angle, i) => (
                    <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                      <span style={{ color: ACCENT }}>•</span>
                      {angle}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.contentBlueprints && result.contentBlueprints.length > 0 && (
              <div
                className="rounded-2xl border p-6"
                style={{
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderColor: "rgba(212,175,55,0.5)",
                }}
              >
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: ACCENT }}>
                  <FileText className="h-5 w-5" />
                  Content Blueprints
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {result.contentBlueprints.map((bp, i) => (
                    <ContentBlueprintCard key={i} blueprint={bp} />
                  ))}
                </div>
              </div>
            )}

            <ContentBundleGenerator
              result={result}
              industry={industry}
              bundleBaseIndex={bundleBaseIndex}
              setBundleBaseIndex={setBundleBaseIndex}
              bundlePlatform={bundlePlatform}
              setBundlePlatform={setBundlePlatform}
              bundleDuration={bundleDuration}
              setBundleDuration={setBundleDuration}
              generateBundle={generateBundle}
              bundleLoading={bundleLoading}
              bundle={bundle}
              bundleError={bundleError}
              copyToClipboard={copyToClipboard}
              copiedField={copiedField}
            />

            <p className="text-center text-gray-500 text-sm">
              Use these insights to shape campaign messaging, creative formats,
              and channel strategy. Links open platform search for deeper
              exploration.
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
}

/** Prop-driven only (no shared context) — memo avoids re-rendering the whole trends grid when unrelated pipeline/context state updates. */
export const TrendsLibrarySection = memo(TrendsLibrarySectionInner);
TrendsLibrarySection.displayName = "TrendsLibrarySection";

function TrendCard({
  item,
  index,
  expanded,
  onToggle,
}: {
  item: TrendItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = PLATFORM_ICONS[item.platform] ?? Video;
  const label = PLATFORM_LABELS[item.platform] ?? item.platform;
  const color = PLATFORM_COLORS[item.platform] ?? ACCENT;
  const bodyText = item.whyTrending || item.summary || "";
  const embedUrl = getVideoEmbedUrl(item.url, item.platform);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl border overflow-hidden transition-all hover:border-[#00D1FF]/60"
      style={{
        backgroundColor: "rgba(0,0,0,0.6)",
        borderColor: "rgba(212,175,55,0.5)",
      }}
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {label}
              </span>
              {item.engagement && typeof item.engagement === "object" && (
                <span className="text-xs text-gray-500">
                  {item.engagement.isEstimated ? "Estimated" : "Observed"}
                  {item.engagement.confidence
                    ? ` · ${item.engagement.confidence}`
                    : ""}
                </span>
              )}
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 font-semibold text-white hover:underline line-clamp-2 flex items-center gap-1"
            >
              {item.title}
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
            {item.publishedAt && (
              <div className="mt-2 text-xs text-gray-500">{item.publishedAt}</div>
            )}
          </div>
        </div>

        {embedUrl && (
          <div className="mt-4 rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-video">
            <iframe
              src={embedUrl}
              title={item.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        )}

        {bodyText && (
          <p className="mt-4 text-sm text-gray-300 leading-relaxed">
            {bodyText}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[#00D1FF]/30 bg-[#00D1FF]/5 px-2.5 py-1 text-gray-300">
            Views: {fmt((item.engagement as { views?: number | null })?.views ?? null)}
          </span>
          <span className="rounded-full border border-[#00D1FF]/30 bg-[#00D1FF]/5 px-2.5 py-1 text-gray-300">
            Likes: {fmt((item.engagement as { likes?: number | null })?.likes ?? null)}
          </span>
          <span className="rounded-full border border-[#00D1FF]/30 bg-[#00D1FF]/5 px-2.5 py-1 text-gray-300">
            Comments: {fmt((item.engagement as { comments?: number | null })?.comments ?? null)}
          </span>
        </div>

        {item.tags && item.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.slice(0, 6).map((tag, j) => (
              <span
                key={j}
                className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {item.commentInsights && item.commentInsights.length > 0 && (
          <>
            <button
              onClick={onToggle}
              className="mt-4 flex items-center gap-1 text-sm font-medium transition-colors"
              style={{ color: ACCENT }}
            >
              Key insights from comments
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {expanded && (
              <ul className="mt-2 space-y-1.5 pl-4 border-l-2 border-[#00D1FF]/40">
                {item.commentInsights.map((insight, j) => (
                  <li key={j} className="text-sm text-gray-400 italic">
                    &quot;{insight}&quot;
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium hover:underline"
          style={{ color: ACCENT }}
        >
          View on {label}
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </motion.div>
  );
}

function ContentBundleGenerator({
  result,
  industry,
  bundleBaseIndex,
  setBundleBaseIndex,
  bundlePlatform,
  setBundlePlatform,
  bundleDuration,
  setBundleDuration,
  generateBundle,
  bundleLoading,
  bundle,
  bundleError,
  copyToClipboard,
  copiedField,
}: {
  result: TrendsResponse | null;
  industry: string;
  bundleBaseIndex: number;
  setBundleBaseIndex: (i: number) => void;
  bundlePlatform: "tiktok" | "youtube_shorts" | "youtube_long";
  setBundlePlatform: (p: "tiktok" | "youtube_shorts" | "youtube_long") => void;
  bundleDuration: number;
  setBundleDuration: (d: number) => void;
  generateBundle: () => void;
  bundleLoading: boolean;
  bundle: {
    soraPrompt: string;
    hedraPrompt: string;
    voiceoverScript: string;
    onScreenText: string[];
    scenes: string[];
    caption: string;
    hashtags: string[];
    cta: string;
  } | null;
  bundleError: string | null;
  copyToClipboard: (text: string, field: string) => void;
  copiedField: string | null;
}) {
  if (!result?.items?.length) return null;

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button
      type="button"
      onClick={() => copyToClipboard(text, field)}
      className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white"
      title="Copy"
    >
      {copiedField === field ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );

  const Block = ({
    label,
    value,
    field,
    mono = false,
  }: {
    label: string;
    value: string | string[];
    field: string;
    mono?: boolean;
  }) => {
    const text = Array.isArray(value) ? value.join("\n") : value;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
          <CopyBtn text={text} field={field} />
        </div>
        <pre
          className={`text-sm p-3 rounded-lg overflow-x-auto max-h-40 overflow-y-auto ${
            mono ? "font-mono text-gray-300 bg-black/40" : "text-gray-300"
          }`}
          style={{ borderColor: "rgba(212,175,55,0.2)" }}
        >
          {Array.isArray(value) ? value.join("\n") : value}
        </pre>
      </div>
    );
  };

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        backgroundColor: "rgba(0,0,0,0.6)",
        borderColor: "rgba(212,175,55,0.5)",
      }}
    >
      <h3 className="flex items-center gap-2 text-lg font-semibold mb-2" style={{ color: ACCENT }}>
        <Wand2 className="h-5 w-5" />
        Generate Content Bundle
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        Extract repeatable performance variables and turn them into a content spec + generator prompt.
        Paste into Sora, Hedra, or use for posting.
      </p>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Base trend</label>
          <select
            value={bundleBaseIndex}
            onChange={(e) => setBundleBaseIndex(Number(e.target.value))}
            className="w-full rounded-lg border bg-slate-800/50 px-3 py-2 text-sm"
            style={{ borderColor: "rgba(212,175,55,0.4)" }}
          >
            {result.items.map((item, i) => (
              <option key={i} value={i}>
                {item.title.length > 50 ? item.title.slice(0, 47) + "…" : item.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Platform</label>
          <select
            value={bundlePlatform}
            onChange={(e) => setBundlePlatform(e.target.value as "tiktok" | "youtube_shorts" | "youtube_long")}
            className="w-full rounded-lg border bg-slate-800/50 px-3 py-2 text-sm"
            style={{ borderColor: "rgba(212,175,55,0.4)" }}
          >
            <option value="tiktok">TikTok</option>
            <option value="youtube_shorts">YouTube Shorts</option>
            <option value="youtube_long">YouTube Long</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Duration</label>
          <select
            value={bundleDuration}
            onChange={(e) => setBundleDuration(Number(e.target.value))}
            className="w-full rounded-lg border bg-slate-800/50 px-3 py-2 text-sm"
            style={{ borderColor: "rgba(212,175,55,0.4)" }}
          >
            <option value={15}>15s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
            <option value={90}>90s</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={generateBundle}
        disabled={bundleLoading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: GOLD,
          color: "black",
        }}
      >
        {bundleLoading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            Generate Content Bundle
          </>
        )}
      </button>

      {bundleError && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {bundleError}
        </div>
      )}

      {bundle && (
        <div className="mt-6 space-y-4">
          <Block label="Sora prompt" value={bundle.soraPrompt} field="sora" mono />
          <Block label="Hedra prompt" value={bundle.hedraPrompt} field="hedra" mono />
          <Block label="Voiceover script" value={bundle.voiceoverScript} field="script" />
          <Block label="On-screen text" value={bundle.onScreenText} field="onscreen" />
          <Block label="Scenes" value={bundle.scenes} field="scenes" />
          <Block label="Caption" value={bundle.caption} field="caption" />
          <Block label="Hashtags" value={bundle.hashtags.join(" ")} field="hashtags" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">CTA:</span>
            <span className="text-gray-300">{bundle.cta}</span>
            <CopyBtn text={bundle.cta} field="cta" />
          </div>
        </div>
      )}
    </div>
  );
}

function ContentBlueprintCard({ blueprint }: { blueprint: ContentBlueprint }) {
  const label = blueprint.platform
    ? PLATFORM_LABELS[blueprint.platform] ?? blueprint.platform
    : null;

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.4)",
        borderColor: "rgba(212,175,55,0.3)",
      }}
    >
      {label && (
        <div className="text-xs font-medium uppercase text-gray-500 mb-2">
          {label}
        </div>
      )}
      <div className="space-y-2 text-sm text-gray-300">
        {blueprint.format && (
          <div>
            <span className="text-gray-500">Format:</span> {blueprint.format}
          </div>
        )}
        {blueprint.hook && (
          <div>
            <span className="text-gray-500">Hook:</span> {blueprint.hook}
          </div>
        )}
        {blueprint.cta && (
          <div>
            <span className="text-gray-500">CTA:</span> {blueprint.cta}
          </div>
        )}
        {blueprint.notes && (
          <div className="text-gray-400 text-xs italic">{blueprint.notes}</div>
        )}
      </div>
    </div>
  );
}
