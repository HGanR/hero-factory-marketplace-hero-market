"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type RefObject, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  detectLowDeviceMemoryHeuristic,
  detectSaveDataConnection,
  parseCinematicMotionFromBlock,
  shouldRunHeavyCinematicPreview,
  type CinematicMotionPayload,
} from "@/lib/site-builder/preview/cinematic-v3-preview-utils";
import type { PreviewVisualMetaBoost } from "@/lib/site-builder/preview/cinematic-preview-background";

export type CinematicPreviewV3Config = {
  /** Scrollport for useScroll (preview shell) */
  scrollRef: RefObject<HTMLElement | null> | null;
  /** 0 = off, 1 = full (multiplied with per-block intensity) */
  motionIntensity: number;
  /** Heavy parallax / layered animations disabled */
  reduceHeavyMotion: boolean;
  /** For atmosphere overlays */
  visualBoost?: PreviewVisualMetaBoost;
};

const CinematicPreviewV3Context = createContext<CinematicPreviewV3Config | null>(null);

export function CinematicPreviewV3Provider({
  scrollRef,
  visualBoost,
  themeMotionHint,
  children,
}: {
  scrollRef: RefObject<HTMLElement | null>;
  visualBoost?: PreviewVisualMetaBoost;
  /** From metadata.theme.motionHint (optional) */
  themeMotionHint?: string;
  children: ReactNode;
}) {
  const systemReduce = useReducedMotion();
  const [saveData, setSaveData] = useState(false);
  const [lowMem, setLowMem] = useState(false);

  useEffect(() => {
    setSaveData(detectSaveDataConnection());
    setLowMem(detectLowDeviceMemoryHeuristic());
  }, []);

  const baseIntensity =
    typeof visualBoost?.motionIntensity === "number"
      ? Math.max(0, Math.min(1, visualBoost.motionIntensity))
      : themeMotionHint === "floating-orbs" || themeMotionHint === "subtle-parallax" || themeMotionHint === "scroll-reveal"
        ? 0.75
        : 0.5;

  const reduceHeavy =
    systemReduce === true || !shouldRunHeavyCinematicPreview({ prefersReducedMotion: !!systemReduce, saveData, lowMemory: lowMem });

  const value = useMemo(
    () =>
      ({
        scrollRef,
        visualBoost: visualBoost
          ? { ...visualBoost, motionHint: themeMotionHint ?? visualBoost.motionHint }
          : themeMotionHint
            ? { motionHint: themeMotionHint, motionIntensity: baseIntensity }
            : undefined,
        motionIntensity: reduceHeavy ? Math.min(0.35, baseIntensity) : baseIntensity,
        reduceHeavyMotion: reduceHeavy,
      }) satisfies CinematicPreviewV3Config,
    [scrollRef, visualBoost, themeMotionHint, baseIntensity, saveData, lowMem, systemReduce, reduceHeavy],
  );

  return <CinematicPreviewV3Context.Provider value={value}>{children}</CinematicPreviewV3Context.Provider>;
}

export function useCinematicPreviewV3(): CinematicPreviewV3Config | null {
  return useContext(CinematicPreviewV3Context);
}

function sectionToneFromBlock(block: unknown): "dark" | "light" | "visual" | undefined {
  const ve = (block as { content?: { visualEngine?: { sectionTone?: string } } })?.content?.visualEngine;
  const t = ve?.sectionTone;
  if (t === "dark" || t === "light" || t === "visual") return t;
  return undefined;
}

