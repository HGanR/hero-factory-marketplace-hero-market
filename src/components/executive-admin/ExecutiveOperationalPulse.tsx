"use client";

import type { CSSProperties } from "react";
import type { OrbPulseKind } from "@/lib/executive-agent/executive-orb-motion-engine";

type Props = {
  pulseKind: OrbPulseKind;
  cssVars: Record<string, string>;
  voiceWaveform?: number[];
  paused?: boolean;
};

const PULSE_CLASS: Record<OrbPulseKind, string> = {
  ambient: "border-[rgba(var(--orb-glow-rgb),0.25)]",
  signal: "border-[rgba(var(--orb-glow-rgb),0.45)] animate-pulse",
  escalation: "border-orange-400/50 animate-pulse",
  approval: "border-amber-300/55 shadow-[0_0_40px_rgba(251,191,36,0.35)]",
  voice: "border-[rgba(var(--orb-glow-rgb),0.65)]",
  processing: "border-violet-400/45 animate-pulse",
};

export function ExecutiveOperationalPulse({ pulseKind, cssVars, voiceWaveform, paused }: Props) {
  if (paused) return null;

  const scale = 1 + Number(cssVars["--orb-ring-expansion"] ?? 0);

  return (
    <div className="pointer-events-none absolute inset-0 z-[2]" style={cssVars as CSSProperties}>
      <div
        className={`absolute inset-[8%] rounded-full border-2 transition-[transform,opacity,border-color] duration-300 ${PULSE_CLASS[pulseKind]}`}
        style={{
          transform: `translate(var(--orb-drift-x), var(--orb-drift-y)) scale(${scale})`,
          opacity: 0.35 + Number(cssVars["--orb-intensity"] ?? 0) * 0.45,
          boxShadow: `0 0 calc(24px + var(--orb-intensity) * 48px) rgba(var(--orb-glow-rgb), calc(var(--orb-intensity) * 0.5))`,
        }}
      />
      <div
        className="absolute inset-[14%] rounded-full border border-[rgba(var(--orb-glow-rgb),0.18)]"
        style={{
          transform: `scale(${1 + Number(cssVars["--orb-ring-expansion"] ?? 0) * 0.6})`,
          animation: pulseKind === "voice" || pulseKind === "escalation" ? "spin 18s linear infinite" : undefined,
        }}
      />
      {(pulseKind === "voice" || pulseKind === "processing") && voiceWaveform && voiceWaveform.length > 0 ? (
        <div className="absolute bottom-[12%] left-1/2 flex h-8 w-[min(72%,16rem)] -translate-x-1/2 items-end justify-center gap-[2px]">
          {voiceWaveform.slice(0, 24).map((v, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full bg-[rgba(var(--orb-glow-rgb),0.75)]"
              style={{ height: `${Math.max(12, v * 100)}%`, opacity: 0.35 + v * 0.55 }}
            />
          ))}
        </div>
      ) : null}
      {pulseKind === "signal" || pulseKind === "escalation" ? (
        <div
          className="absolute inset-[20%] rounded-full border border-[rgba(var(--orb-glow-rgb),0.15)]"
          style={{
            animation: "executive-ripple 2.4s ease-out infinite",
            animationDelay: `calc(var(--orb-ripple-phase) * -2.4s)`,
          }}
        />
      ) : null}
      <style jsx>{`
        @keyframes executive-ripple {
          0% {
            transform: scale(0.92);
            opacity: 0.55;
          }
          100% {
            transform: scale(1.18);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
