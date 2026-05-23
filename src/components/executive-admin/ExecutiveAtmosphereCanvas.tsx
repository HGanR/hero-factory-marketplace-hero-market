"use client";

import type { CSSProperties, ReactNode } from "react";
import type { AtmosphereLayerConfig } from "@/lib/executive-agent/executive-operational-atmosphere";
import { ExecutiveSignalSweep } from "./ExecutiveSignalSweep";

type Props = {
  config: AtmosphereLayerConfig;
  cssVars: Record<string, string>;
  children?: ReactNode;
  className?: string;
};

export function ExecutiveAtmosphereCanvas({ config, cssVars, children, className }: Props) {
  if (!config.motionEnabled && config.gridOpacity <= 0.05) return <>{children}</>;

  const style = cssVars as CSSProperties;

  return (
    <div className={`relative ${className ?? ""}`} style={style}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        style={{
          opacity: config.gridOpacity,
          backgroundImage:
            "linear-gradient(rgba(var(--atmo-glow-rgb),0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--atmo-glow-rgb),0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          transform: `translate3d(calc(var(--atmo-parallax) * 6px), calc(var(--atmo-parallax) * -4px), 0)`,
        }}
      />
      {config.scanLineOpacity > 0 ? <ExecutiveSignalSweep opacity={config.scanLineOpacity} durationSec={config.sweepDurationSec} /> : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(var(--atmo-glow-rgb), 0.08), transparent 70%)",
        }}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
