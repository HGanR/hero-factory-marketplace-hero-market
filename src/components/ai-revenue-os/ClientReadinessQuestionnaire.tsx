"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

const ACCENT = "#00D1FF";

export type AdvertisingMethod = "paid_ads" | "organic_social" | "email" | "seo" | "referrals" | "events" | "none" | "other";
export type SocialPresence = "strong" | "moderate" | "minimal" | "none";
export type FunnelStage = "awareness" | "consideration" | "decision" | "post_sale" | "undefined";

export interface ClientReadinessAnswers {
  /** Target audience description */
  targetAudience: string;
  /** Primary advertising channels */
  advertisingMethods: AdvertisingMethod[];
  /** Social media presence level */
  socialPresence: SocialPresence;
  /** Which platforms are actively used */
  socialPlatforms: string[];
  /** Has landing page / lead magnet */
  hasLandingPage: boolean;
  /** Has email nurture sequence */
  hasEmailSequence: boolean;
  /** Which funnel stage is weakest */
  weakestFunnelStage: FunnelStage;
  /** Self-identified biggest bottleneck */
  biggestBottleneck: "traffic" | "conversion" | "aov" | "awareness" | "trust" | "offer";
  /** Additional notes */
  notes: string;
}

const AD_METHODS: { value: AdvertisingMethod; label: string }[] = [
  { value: "paid_ads", label: "Paid ads (Meta, Google)" },
  { value: "organic_social", label: "Organic social" },
  { value: "email", label: "Email marketing" },
  { value: "seo", label: "SEO / content" },
  { value: "referrals", label: "Referrals / word of mouth" },
  { value: "events", label: "Events / webinars" },
  { value: "none", label: "None / just getting started" },
  { value: "other", label: "Other" },
];

const SOCIAL_PRESENCE_OPTIONS: { value: SocialPresence; label: string }[] = [
  { value: "strong", label: "Strong — regular posting, engaged audience" },
  { value: "moderate", label: "Moderate — some presence, inconsistent" },
  { value: "minimal", label: "Minimal — accounts exist but little activity" },
  { value: "none", label: "None — no social presence yet" },
];

const SOCIAL_PLATFORMS = ["LinkedIn", "Instagram", "YouTube", "TikTok", "X (Twitter)", "Facebook", "Other"];

const FUNNEL_STAGES: { value: FunnelStage; label: string }[] = [
  { value: "awareness", label: "Awareness — getting noticed" },
  { value: "consideration", label: "Consideration — building interest" },
  { value: "decision", label: "Decision — closing the sale" },
  { value: "post_sale", label: "Post-sale — retention & upsells" },
  { value: "undefined", label: "Not sure yet" },
];

const BOTTLENECKS: { value: ClientReadinessAnswers["biggestBottleneck"]; label: string }[] = [
  { value: "traffic", label: "Traffic — not enough visitors" },
  { value: "conversion", label: "Conversion — visitors don't buy" },
  { value: "aov", label: "AOV — need higher ticket / upsells" },
  { value: "awareness", label: "Awareness — people don't know us" },
  { value: "trust", label: "Trust — credibility concerns" },
  { value: "offer", label: "Offer — value prop unclear" },
];

export interface ClientReadinessQuestionnaireProps {
  answers: ClientReadinessAnswers;
  onChange: (answers: ClientReadinessAnswers) => void;
  compact?: boolean;
}

const DEFAULT_ANSWERS: ClientReadinessAnswers = {
  targetAudience: "",
  advertisingMethods: [],
  socialPresence: "moderate",
  socialPlatforms: [],
  hasLandingPage: false,
  hasEmailSequence: false,
  weakestFunnelStage: "undefined",
  biggestBottleneck: "traffic",
  notes: "",
};

