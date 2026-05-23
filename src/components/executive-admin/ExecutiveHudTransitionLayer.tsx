"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import type { HudTransitionTokens } from "@/lib/executive-agent/executive-hud-transition-engine";
import { hudTransitionClassNames } from "@/lib/executive-agent/executive-hud-transition-engine";

type Props = {
  transition: HudTransitionTokens;
  style: Record<string, string | number>;
  promptKey: string | null;
  children: ReactNode;
  summary?: string | null;
  header: ReactNode;
  emptyState: ReactNode;
  hasModule: boolean;
};

export function ExecutiveHudTransitionLayer({
  transition,
  style,
  promptKey,
  children,
  summary,
  header,
  emptyState,
  hasModule,
}: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-[#000814]/85 backdrop-blur-md transition-[box-shadow,border-color] duration-500 ${hudTransitionClassNames(transition)}`}
      style={{
        ...style,
        borderColor: `rgba(0,163,255, calc(var(--hud-border-glow) * 0.55))`,
        boxShadow: `0 0 calc(24px + var(--hud-border-glow) * 48px) rgba(0,163,255, calc(var(--hud-border-glow) * 0.18)), inset 0 0 32px rgba(0,163,255,0.06)`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,163,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(0,163,255,0.04)_1px,transparent_1px)] bg-[size:20px_20px]"
        style={{ opacity: "calc(var(--hud-overlay-opacity) + 0.35)" }}
      />
      {transition.scanActive ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00A3FF]/70 to-transparent"
          style={{ animation: "executive-hud-scan 1.8s ease-in-out infinite" }}
        />
      ) : null}
      <div className="relative border-b border-[#00A3FF]/20 px-4 py-3">{header}</div>
      {summary?.trim() ? (
        <motion.p
          key={summary.slice(0, 48)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative border-b border-[#00A3FF]/10 px-4 py-2 text-sm leading-relaxed text-slate-200"
        >
          {summary}
        </motion.p>
      ) : null}
      <div className="relative max-h-[min(52vh,560px)] overflow-y-auto px-4 py-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={promptKey ?? "standby"}
            initial={{ opacity: 0, y: "var(--hud-translate-y)", filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            {hasModule ? children : emptyState}
          </motion.div>
        </AnimatePresence>
      </div>
      <style jsx>{`
        @keyframes executive-hud-scan {
          0%,
          100% {
            opacity: 0.2;
            transform: translateY(0);
          }
          50% {
            opacity: 1;
            transform: translateY(calc(min(52vh, 560px) * 0.35));
          }
        }
      `}</style>
    </div>
  );
}