/** Atmosphere + lighting driven by `previewVisualBoost` and motion intensity. */
export function CinematicAtmosphereScrim({ children }: { children: ReactNode }) {
  const ctx = useCinematicPreviewV3();
  const b = ctx?.visualBoost;
  const mi = ctx?.motionIntensity ?? 0.5;
  if (!b?.lightingStyle && !b?.gradientStyle) return <>{children}</>;
  const lift = 0.35 + mi * 0.4;
  let overlay = "";
  if (b.lightingStyle === "neon-glow") {
    overlay = `radial-gradient(circle at 70% 0%, rgba(244,63,94,0.1), transparent 45%)`;
  } else if (b.lightingStyle === "ambient") {
    overlay = `radial-gradient(circle at 15% 100%, rgba(14,165,233,0.1), transparent 50%)`;
  } else if (b.lightingStyle === "high-contrast") {
    overlay = `radial-gradient(ellipse 80% 40% at 50% 0%, rgba(2,6,23,0.2), transparent 60%)`;
  } else {
    overlay = "linear-gradient(180deg, rgba(2,6,23,0.12), transparent 38%)";
  }
  if (b.gradientStyle === "mesh" || b.gradientStyle === "glass") {
    overlay = `${overlay}, linear-gradient(130deg, rgba(255,255,255,0.04) 0%, transparent 50%)`.trim();
  } else if (b.gradientStyle === "neon" || b.gradientStyle === "radial") {
    overlay = `${overlay}, radial-gradient(circle at 90% 80%, rgba(168,85,247,0.12), transparent 40%)`.trim();
  }
  return (
    <div className="relative z-10 min-h-0 w-full">
      <div
        className="pointer-events-none absolute inset-0 z-[1] transition-opacity duration-700"
        style={{ opacity: lift, background: overlay, mixBlendMode: "soft-light" }}
        aria-hidden
      />
      <div className="relative z-[2] w-full min-h-0">{children}</div>
    </div>
  );
}

function CinematicParallaxScrollLayer({ int, children }: { int: number; children: ReactNode }) {
  const ctx = useCinematicPreviewV3();
  const container = ctx?.scrollRef;
  const targetRef = useRef<HTMLDivElement | null>(null);
  const scrollOpts = container
    ? { container, target: targetRef, offset: ["start 0.92", "end 0.08"] as const }
    : { target: targetRef, offset: ["start 0.92", "end 0.08"] as const };
  const { scrollYProgress } = useScroll(scrollOpts);
  const yBg = useTransform(scrollYProgress, [0, 1], [0, 32 * int]);
  return (
    <div ref={targetRef} className="relative overflow-hidden rounded-[inherit]">
      <motion.div
        className="pointer-events-none absolute inset-0 -z-10 scale-105 bg-gradient-to-b from-indigo-900/30 to-slate-950/20 opacity-50"
        style={{ y: yBg, willChange: "transform" }}
        aria-hidden
      />
      {children}
    </div>
  );
}

function CinematicFadeScrollLayer({ int, children }: { int: number; children: ReactNode }) {
  const ctx = useCinematicPreviewV3();
  const container = ctx?.scrollRef;
  const targetRef = useRef<HTMLDivElement | null>(null);
  const scrollOpts = container
    ? { container, target: targetRef, offset: ["start 0.92", "end 0.08"] as const }
    : { target: targetRef, offset: ["start 0.92", "end 0.08"] as const };
  const { scrollYProgress } = useScroll(scrollOpts);
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.12, 0.5, 0.88, 1],
    [0.5 + int * 0.15, 1, 1, 1, 0.6 + int * 0.2],
  );
  return (
    <motion.div ref={targetRef} style={{ opacity, willChange: "opacity" }} className="relative min-w-0 rounded-[inherit]">
      {children}
    </motion.div>
  );
}

function CinematicSlideScrollLayer({ int, index, children }: { int: number; index: number; children: ReactNode }) {
  const ctx = useCinematicPreviewV3();
  const container = ctx?.scrollRef;
  const targetRef = useRef<HTMLDivElement | null>(null);
  const scrollOpts = container
    ? { container, target: targetRef, offset: ["start 0.92", "end 0.08"] as const }
    : { target: targetRef, offset: ["start 0.92", "end 0.08"] as const };
  const { scrollYProgress } = useScroll(scrollOpts);
  const y = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [14 * int, 0, 0, 10 * int]);
  const x = useTransform(scrollYProgress, [0, 1], [index % 2 === 0 ? -6 * int : 6 * int, 0]);
  return (
    <motion.div ref={targetRef} style={{ y, x, willChange: "transform" }} className="relative min-w-0 rounded-[inherit]">
      {children}
    </motion.div>
  );
}

/**
 * Scroll-linked motion for non-hero blocks (parallax / fade / slide) using preview scrollport.
 * Hero parallax is handled in `BackgroundIntelligenceLayer` inside `SiteBuilderPreviewBlocks`.
 */
