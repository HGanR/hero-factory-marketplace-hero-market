"use client";

import { motion, type MotionValue } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

export type BackgroundIntelligenceProps = {
  /** Base gradient fill for the section shell */
  gradient: string;
  /** CSS box-shadow string for ambient glow */
  glowShadow?: string;
  /** Extra soft ambient layer (color / blur hint) */
  ambientGlow?: string;
  /** Noise layer opacity 0–1 */
  noiseOpacity?: number;
  /** Grid overlay opacity 0–1 (0 = off) */
  gridOpacity?: number;
  /** Enable subtle animated gradient drift (preview only) */
  animateBackground?: boolean;
  /** Cinematic v3: scroll parallax for static gradient (preview) */
  parallaxBackgroundY?: MotionValue<number>;
  /** Cinematic v3: extra light/bloom/depth between noise and content */
  cinematicOverlays?: ReactNode;
  className?: string;
  /** Merged into root (e.g. v3 depth shadow) */
  rootStyle?: CSSProperties;
  children: ReactNode;
};

/**
 * TROOTHHERTZ Signature Visual Engine — background intelligence layer.
 * Grid + ambient glow + noise; optional motion on the gradient for depth.
 */
export function BackgroundIntelligenceLayer({
  gradient,
  glowShadow,
  ambientGlow,
  noiseOpacity = 0.03,
  gridOpacity = 0.06,
  animateBackground = false,
  parallaxBackgroundY,
  cinematicOverlays,
  className = "",
  rootStyle,
  children,
}: BackgroundIntelligenceProps) {
  const hasParallax = parallaxBackgroundY != null;
  return (
    <div
      className={`relative overflow-hidden rounded-[inherit] ${className}`}
      style={rootStyle ? { boxShadow: glowShadow, ...rootStyle } : { boxShadow: glowShadow }}
    >
      {hasParallax ? (
        <motion.div
          className="pointer-events-none absolute inset-0 scale-110 rounded-[inherit]"
          style={{ background: gradient, y: parallaxBackgroundY, willChange: "transform" }}
        />
      ) : animateBackground ? (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ background: gradient, backgroundSize: "200% 200%" }}
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: gradient }} />
      )}
      {ambientGlow ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-80 blur-3xl"
          style={{ background: ambientGlow }}
        />
      ) : null}
      {gridOpacity > 0 ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            opacity: gridOpacity,
            backgroundImage: `linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />
      ) : null}
      {noiseOpacity > 0 ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay"
          style={{
            opacity: noiseOpacity,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E")`,
          }}
        />
      ) : null}
      {cinematicOverlays ? <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden rounded-[inherit]">{cinematicOverlays}</div> : null}
      <div className="relative z-[5] sm:z-[5]">{children}</div>
    </div>
  );
}
