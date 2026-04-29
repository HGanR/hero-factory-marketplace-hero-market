"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAiRevenueOsProfile } from "./AiRevenueOsSharedState";
import { runResearch as runResearchApi } from "@/lib/revenue-os/run-research";

const ACCENT = "#00D1FF";

export type ResearchSource = "ads_library" | "reddit" | "tiktok" | "google";

export interface CommentSummary {
  source: string;
  themes: string[];
  sampleComments?: string[];
}

export interface ResearchResult {
  marketOrService: string;
  whatPeopleWant: string[];
  commentsBySource: CommentSummary[];
  marketingTips: string[];
  sourcesSearched: ResearchSource[];
  connectedIntegrations?: string[];
}

export interface ResearchAssistantSectionProps {
  clientId?: string;
  trustId?: string;
  onResult?: (data: ResearchResult) => void;
}

export function ResearchAssistantSection({ clientId, trustId, onResult }: ResearchAssistantSectionProps = {}) {
  const { effectiveIndustryLabel } = useAiRevenueOsProfile();
  const effectiveIndustry = effectiveIndustryLabel;
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!effectiveIndustry) return;
    setInput((prev) => (prev === effectiveIndustry ? prev : effectiveIndustry));
  }, [effectiveIndustry]);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunResearch = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await runResearchApi({
        marketOrService: trimmed,
        clientId,
        trustId,
      });

      setResult(data);
      // Defer lifting result to pipeline until after this component commits local result state.
      queueMicrotask(() => onResult?.(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const sourcesLabel: Record<ResearchSource, string> = {
    ads_library: "Meta Ads Library",
    reddit: "Reddit",
    tiktok: "TikTok",
    google: "Google",
  };

  return (
    <section
      id="research-assistant"
      data-bentley-section="research-assistant"
      className="py-24 bg-black/80"
    >
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-4xl font-bold text-center" style={{ color: ACCENT }}>
          Research Assistant
        </h2>
        <p className="text-gray-400 text-center max-w-2xl mx-auto mt-4">
          Enter your market or service. The assistant scrubs Meta Ads Library,
          Reddit, TikTok, and Google to surface what people want, comment
          themes, and analytical marketing tips.
        </p>

        <div className="mt-10 max-w-2xl mx-auto">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleRunResearch()}
              placeholder="e.g. B2B SaaS, fitness coaching, e-commerce skincare"
              className="flex-1 p-4 rounded-xl bg-slate-800/50 border-2 border-[#D4AF37]/50 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
            />
            <button
              onClick={() => void handleRunResearch()}
              disabled={loading || !input.trim()}
              className="px-6 py-4 rounded-xl font-semibold text-black disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              style={{
                background:
                  "linear-gradient(180deg, #7DF9FF 0%, #D4AF37 50%, #B8860B 100%)",
                boxShadow: "0 4px 0 #B8860B",
              }}
            >
              {loading ? "Searching..." : "Run Research"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
            <span>Sources:</span>
            {(["ads_library", "reddit", "tiktok", "google"] as ResearchSource[]).map(
              (s) => (
                <span key={s} className="px-2 py-0.5 rounded bg-white/5">
                  {sourcesLabel[s]}
                </span>
              )
            )}
          </div>
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
            className="mt-12 space-y-4"
          >
            {result.connectedIntegrations && result.connectedIntegrations.length > 0 && (
              <div className="text-xs text-gray-500">
                Workspace integrations: {result.connectedIntegrations.join(", ")}
              </div>
            )}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-slate-800/50 border border-[#D4AF37]/50 rounded-2xl p-6">
              <div className="text-sm font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
                What People Want
              </div>
              <ul className="mt-4 space-y-2 text-gray-300 text-sm">
                {result.whatPeopleWant.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-[#D4AF37]/50 rounded-2xl p-6 md:col-span-2">
              <div className="text-sm font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
                Comments by Source
              </div>
              <div className="mt-4 space-y-4">
                {result.commentsBySource.map((cs, i) => (
                  <div key={i} className="border-l-2 border-[#D4AF37]/40 pl-4">
                    <div className="text-gray-400 text-xs font-medium">{cs.source}</div>
                    <div className="mt-1 text-gray-300 text-sm">
                      Themes: {cs.themes.join(", ")}
                    </div>
                    {cs.sampleComments && cs.sampleComments.length > 0 && (
                      <div className="mt-2 text-gray-500 text-xs italic">
                        Sample: &quot;{cs.sampleComments[0]}&quot;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 border-2 border-[#D4AF37] rounded-2xl p-6 lg:col-span-3">
              <div className="text-sm font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
                Analytical Marketing Tips
              </div>
              <ul className="mt-4 space-y-2 text-gray-300 text-sm">
                {result.marketingTips.map((tip, i) => (
                  <li key={i}>• {tip}</li>
                ))}
              </ul>
            </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
