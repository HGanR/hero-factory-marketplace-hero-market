"use client";

import { ReactNode } from "react";

const HOLO_BASE =
  "rounded-2xl overflow-hidden relative " +
  "backdrop-blur-xl bg-white/[0.04] " +
  "border border-white/[0.08] " +
  "transition-all duration-300";

export function HolographicCard({
  children,
  className = "",
  accent = "cyan",
}: {
  children: ReactNode;
  className?: string;
  accent?: "cyan" | "violet" | "both";
}) {
  const initialShadow =
    accent === "cyan"
      ? "0 0 0 1px rgba(0,209,255,0.2), 0 8px 32px -8px rgba(0,0,0,0.4)"
      : accent === "violet"
        ? "0 0 0 1px rgba(139,92,246,0.2), 0 8px 32px -8px rgba(0,0,0,0.4)"
        : "0 0 0 1px rgba(0,209,255,0.15), 0 0 0 1px rgba(139,92,246,0.1), 0 8px 32px -8px rgba(0,0,0,0.4)";

  const hoverShadow =
    accent === "cyan"
      ? "0 0 0 1px rgba(0,209,255,0.4), 0 0 24px -4px rgba(0,209,255,0.15), 0 8px 32px -8px rgba(0,0,0,0.4)"
      : accent === "violet"
        ? "0 0 0 1px rgba(139,92,246,0.4), 0 0 24px -4px rgba(139,92,246,0.15), 0 8px 32px -8px rgba(0,0,0,0.4)"
        : "0 0 0 1px rgba(0,209,255,0.3), 0 0 0 1px rgba(139,92,246,0.2), 0 0 24px -4px rgba(0,209,255,0.1), 0 0 24px -4px rgba(139,92,246,0.08), 0 8px 32px -8px rgba(0,0,0,0.4)";

  return (
    <div
      className={`${HOLO_BASE} ${className}`}
      style={{ boxShadow: initialShadow }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = hoverShadow;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = initialShadow;
      }}
    >
      {/* Edge glow gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl opacity-60"
        style={{
          background:
            accent === "cyan"
              ? "linear-gradient(135deg, rgba(0,209,255,0.08) 0%, transparent 40%, transparent 60%, rgba(0,209,255,0.05) 100%)"
              : accent === "violet"
                ? "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, transparent 40%, transparent 60%, rgba(139,92,246,0.05) 100%)"
                : "linear-gradient(135deg, rgba(0,209,255,0.06) 0%, transparent 30%, transparent 70%, rgba(139,92,246,0.06) 100%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export const HOLO_TILE_SM =
  "rounded-xl backdrop-blur-lg bg-white/[0.03] border border-white/[0.06] " +
  "shadow-[0_0_0_1px_rgba(0,209,255,0.12),0_4px_16px_-4px_rgba(0,0,0,0.3)] " +
  "hover:border-cyan-500/30 hover:shadow-[0_0_0_1px_rgba(0,209,255,0.25),0_0_16px_-4px_rgba(0,209,255,0.08)] " +
  "transition-all duration-300";
