"use client";

import { Suspense } from "react";
import { ExecutiveOrb as SkipperNeuralOrb, type OrbMode } from "@/components/skipper/ExecutiveOrb";
import { OrbTelemetryOverlay } from "@/components/skipper/OrbTelemetryOverlay";
import type { ExecutiveOrbCanvasProps } from "./ExecutiveOrbCanvas";

export type ExecutiveOrbProps = ExecutiveOrbCanvasProps & {
  className?: string;
  /** Defaults to 4; pass e.g. selected agent count for flux HUD. */
  activeAgentCount?: number;
  dataThroughput?: number;
  focusMode?: string;
};

/**
 * Executive admin “Site brain” — same neural stack as `/admin/skipper` for visual parity.
 */
export function ExecutiveOrb({
  className,
  activeAgentCount,
  dataThroughput,
  focusMode,
  intensity,
  mode,
}: ExecutiveOrbProps) {
  const agents = activeAgentCount ?? 4;
  const tp = dataThroughput ?? 200_000 + intensity * 480_000;
  const label = focusMode ?? "Executive desk";

  return (
    <div
      className={`relative h-full min-h-[240px] w-full overflow-hidden rounded-2xl border border-[#00A3FF]/25 bg-[#00050A]/95 shadow-[0_0_52px_rgba(0,163,255,0.2)] ${className ?? ""}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,163,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,163,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px] opacity-45" />
      <div className="absolute inset-0">
        <Suspense fallback={<div className="h-full min-h-[240px] w-full bg-[#00050A]" />}>
          <SkipperNeuralOrb
            className="h-full w-full min-h-0"
            intensity={intensity}
            mode={mode as OrbMode}
            activeAgentCount={agents}
            dataThroughput={tp}
            focusMode={label}
          />
        </Suspense>
      </div>
      <OrbTelemetryOverlay
        intensity={intensity}
        mode={mode as OrbMode}
        activeAgentCount={agents}
        dataThroughput={tp}
        focusMode={label}
      />
      <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex justify-between text-[9px] font-medium uppercase tracking-[0.2em] text-[#00A3FF]/55">
        <span>Neural core</span>
        <span>{mode}</span>
      </div>
    </div>
  );
}