export function ClientReadinessQuestionnaire({
  answers,
  onChange,
  compact = false,
}: ClientReadinessQuestionnaireProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (patch: Partial<ClientReadinessAnswers>) => {
    onChange({ ...answers, ...patch });
  };

  const toggleAdMethod = (m: AdvertisingMethod) => {
    const next = answers.advertisingMethods.includes(m)
      ? answers.advertisingMethods.filter((x) => x !== m)
      : [...answers.advertisingMethods, m];
    update({ advertisingMethods: next });
  };

  const togglePlatform = (p: string) => {
    const next = answers.socialPlatforms.includes(p)
      ? answers.socialPlatforms.filter((x) => x !== p)
      : [...answers.socialPlatforms, p];
    update({ socialPlatforms: next });
  };

  const hasAnyAnswers =
    coerceTrimmedString(answers.targetAudience).length > 0 ||
    answers.advertisingMethods.length > 0 ||
    answers.socialPresence !== "moderate" ||
    answers.socialPlatforms.length > 0 ||
    answers.hasLandingPage ||
    answers.hasEmailSequence ||
    answers.weakestFunnelStage !== "undefined" ||
    coerceTrimmedString(answers.notes).length > 0;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        borderColor: "rgba(212,175,55,0.4)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" style={{ color: ACCENT }} />
          <span className="font-semibold" style={{ color: ACCENT }}>
            Client Readiness Questionnaire
          </span>
          {hasAnyAnswers && (
            <span className="text-xs text-gray-500">— helps identify weaknesses & shape roadmap</span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="px-4 pb-6 space-y-6 border-t border-[cyan-500]/30"
        >
          <p className="text-sm text-gray-400 pt-4">
            Answer these to get a personalized roadmap. Your data drives the revenue model; this helps the AI Revenue OS guide you toward increases.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Target Audience</label>
            <input
              type="text"
              value={answers.targetAudience}
              onChange={(e) => update({ targetAudience: e.target.value })}
              placeholder="e.g., Entrepreneurs and small business owners"
              className="w-full max-w-md p-3 rounded-xl bg-black/50 border border-[cyan-500]/50 text-white placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Advertising methods currently used</label>
            <div className="flex flex-wrap gap-2">
              {AD_METHODS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleAdMethod(opt.value)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    answers.advertisingMethods.includes(opt.value)
                      ? "bg-cyan-500/20 border border-cyan-500/60"
                      : "bg-black/40 border border-white/10 text-gray-400 hover:border-cyan-500/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Social media presence</label>
            <select
              value={answers.socialPresence}
              onChange={(e) => update({ socialPresence: e.target.value as SocialPresence })}
              className="w-full max-w-md p-3 rounded-xl bg-black/50 border border-[cyan-500]/50 text-white"
            >
              {SOCIAL_PRESENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Platforms you use (select all)</label>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    answers.socialPlatforms.includes(p)
                      ? "bg-cyan-500/20 border border-cyan-500/60"
                      : "bg-black/40 border border-white/10 text-gray-400 hover:border-cyan-500/40"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={answers.hasLandingPage}
                onChange={(e) => update({ hasLandingPage: e.target.checked })}
                className="rounded border-[cyan-500]/50 accent-cyan-500"
              />
              Has landing page / lead magnet
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={answers.hasEmailSequence}
                onChange={(e) => update({ hasEmailSequence: e.target.checked })}
                className="rounded border-[cyan-500]/50 accent-cyan-500"
              />
              Has email nurture sequence
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Weakest funnel stage</label>
            <select
              value={answers.weakestFunnelStage}
              onChange={(e) => update({ weakestFunnelStage: e.target.value as FunnelStage })}
              className="w-full max-w-md p-3 rounded-xl bg-black/50 border border-[cyan-500]/50 text-white"
            >
              {FUNNEL_STAGES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Biggest bottleneck right now</label>
            <select
              value={answers.biggestBottleneck}
              onChange={(e) => update({ biggestBottleneck: e.target.value as ClientReadinessAnswers["biggestBottleneck"] })}
              className="w-full max-w-md p-3 rounded-xl bg-black/50 border border-[cyan-500]/50 text-white"
            >
              {BOTTLENECKS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Additional context (optional)</label>
            <textarea
              value={answers.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="e.g. Just launched, no paid ads yet; focusing on LinkedIn..."
              className="w-full p-3 rounded-xl bg-black/50 border border-[cyan-500]/50 text-white placeholder-gray-500 min-h-[80px]"
              rows={3}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}

export { DEFAULT_ANSWERS };
