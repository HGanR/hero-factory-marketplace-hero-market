"use client";

import { useEffect, useMemo, useState } from "react";

export type PresencePerformanceTier = "full" | "reduced" | "minimal";

export type PresencePerformanceState = {
  tier: PresencePerformanceTier;
  animationsPaused: boolean;
  prefersReducedMotion: boolean;
  tabHidden: boolean;
  allowParticles: boolean;
  allowScanLines: boolean;
  maxFpsScale: number;
};

function readReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readLowPowerHint(): boolean {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return cores <= 4 || mem <= 4;
}

export function resolvePresencePerformanceTier(opts: {
  prefersReducedMotion: boolean;
  tabHidden: boolean;
  lowPowerHint: boolean;
}): PresencePerformanceTier {
  if (opts.prefersReducedMotion || opts.tabHidden) return "minimal";
  if (opts.lowPowerHint) return "reduced";
  return "full";
}

export function presencePerformanceFromTier(tier: PresencePerformanceTier): Omit<PresencePerformanceState, "tier" | "prefersReducedMotion" | "tabHidden"> {
  switch (tier) {
    case "minimal":
      return {
        animationsPaused: true,
        allowParticles: false,
        allowScanLines: false,
        maxFpsScale: 0.35,
      };
    case "reduced":
      return {
        animationsPaused: false,
        allowParticles: false,
        allowScanLines: true,
        maxFpsScale: 0.65,
      };
    default:
      return {
        animationsPaused: false,
        allowParticles: true,
        allowScanLines: true,
        maxFpsScale: 1,
      };
  }
}

export function usePresencePerformanceGovernance(): PresencePerformanceState {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readReducedMotion);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", onMq);
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => {
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return useMemo(() => {
    const tier = resolvePresencePerformanceTier({
      prefersReducedMotion,
      tabHidden,
      lowPowerHint: readLowPowerHint(),
    });
    const derived = presencePerformanceFromTier(tier);
    return {
      tier,
      prefersReducedMotion,
      tabHidden,
      ...derived,
    };
  }, [prefersReducedMotion, tabHidden]);
}