export function CinematicBlockScrollWrap({ block, index, children }: { block: unknown; index: number; children: ReactNode }) {
  const ctx = useCinematicPreviewV3();
  const t = (block as { type?: string })?.type;
  if (t === "hero") return <>{children}</>;
  const cin = parseCinematicMotionFromBlock(block);
  if (!cin) return <>{children}</>;
  const systemReduce = useReducedMotion();
  if (systemReduce) return <>{children}</>;
  if (ctx?.reduceHeavyMotion && cin.type === "parallax") return <>{children}</>;
  const int = (ctx?.motionIntensity ?? 0.5) * (cin.intensity || 0.5);

  if (cin.type === "parallax") {
    return <CinematicParallaxScrollLayer int={int}>{children}</CinematicParallaxScrollLayer>;
  }
  if (cin.type === "fade") {
    return <CinematicFadeScrollLayer int={int}>{children}</CinematicFadeScrollLayer>;
  }
  if (cin.type === "slide") {
    return <CinematicSlideScrollLayer int={int} index={index}>{children}</CinematicSlideScrollLayer>;
  }
  return <>{children}</>;
}

/** Section shell: in-view motion + alternation when block has no explicit cinematic. */
export function CinematicSectionTransition({
  block,
  index,
  children,
  className = "",
}: {
  block: unknown;
  index: number;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useCinematicPreviewV3();
  const cin = parseCinematicMotionFromBlock(block);
  const systemReduce = useReducedMotion();
  const int = (ctx?.motionIntensity ?? 0.5) * (cin?.intensity ?? 0.65);
  const tone = sectionToneFromBlock(block);
  const bgSh =
    tone === "dark"
      ? "from-indigo-950/25 via-slate-950/10 to-slate-950/40"
      : tone === "light"
        ? "from-slate-100/15 via-slate-50/5 to-transparent"
        : tone === "visual"
          ? "from-cyan-950/20 via-fuchsia-950/10 to-transparent"
          : index % 2 === 0
            ? "from-slate-800/5 via-transparent to-slate-900/15"
            : "from-slate-900/10 via-transparent to-slate-800/5";

  if (systemReduce || (ctx?.reduceHeavyMotion && !cin)) {
    return <div className={`${className} relative`}>{children}</div>;
  }

  const type = cin?.type;
  const alt = index % 2;
  const shiftOverlay = (ctx?.motionIntensity ?? 0) > 0.2 && !systemReduce;

  if (type === "fade" || (!type && alt === 0)) {
    return (
      <motion.div
        className={`${className} relative overflow-hidden`}
        initial={{ opacity: 0, y: int * 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.12 }}
        transition={{ duration: 0.5, delay: 0.04, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {shiftOverlay ? (
          <motion.div
            className={`pointer-events-none absolute inset-0 -z-0 rounded-[inherit] bg-gradient-to-b ${bgSh} opacity-0 mix-blend-soft-light`}
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 0.5, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
            aria-hidden
          />
        ) : null}
        {children}
      </motion.div>
    );
  }
  if (type === "slide" || (!type && alt === 1)) {
    return (
      <motion.div
        className={`${className} relative overflow-hidden`}
        initial={{ opacity: 0, y: 18, x: index % 3 === 0 ? -10 : 10 }}
        whileInView={{ opacity: 1, y: 0, x: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.45, delay: 0.05, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {shiftOverlay ? (
          <motion.div
            className={`pointer-events-none absolute inset-0 -z-0 rounded-[inherit] bg-gradient-to-b ${bgSh} opacity-0 mix-blend-soft-light`}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 0.45, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5 }}
            aria-hidden
          />
        ) : null}
        {children}
      </motion.div>
    );
  }
  if (type === "parallax") {
    return (
      <motion.div
        className={`${className} relative overflow-hidden`}
        initial={{ opacity: 0.9 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.4 }}
        style={{ willChange: "transform" }}
      >
        {shiftOverlay ? <div className={`pointer-events-none absolute inset-0 -z-0 bg-gradient-to-b ${bgSh} opacity-[0.35] mix-blend-overlay`} aria-hidden /> : null}
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      className={`${className} relative overflow-hidden`}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}

export type { CinematicMotionPayload };
