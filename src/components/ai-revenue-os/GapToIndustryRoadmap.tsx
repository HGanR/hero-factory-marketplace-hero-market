"use client";

import { motion } from "framer-motion";
import { ArrowRight, AlertCircle } from "lucide-react";
import type { ClientReadinessAnswers } from "./ClientReadinessQuestionnaire";

const ACCENT = "#00D1FF";
const GOLD = "#D4AF37";

export interface GapToIndustryRoadmapProps {
  /** Client's modeled monthly revenue */
  clientRevenue: number;
  /** Industry benchmark revenue */
  industryRevenue: number;
  /** Gap (client - industry); negative = below benchmark */
  gap: number;
  /** Annual impact of closing the gap */
  annualGap: number;
  /** Industry label for display */
  industryLabel: string;
  /** Questionnaire answers for personalized guidance */
  questionnaireAnswers?: ClientReadinessAnswers | null;
}

export function GapToIndustryRoadmap({
  clientRevenue,
  industryRevenue,
  gap,
  annualGap,
  industryLabel,
  questionnaireAnswers,
}: GapToIndustryRoadmapProps) {
  if (gap >= 0) return null;

  const hasWeakSocial = questionnaireAnswers?.socialPresence === "minimal" || questionnaireAnswers?.socialPresence === "none";
  const hasNoPaidAds = !questionnaireAnswers?.advertisingMethods?.includes("paid_ads") && !questionnaireAnswers?.advertisingMethods?.includes("organic_social");
  const hasNoLanding = !questionnaireAnswers?.hasLandingPage;
  const bottleneck = questionnaireAnswers?.biggestBottleneck ?? "traffic";

  const bottleneckHints: Record<string, string> = {
    traffic: "Use Research Assistant to understand what your audience wants, then Trends Library to find high-performing content formats.",
    conversion: "Refine your offer and messaging. Campaign from Notes turns insights into hooks and objection replies.",
    aov: "Focus on offer engineering and upsells. The Campaign generator can suggest higher-ticket angles.",
    awareness: "Start with Research Assistant + Trends Library to identify where your audience spends time, then create content that fits.",
    trust: "Use comment insights from Trends Library to mirror the language your audience uses — builds credibility.",
    offer: "Campaign from Notes generates offer statements and message pillars from your research.",
  };

  const personalizedHint = bottleneckHints[bottleneck] ?? bottleneckHints.traffic;
  const socialHint = hasWeakSocial
    ? "You indicated minimal or no social presence — the Trends Library can show which platforms and formats perform best for your industry."
    : null;
  const paidHint = hasNoPaidAds
    ? "You're not running paid or organic campaigns yet — start with Research Assistant to validate messaging before spending."
    : null;
  const funnelHint = hasNoLanding
    ? "No landing page yet — use the Campaign generator to create hooks and CTAs for your first lead magnet."
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 rounded-2xl border-2 p-6"
      style={{
        backgroundColor: "rgba(0,0,0,0.6)",
        borderColor: "rgba(212,175,55,0.6)",
        boxShadow: "0 0 30px rgba(212,175,55,0.1)",
      }}
    >
      <div className="flex items-start gap-3 mb-6">
        <AlertCircle className="h-6 w-6 flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
        <div>
          <h4 className="text-lg font-semibold" style={{ color: ACCENT }}>
            Gap to {industryLabel} Standard
          </h4>
          <p className="text-gray-400 text-sm mt-1">
            Your modeled revenue is <span className="font-medium text-white">${clientRevenue.toLocaleString()}/mo</span>.
            The {industryLabel} benchmark is <span className="font-medium text-white">${industryRevenue.toLocaleString()}/mo</span>.
            Closing this gap could add <span style={{ color: ACCENT }}>${Math.abs(annualGap).toLocaleString()}/year</span>.
          </p>
        </div>
      </div>

      <p className="text-gray-300 text-sm mb-6">
        Use the AI Revenue Operating System below to build a data-backed roadmap. Start where you are — the tools work even when you&apos;re far from industry norms.
      </p>

      <div className="space-y-4">
        <RoadmapStep
          step={1}
          title="Research Assistant"
          href="#research-assistant"
          description="Enter your market or service. Bentley scrubs Meta Ads, Reddit, TikTok, and Google to surface what people want and comment themes."
        />
        <RoadmapStep
          step={2}
          title="Trends Library"
          href="#trends-library"
          description="Identify trending content across YouTube, TikTok, Reddit. See views, likes, comments, and the top comment insight that drives engagement."
        />
        <RoadmapStep
          step={3}
          title="Consultant Plan & Campaign Brief"
          href="#consultant-plan"
          description="After Trends, the system synthesizes a consultant plan and pre-fills your campaign brief with the top engagement insight."
        />
        <RoadmapStep
          step={4}
          title="Paste Notes → Generate Campaign"
          href="#campaign-from-notes"
          description="Generate offer statement, message pillars, short-form hooks, and objection replies. Optionally create images (DALL·E) or video (Sora coming soon)."
        />
      </div>

      {(personalizedHint || socialHint || paidHint || funnelHint) && (
        <div className="mt-6 pt-6 border-t border-[#00D1FF]/30">
          <h5 className="text-sm font-semibold mb-3" style={{ color: ACCENT }}>
            Personalized guidance
          </h5>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
              {personalizedHint}
            </li>
            {socialHint && (
              <li className="flex items-start gap-2">
                <ArrowRight className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
                {socialHint}
              </li>
            )}
            {paidHint && (
              <li className="flex items-start gap-2">
                <ArrowRight className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
                {paidHint}
              </li>
            )}
            {funnelHint && (
              <li className="flex items-start gap-2">
                <ArrowRight className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
                {funnelHint}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href="#research-assistant"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all hover:scale-[1.02]"
          style={{
            background: "linear-gradient(180deg, #F5C518 0%, #00D1FF 50%, #B8860B 100%)",
            color: "black",
            boxShadow: "0 2px 0 #B8860B",
          }}
        >
          Start with Research Assistant
          <ArrowRight className="h-4 w-4" />
        </a>
        <a
          href="#trends-library"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm border-2 transition-all"
          style={{ borderColor: GOLD, color: GOLD }}
        >
          Jump to Trends Library
        </a>
      </div>
    </motion.div>
  );
}

function RoadmapStep({
  step,
  title,
  href,
  description,
}: {
  step: number;
  title: string;
  href: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="flex gap-4 p-4 rounded-xl border border-[#00D1FF]/30 hover:border-[#00D1FF]/60 hover:bg-[#00D1FF]/5 transition-all group"
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-black"
        style={{
          background: "linear-gradient(180deg, #F5C518 0%, #00D1FF 100%)",
          boxShadow: "0 2px 0 #B8860B",
        }}
      >
        {step}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-white group-hover:text-[#00D1FF] transition-colors">{title}</div>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>
      <ArrowRight className="h-5 w-5 flex-shrink-0 text-gray-500 group-hover:text-[#00D1FF] group-hover:translate-x-1 transition-all" />
    </a>
  );
}
