"use client";

import { useMemo } from "react";
import type { SocialPlatform } from "@/lib/social/config";
import {
  computeStrategyPostingAlignmentWithNextAction,
  type StrategyPostingAlignmentKind,
} from "@/lib/revenue-os/strategy-posting-alignment";

const KIND_STYLES: Record<
  StrategyPostingAlignmentKind,
  { border: string; bg: string; heading: string }
> = {
  aligned: {
    border: "border-emerald-500/45",
    bg: "bg-emerald-950/25",
    heading: "text-emerald-200/95",
  },
  partial: {
    border: "border-amber-500/45",
    bg: "bg-amber-950/20",
    heading: "text-amber-100/95",
  },
  none: {
    border: "border-rose-500/40",
    bg: "bg-rose-950/20",
    heading: "text-rose-100/90",
  },
  no_compare: {
    border: "border-slate-500/35",
    bg: "bg-slate-900/50",
    heading: "text-slate-300/95",
  },
};

type Props = {
  platforms: string[];
  postingPlatforms: SocialPlatform[];
  /** From GET /api/social/accounts — drives “Connect … to publish” when aligned. Defaults to []. */
  connectedAccounts?: { platform: string; platformCanonical?: SocialPlatform | null }[];
  /** Tighter padding and text for the OAuth panel strip */
  variant?: "default" | "compact";
};

export function StrategyPostingAlignmentBadge({
  platforms,
  postingPlatforms,
  connectedAccounts = [],
  variant = "default",
}: Props) {
  const a = useMemo(
    () =>
      computeStrategyPostingAlignmentWithNextAction(
        platforms,
        postingPlatforms,
        connectedAccounts
      ),
    [platforms, postingPlatforms, connectedAccounts]
  );
  const st = KIND_STYLES[a.kind];
  const pad = variant === "compact" ? "px-3 py-2 mt-2" : "px-3 py-2.5 mt-3";
  const textSm = variant === "compact" ? "text-[11px]" : "text-xs";

  return (
    <div
      className={`rounded-lg border ${st.border} ${st.bg} ${pad}`}
      role="status"
      aria-live="polite"
      title="Informational only — does not change checkboxes"
    >
      <div className={`text-xs font-semibold ${st.heading}`}>{a.title}</div>
      <p className={`${textSm} text-slate-400 mt-1 leading-relaxed`}>{a.detail}</p>
      <p
        className={`${textSm} mt-2 pt-2 border-t border-white/10 text-cyan-100/90 leading-relaxed font-medium`}
      >
        <span className="text-slate-500 font-normal">Recommended next step · </span>
        {a.nextAction}
      </p>
    </div>
  );
}
