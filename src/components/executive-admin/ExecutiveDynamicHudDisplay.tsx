"use client";

import type { ReactNode } from "react";
import { executiveCommandPromptLabel, type ExecutiveCommandPromptId } from "@/lib/executive-agent/executive-command-prompts";
import type { HudTransitionTokens } from "@/lib/executive-agent/executive-hud-transition-engine";
import { ExecutiveHudTransitionLayer } from "./ExecutiveHudTransitionLayer";

type Props = {
  activePromptId: ExecutiveCommandPromptId | null;
  summary?: string | null;
  children: ReactNode;
  hudTransition?: HudTransitionTokens;
  hudStyle?: Record<string, string | number>;
};

export function ExecutiveDynamicHudDisplay({
  activePromptId,
  summary,
  children,
  hudTransition,
  hudStyle,
}: Props) {
  const hasModule = activePromptId != null;
  const transition = hudTransition ?? {
    phase: hasModule ? "active" : "idle",
    overlayOpacity: hasModule ? 0.12 : 0.08,
    contentTranslateY: 0,
    scanActive: false,
    hologramShift: hasModule ? 0.25 : 0,
    borderGlow: hasModule ? 0.35 : 0.25,
  };
  const style = hudStyle ?? {};

  const header = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#00A3FF]/90">Dynamic HUD</p>
        <span className="rounded-full border border-[#00A3FF]/25 bg-[#00050A]/80 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-slate-400">
          {hasModule ? executiveCommandPromptLabel(activePromptId) : "Standby"}
        </span>
      </div>
      {!summary?.trim() && !hasModule ? (
        <p className="mt-2 text-sm text-slate-500">Select a command prompt or speak to Skipper.</p>
      ) : null}
    </>
  );

  const emptyState = (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 text-center">
      <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#00A3FF]/50 to-transparent" />
      <p className="text-[11px] uppercase tracking-[0.24em] text-[#00A3FF]/50">Awaiting command</p>
      <p className="max-w-sm text-xs text-slate-500">Select a command prompt or speak to Skipper.</p>
    </div>
  );

  return (
    <ExecutiveHudTransitionLayer
      transition={transition}
      style={style}
      promptKey={activePromptId}
      summary={summary}
      header={header}
      emptyState={emptyState}
      hasModule={hasModule}
    >
      {children}
    </ExecutiveHudTransitionLayer>
  );
}
