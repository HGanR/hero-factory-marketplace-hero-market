"use client";

import { motion } from "framer-motion";
import type {
  AmbientOrbState,
  ExecutiveAmbientSignalOverview,
  OperationalPresenceMode,
} from "@/lib/executive-agent/executive-ambient-signal-types";
import { PRESENCE_MODE_LABEL } from "@/lib/executive-agent/operational-presence-state";

const MODE_STYLE: Record<OperationalPresenceMode, string> = {
  calm: "border-[#00A3FF]/25 text-[#00A3FF]",
  active: "border-[#00A3FF]/40 text-[#00A3FF]",
  elevated: "border-amber-400/40 text-amber-100",
  incident: "border-orange-400/45 text-orange-100",
  crisis: "border-rose-500/50 text-rose-100",
  recovery: "border-violet-400/40 text-violet-100",
  strategic: "border-violet-400/35 text-violet-100",
};

const GLOW_STYLE: Record<AmbientOrbState["glowColor"], string> = {
  cyan: "shadow-[0_0_24px_rgba(0,163,255,0.35)] bg-[#00A3FF]/20",
  amber: "shadow-[0_0_24px_rgba(251,191,36,0.35)] bg-amber-400/20",
  rose: "shadow-[0_0_28px_rgba(244,63,94,0.45)] bg-rose-500/25",
  violet: "shadow-[0_0_24px_rgba(167,139,250,0.35)] bg-violet-400/20",
};

type Props = {
  overview: ExecutiveAmbientSignalOverview | null;
  orbState: AmbientOrbState | null;
  loading?: boolean;
};

export function OperationalPresenceStatusBar({ overview, orbState, loading }: Props) {
  if (loading && !overview) {
    return (
      <div className="rounded-xl border border-[#00A3FF]/15 bg-[#00050A]/80 px-3 py-2 text-[10px] text-slate-500">
        Operational presence loading…
      </div>
    );
  }
  if (!overview) return null;

  const mode = overview.presenceMode;
  const modeClass = MODE_STYLE[mode] ?? MODE_STYLE.calm;
  const glow = orbState ? GLOW_STYLE[orbState.glowColor] : GLOW_STYLE.cyan;
  const pulse = orbState?.pulseActive ?? false;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border bg-[#00050A]/90 px-3 py-2 backdrop-blur-sm ${modeClass}`}
    >
      <motion.div
        className={`relative h-3 w-3 rounded-full ${glow}`}
        animate={pulse ? { scale: [1, 1.35, 1], opacity: [0.85, 1, 0.85] } : { scale: 1, opacity: 0.75 }}
        transition={{ duration: pulse ? 1.2 : 0.3, repeat: pulse ? Infinity : 0 }}
      />
      <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
        {PRESENCE_MODE_LABEL[mode]} · operational
      </span>
      {orbState ? (
        <span className="text-[9px] capitalize text-slate-400">{orbState.label}</span>
      ) : null}
      <span className="ml-auto text-[9px] text-slate-500">
        {overview.signalCount} signals · {overview.interruptionCount} interrupts · advisory
      </span>
    </div>
  );
}
