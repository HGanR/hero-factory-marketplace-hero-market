"use client";

import type { ReactNode } from "react";
import { executiveCommandPromptLabel, type ExecutiveCommandPromptId } from "@/lib/executive-agent/executive-command-prompts";

type Props = {
  activePromptId: ExecutiveCommandPromptId | null;
  summary?: string | null;
  children: ReactNode;
};

export function ExecutiveDynamicHudDisplay({ activePromptId, summary, children }: Props) {
  const hasModule = activePromptId != null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#00A3FF]/35 bg-[#000814]/85 shadow-[0_0_40px_rgba(0,163,255,0.12),inset_0_0_32px_rgba(0,163,255,0.06)] backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,163,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(0,163,255,0.04)_1px,transparent_1px)] bg-[size:20px_20px] opacity-60" />
      <div className="relative border-b border-[#00A3FF]/20 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#00A3FF]/90">
            Dynamic HUD
          </p>
          <span className="rounded-full border border-[#00A3FF]/25 bg-[#00050A]/80 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-slate-400">
            {hasModule ? executiveCommandPromptLabel(activePromptId) : "Standby"}
          </span>
        </div>
        {summary?.trim() ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{summary}</p>
        ) : hasModule ? null : (
          <p className="mt-2 text-sm text-slate-500">Select a command prompt or speak to Skipper.</p>
        )}
      </div>
      <div className="relative max-h-[min(52vh,560px)] overflow-y-auto px-4 py-3">
        {hasModule ? (
          children
        ) : (
          <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 text-center">
            <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#00A3FF]/50 to-transparent" />
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#00A3FF]/50">Awaiting command</p>
            <p className="max-w-sm text-xs text-slate-500">
              Select a command prompt or speak to Skipper.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
