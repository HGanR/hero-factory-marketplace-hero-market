"use client";

import { useReducedMotion } from "framer-motion";

/** Kept in upper/mid hero to avoid the nav → auth → chatbot visual path (esp. bottom-right). */
const CHIPS = [
  { label: "AI Campaigns", className: "left-[2%] top-[12%] md:left-[3%] md:top-[15%]" },
  { label: "3D Business", className: "right-[2%] top-[12%] md:right-[4%] md:top-[15%]" },
  { label: "Automation", className: "left-[2%] top-[36%] md:left-[3%] md:top-[40%]" },
  { label: "Revenue Systems", className: "right-[2%] top-[36%] md:right-[4%] md:top-[40%]" },
] as const;

/**
 * Subtle floating labels — pointer-events none, kept away from center auth column.
 */
export function LandingAmbientChips() {
  const reduced = useReducedMotion();

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[4] overflow-hidden"
      aria-hidden
    >
      {CHIPS.map((c, i) => (
        <span
          key={c.label}
          className={`landing-ambient-chip absolute hidden max-w-[8.5rem] rounded-full border border-cyan-400/12 bg-slate-950/25 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-400/85 shadow-[0_0_12px_rgba(0,209,255,0.05)] backdrop-blur-sm md:inline-block ${c.className}`}
          style={{
            animation: reduced
              ? undefined
              : `landing-chip-drift ${22 + i * 3.5}s ease-in-out infinite`,
            animationDelay: `${i * 2.1}s`,
          }}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}
