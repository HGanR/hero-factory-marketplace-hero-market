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

  const micStatusLabel = voiceSttBusy ? "Listening…" : voiceListening ? "Live mic" : "Speak";

  return (
    <ExecutiveAtmosphereCanvas
      className="space-y-3"
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
      <div style={focusStyle} className="space-y-3 transition-[opacity,transform] duration-500">
        <div
          className="flex flex-col items-center gap-1 transition-opacity duration-500"
          style={{ opacity: cinematic?.commandFocus.active ? 0.92 : 1 }}
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <h2 className="text-base font-semibold uppercase tracking-[0.48em] text-white md:text-lg">Skipper</h2>
            <button
              type="button"
              title="Speak to Skipper"
              aria-label="Microphone — speak to Skipper"
              aria-pressed={voiceSttBusy || voiceListening}
              disabled={voiceBusy}
              onClick={onMicClick}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 shadow-[0_0_24px_rgba(0,163,255,0.22)] transition hover:scale-[1.04] disabled:opacity-40 md:h-12 md:w-12 ${
                voiceSttBusy || voiceListening
                  ? "border-[#00A3FF] bg-[#00A3FF]/25 text-[#00A3FF] animate-pulse"
                  : "border-[#00A3FF]/55 bg-[#000814]/90 text-[#00A3FF] hover:bg-[#001020]"
              }`}
              style={{
                boxShadow: voiceListening
                  ? `0 0 calc(20px + ${displayIntensity * 28}px) rgba(${cinematic?.profile.glowRgb ?? "0,163,255"}, ${0.22 + displayIntensity * 0.32})`
                  : undefined,
              }}
            >
              <Mic className="h-5 w-5 md:h-6 md:w-6" />
            </button>
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{micStatusLabel}</span>
          </div>
          <p className="text-center text-[10px] uppercase tracking-[0.34em] text-[#00A3FF]/70">
            Neural command interface · {voiceListening ? "Voice active" : "Standby"}
            {cinematic ? ` · ${cinematic.choreographyMode.replace(/_/g, " ")}` : ""}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:h-[min(52vh,460px)] lg:min-h-[240px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-4">
          <div className="relative mx-auto flex h-[min(38vh,300px)] min-h-[220px] w-full min-w-0 max-w-xl lg:mx-0 lg:h-full lg:max-h-none lg:max-w-none">
            <div
              className="pointer-events-none absolute -inset-2 rounded-[1.75rem] border opacity-70 transition-[border-color,box-shadow] duration-500 lg:-inset-3"
              style={{
                borderColor: `rgba(${cinematic?.profile.glowRgb ?? "0,163,255"}, ${0.12 + (cinematic?.profile.glowIntensity ?? 0.22) * 0.35})`,
                boxShadow: `0 0 calc(16px + var(--cmd-focus-orb-glow, 0.28) * 32px) rgba(${cinematic?.profile.glowRgb ?? "0,163,255"}, calc(var(--cmd-focus-orb-glow, 0.28) * 0.32))`,
              }}
            />
            <div className="relative flex h-full min-h-0 w-full overflow-hidden rounded-[1.5rem] border border-[#00A3FF]/40 bg-[#00050A]/90 shadow-[0_0_48px_rgba(0,163,255,0.2),inset_0_0_36px_rgba(0,183,255,0.07)]">
              {selfHostedFallbackBanner}
              <div className="relative h-full min-h-[240px] w-full">
                <ExecutiveOrb
                  intensity={displayIntensity}
                  mode={orbMode}
                  activeAgentCount={activeAgentCount}
                  focusMode={dashboardModeLabel}
                  operationalState={operationalState}
                  className="h-full min-h-[240px] rounded-none border-0 shadow-none"
                />
                {cinematic ? (
                  <ExecutiveOperationalPulse
                    pulseKind={cinematic.orbPulseKind}
                    cssVars={orbVars}
                    voiceWaveform={cinematic.voiceWaveform}
                    paused={cinematic.performance.animationsPaused}
                  />
                ) : null}
                <div className="pointer-events-none absolute left-2 top-2 rounded border border-[#00A3FF]/25 bg-[#000814]/80 px-1.5 py-0.5 text-[7px] uppercase tracking-[0.18em] text-[#00A3FF]/70 md:left-3 md:top-3 md:text-[8px]">
                  Flux {Math.round(180 + displayIntensity * 120)} KB/s
                </div>
                <div className="pointer-events-none absolute right-2 top-2 max-w-[55%] truncate rounded-full border border-[#00A3FF]/35 bg-[#00050A]/85 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#00A3FF] md:right-3 md:top-3 md:max-w-none md:px-3 md:py-1 md:text-[10px] md:tracking-[0.2em]">
                  {ambientPulse ? "Signal pulse" : orbStandbyLabel}
                </div>
                {voicePendingAnalytics ? (
                  <p className="pointer-events-none absolute bottom-3 left-2 z-[5] max-w-[calc(100%-1rem)] rounded-lg border border-[#00A3FF]/30 bg-[#00050A]/90 px-2 py-1 text-[9px] leading-snug text-[#00A3FF]/90 md:bottom-4 md:left-3 md:max-w-[14rem] md:text-[10px]">
                    Say site visits, active users, traffic sources, or conversions.
                  </p>
                ) : null}
                {voicePendingOperational?.intent === "inbox_audio_confirm" ? (
                  <p className="pointer-events-none absolute bottom-3 left-2 z-[5] max-w-[calc(100%-1rem)] rounded-lg border border-emerald-400/30 bg-[#00050A]/90 px-2 py-1 text-[9px] text-emerald-100/90 md:bottom-4 md:left-3 md:max-w-[14rem] md:text-[10px]">
                    Say yes to play inbox audio, or no to skip.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className="flex h-[min(34vh,280px)] min-h-[200px] min-w-0 transition-[transform,opacity] duration-500 lg:h-full lg:min-h-0"
            style={{
              transform: cinematic?.commandFocus.active ? `scale(var(--cmd-focus-hud-scale, 1.008))` : undefined,
              opacity: cinematic?.commandFocus.active ? 1 : 0.98,
            }}
          >
            <ExecutiveDynamicHudDisplay
              activePromptId={activePromptId}
              summary={hudSummary}
              hudTransition={cinematic?.hudTransition}
              hudStyle={cinematic?.hudStyle}
              fillHeight
            >
              {hudContent}
            </ExecutiveDynamicHudDisplay>
          </div>
        </div>
      </div>
    </ExecutiveAtmosphereCanvas>
  );
}
