"use client";

import type { CSSProperties, ReactNode } from "react";
import { Mic } from "lucide-react";
import { ExecutiveOrb } from "./ExecutiveOrb";
import type { ExecutiveOrbCanvasProps } from "./ExecutiveOrbCanvas";
import { ExecutiveDynamicHudDisplay } from "./ExecutiveDynamicHudDisplay";
import { ExecutiveAtmosphereCanvas } from "./ExecutiveAtmosphereCanvas";
import { ExecutiveOperationalPulse } from "./ExecutiveOperationalPulse";
import type { ExecutiveCommandPromptId } from "@/lib/executive-agent/executive-command-prompts";
import type { ExecutiveCinematicPresenceState } from "@/lib/executive-agent/executive-cinematic-presence";

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
  cinematic?: ExecutiveCinematicPresenceState;
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
  cinematic,
}: Props) {
  const displayIntensity = cinematic?.cinematicOrbIntensity ?? orbIntensity;
  const focusStyle = (cinematic?.commandFocusCssVars ?? {}) as CSSProperties;
  const orbVars = cinematic?.orbCssVars ?? {};
  const atmosphere = cinematic?.atmosphere;
  const atmosphereVars = cinematic?.atmosphereCssVars ?? {};

  return (
    <ExecutiveAtmosphereCanvas
      className="space-y-4"
      config={
        atmosphere ?? {
          gridOpacity: 0.35,
          sweepDurationSec: 12,
          scanLineOpacity: 0.12,
          parallaxOffset: 0.14,
          motionEnabled: true,
        }
      }
      cssVars={atmosphereVars}
    >
      <div style={focusStyle} className="space-y-4 transition-[opacity,transform] duration-500">
        <div
          className="text-center transition-opacity duration-500"
          style={{ opacity: cinematic?.commandFocus.active ? 0.92 : 1 }}
        >
          <h2 className="text-base font-semibold uppercase tracking-[0.48em] text-white md:text-lg">Skipper</h2>
          <p className="mt-1 text-[10px] uppercase tracking-[0.34em] text-[#00A3FF]/70">
            Neural command interface · {voiceListening ? "Voice active" : "Standby"}
            {cinematic ? ` · ${cinematic.choreographyMode.replace(/_/g, " ")}` : ""}
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-3xl transition-transform duration-500" style={{ transform: cinematic?.commandFocus.active ? "scale(1.01)" : undefined }}>
          <div
            className="pointer-events-none absolute -inset-3 rounded-[2rem] border opacity-70 transition-[border-color,box-shadow] duration-500"
            style={{
              borderColor: `rgba(${cinematic?.profile.glowRgb ?? "0,163,255"}, ${0.12 + (cinematic?.profile.glowIntensity ?? 0.22) * 0.35})`,
              boxShadow: `0 0 calc(20px + var(--cmd-focus-orb-glow, 0.28) * 40px) rgba(${cinematic?.profile.glowRgb ?? "0,163,255"}, calc(var(--cmd-focus-orb-glow, 0.28) * 0.35))`,
            }}
          />
          <div className="pointer-events-none absolute -inset-6 rounded-[2.25rem] border border-[#00A3FF]/8 opacity-40" />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-[#00A3FF]/40 bg-[#00050A]/90 shadow-[0_0_64px_rgba(0,163,255,0.22),inset_0_0_48px_rgba(0,183,255,0.08)]">
            {selfHostedFallbackBanner}
            <div className="relative aspect-square max-h-[min(68vh,680px)] w-full min-h-[320px]">
              <ExecutiveOrb
                intensity={displayIntensity}
                mode={orbMode}
                activeAgentCount={activeAgentCount}
                focusMode={dashboardModeLabel}
                operationalState={operationalState}
                className="h-full min-h-[320px] rounded-none border-0 shadow-none"
              />
              {cinematic ? (
                <ExecutiveOperationalPulse
                  pulseKind={cinematic.orbPulseKind}
                  cssVars={orbVars}
                  voiceWaveform={cinematic.voiceWaveform}
                  paused={cinematic.performance.animationsPaused}
                />
              ) : null}
              <div className="pointer-events-none absolute left-3 top-3 rounded border border-[#00A3FF]/25 bg-[#000814]/80 px-2 py-1 text-[8px] uppercase tracking-[0.2em] text-[#00A3FF]/70">
                Flux {Math.round(180 + displayIntensity * 120)} KB/s
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

        <div
          className="transition-[transform,opacity] duration-500"
          style={{
            transform: cinematic?.commandFocus.active ? `scale(var(--cmd-focus-hud-scale, 1.012))` : undefined,
            opacity: cinematic?.commandFocus.active ? 1 : 0.98,
          }}
        >
          <ExecutiveDynamicHudDisplay
            activePromptId={activePromptId}
            summary={hudSummary}
            hudTransition={cinematic?.hudTransition}
            hudStyle={cinematic?.hudStyle}
          >
            {hudContent}
          </ExecutiveDynamicHudDisplay>
        </div>

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
            style={{
              boxShadow: voiceListening
                ? `0 0 calc(24px + ${displayIntensity * 32}px) rgba(${cinematic?.profile.glowRgb ?? "0,163,255"}, ${0.25 + displayIntensity * 0.35})`
                : undefined,
            }}
          >
            <Mic className="h-7 w-7" />
          </button>
          <p className="text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">
            {voiceSttBusy ? "Listening…" : voiceListening ? "Live mic" : "Speak to Skipper"}
          </p>
        </div>
      </div>
    </ExecutiveAtmosphereCanvas>
  );
}
