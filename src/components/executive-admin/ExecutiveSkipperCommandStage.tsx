"use client";

import type { ReactNode } from "react";
import { Mic } from "lucide-react";
import { ExecutiveOrb } from "./ExecutiveOrb";
import type { ExecutiveOrbCanvasProps } from "./ExecutiveOrbCanvas";
import { ExecutiveDynamicHudDisplay } from "./ExecutiveDynamicHudDisplay";
import type { ExecutiveCommandPromptId } from "@/lib/executive-agent/executive-command-prompts";

type OrbMode = ExecutiveOrbCanvasProps["mode"];

type Props = {
  activePromptId: ExecutiveCommandPromptId | null;
  hudSummary: string | null;
  hudContent: ReactNode;
  orbIntensity: number;
  orbMode: OrbMode;
  activeAgentCount: number;
  dashboardModeLabel: string;
  operationalState?: string;
  orbStandbyLabel: string;
  ambientPulse?: boolean;
  voicePendingAnalytics?: boolean;
  voicePendingOperational?: { intent: string } | null;
  selfHostedFallbackBanner?: ReactNode;
  voiceSttBusy: boolean;
  voiceListening: boolean;
  voiceBusy: boolean;
  onMicClick: () => void;
};

export function ExecutiveSkipperCommandStage({
  activePromptId,
  hudSummary,
  hudContent,
  orbIntensity,
  orbMode,
  activeAgentCount,
  dashboardModeLabel,
  operationalState,
  orbStandbyLabel,
  ambientPulse,
  voicePendingAnalytics,
  voicePendingOperational,
  selfHostedFallbackBanner,
  voiceSttBusy,
  voiceListening,
  voiceBusy,
  onMicClick,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-base font-semibold uppercase tracking-[0.48em] text-white md:text-lg">Skipper</h2>
        <p className="mt-1 text-[10px] uppercase tracking-[0.34em] text-[#00A3FF]/70">
          Neural command interface · {voiceListening ? "Voice active" : "Standby"}
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-3xl">
        <div className="pointer-events-none absolute -inset-3 rounded-[2rem] border border-[#00A3FF]/15 opacity-70" />
        <div className="pointer-events-none absolute -inset-6 rounded-[2.25rem] border border-[#00A3FF]/8 opacity-40" />
        <div className="relative overflow-hidden rounded-[1.75rem] border border-[#00A3FF]/40 bg-[#00050A]/90 shadow-[0_0_64px_rgba(0,163,255,0.22),inset_0_0_48px_rgba(0,183,255,0.08)]">
          {selfHostedFallbackBanner}
          <div className="relative aspect-square max-h-[min(68vh,680px)] w-full min-h-[320px]">
            <ExecutiveOrb
              intensity={orbIntensity}
              mode={orbMode}
              activeAgentCount={activeAgentCount}
              focusMode={dashboardModeLabel}
              operationalState={operationalState}
              className="h-full min-h-[320px] rounded-none border-0 shadow-none"
            />
            <div className="pointer-events-none absolute left-3 top-3 rounded border border-[#00A3FF]/25 bg-[#000814]/80 px-2 py-1 text-[8px] uppercase tracking-[0.2em] text-[#00A3FF]/70">
              Flux {Math.round(180 + orbIntensity * 120)} KB/s
            </div>
            <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-[#00A3FF]/35 bg-[#00050A]/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00A3FF]">
              {ambientPulse ? "Signal pulse" : orbStandbyLabel}
            </div>
            {voicePendingAnalytics ? (
              <p className="pointer-events-none absolute bottom-16 left-3 z-[5] max-w-[15rem] rounded-lg border border-[#00A3FF]/30 bg-[#00050A]/90 px-2 py-1.5 text-[10px] leading-snug text-[#00A3FF]/90">
                Say site visits, active users, traffic sources, or conversions.
              </p>
            ) : null}
            {voicePendingOperational?.intent === "inbox_audio_confirm" ? (
              <p className="pointer-events-none absolute bottom-16 left-3 z-[5] max-w-[15rem] rounded-lg border border-emerald-400/30 bg-[#00050A]/90 px-2 py-1.5 text-[10px] text-emerald-100/90">
                Say yes to play inbox audio, or no to skip.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <ExecutiveDynamicHudDisplay activePromptId={activePromptId} summary={hudSummary}>
        {hudContent}
      </ExecutiveDynamicHudDisplay>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          title="Speak to Skipper"
          aria-label="Microphone — speak to Skipper"
          aria-pressed={voiceSttBusy || voiceListening}
          disabled={voiceBusy}
          onClick={onMicClick}
          className={`flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-[0_0_32px_rgba(0,163,255,0.25)] transition hover:scale-[1.04] disabled:opacity-40 ${
            voiceSttBusy || voiceListening
              ? "border-[#00A3FF] bg-[#00A3FF]/25 text-[#00A3FF] animate-pulse"
              : "border-[#00A3FF]/55 bg-[#000814]/90 text-[#00A3FF] hover:bg-[#001020]"
          }`}
        >
          <Mic className="h-7 w-7" />
        </button>
        <p className="text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">
          {voiceSttBusy ? "Listening…" : voiceListening ? "Live mic" : "Speak to Skipper"}
        </p>
      </div>
    </div>
  );
}
