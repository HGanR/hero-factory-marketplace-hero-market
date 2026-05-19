"use client";

import type { OrbMode } from "./ExecutiveOrb";

type Props = {
  intensity: number;
  mode: OrbMode;
  activeAgentCount: number;
  dataThroughput: number;
  focusMode: string;
};

export function OrbTelemetryOverlay({
  intensity,
  mode,
  activeAgentCount,
  dataThroughput,
  focusMode,
}: Props) {
  const kbps = (dataThroughput / 1024).toFixed(0);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between rounded-2xl p-3 text-[10px] font-medium uppercase tracking-[0.22em] text-[#00A3FF]/70">
      <div className="flex justify-between gap-2">
        <span className="truncate">flux {kbps} kb/s</span>
        <span>nodes {activeAgentCount}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="truncate text-[#00A3FF]/55">mode {focusMode}</span>
        <span>amp {(intensity * 100).toFixed(0)}%</span>
      </div>
      <div className="text-center text-[11px] tracking-[0.35em] text-[#00FF85]/85">{mode}</div>
    </div>
  );
}
