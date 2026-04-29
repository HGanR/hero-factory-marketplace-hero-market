"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import type { HeroDepthVisual } from "@/lib/site-builder/ai/visual-tokens";

function fallbackHeroDepth(anchor: string, accent: string): HeroDepthVisual {
  return {
    tier: 2,
    planes: {
      far: {
        background: `radial-gradient(ellipse 80% 60% at 70% 18%, ${accent}44, transparent 58%)`,
        blur: "40px",
        opacity: 0.38,
        scale: 1.06,
        translateY: 8,
        translateX: 0,
      },
      mid: {
        insetPx: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        shadow: "inset 0 14px 44px rgba(0,0,0,0.38)",
        opacity: 0.2,
        blur: "0px",
        scale: 1,
      },
      near: {
        contentShadow: "0 22px 56px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)",
        contentLift: 1,
      },
    },
    motion: { floatPx: 6, durationSec: 17, parallaxMidPx: 4, pulseOpacity: [0.22, 0.36] },
    anchorFeatures:
      anchor === "neural"
        ? ["mesh_back", "neural_cluster", "floating_cards"]
        : anchor === "depth"
          ? ["stack_frames", "split_plane"]
          : anchor === "signal"
            ? ["signal_line", "data_panels"]
            : ["holo_disc", "glow_frame", "glass_row"],
  };
}

type Props = {
  visual: Record<string, unknown>;
  accent: string;
  idx: number;
  anchor: string;
  rhythmOverlay?: string;
  bgPulse?: boolean;
  children: ReactNode;
};

function featureSet(visual: Record<string, unknown>, hd: HeroDepthVisual | undefined): Set<string> {
  const raw = (Array.isArray(visual.anchorFeatures) ? visual.anchorFeatures : hd?.anchorFeatures) as string[] | undefined;
  return new Set(raw ?? []);
}

/**
 * Pseudo-3D depth planes + stacked anchor treatments for TROOTHHERTZ signature heroes.
 */
export function TroothertzHeroDepthStack({ visual, accent, idx, anchor, rhythmOverlay, bgPulse, children }: Props) {
  const reduceMotion = useReducedMotion();
  const rawHd = visual.heroDepth as HeroDepthVisual | undefined;
  const hd = rawHd ?? (anchor ? fallbackHeroDepth(anchor, accent) : undefined);
  const fe = featureSet(visual, hd);
  if (!anchor || !hd) {
    return <div className="relative">{children}</div>;
  }

  const tier = hd.tier ?? 2;
  const far = hd.planes.far;
  const mid = hd.planes.mid;
  const near = hd.planes.near;
  const m = hd.motion;
  const floatPx = reduceMotion ? 0 : m?.floatPx ?? 6;
  const parallax = reduceMotion ? 0 : m?.parallaxMidPx ?? 4;
  const dataPanels = Array.isArray(visual.dataPanels)
    ? (visual.dataPanels as Array<{ label?: string; value?: string }>)
    : [];

  const showFar = Boolean(far && (fe.has("mesh_back") || fe.has("far_glow") || anchor === "neural" || anchor === "holographic"));
  const showMidFrame = Boolean(mid && (fe.has("stack_frames") || anchor === "depth"));

  return (
    <div className="relative min-h-[1px]">
      {showFar && far ? (
        <motion.div
          className="pointer-events-none absolute -inset-6 z-[1] rounded-[inherit]"
          style={{
            background: far.background,
            opacity: far.opacity,
            filter: `blur(${far.blur})`,
            transform: `scale(${far.scale}) translate(${far.translateX}px, ${far.translateY}px)`,
          }}
          animate={
            reduceMotion
              ? undefined
              : {
                  y: [floatPx * -1, floatPx, floatPx * -0.5],
                  x: [parallax * -0.5, parallax * 0.5, 0],
                }
          }
          transition={
            reduceMotion
              ? undefined
              : { duration: m?.durationSec ?? 16, repeat: Infinity, ease: "easeInOut" }
          }
        />
      ) : null}

      {fe.has("mesh_back") && tier >= 2 ? (
        <div
          className="pointer-events-none absolute -bottom-8 -left-10 z-[1] h-40 w-56 rounded-full opacity-30 blur-3xl"
          style={{ background: `radial-gradient(circle, ${accent}44, transparent 70%)` }}
        />
      ) : null}

      {showMidFrame && mid ? (
        <motion.div
          className="pointer-events-none absolute z-[2] rounded-[inherit]"
          style={{
            inset: mid.insetPx,
            opacity: mid.opacity,
            border: mid.border,
            boxShadow: mid.shadow,
            filter: mid.blur !== "0px" ? `blur(${mid.blur})` : undefined,
            transform: `scale(${mid.scale})`,
          }}
          animate={reduceMotion ? undefined : { y: [0, parallax * 0.4, 0] }}
          transition={{ duration: (m?.durationSec ?? 16) * 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      {fe.has("stack_frames") && anchor === "depth" ? (
        <>
          <div
            className="pointer-events-none absolute inset-5 z-[2] rounded-xl border border-white/[0.05] opacity-40"
            style={{ transform: "scale(0.98) translateY(4px)" }}
          />
          <div
            className="pointer-events-none absolute inset-7 z-[2] rounded-lg border border-white/[0.04] opacity-25"
            style={{ transform: "scale(0.96) translateY(8px)" }}
          />
        </>
      ) : null}

      {rhythmOverlay ? (
        <div
          className="pointer-events-none absolute inset-0 z-[3] rounded-[inherit]"
          style={{ background: rhythmOverlay }}
        />
      ) : null}

      {bgPulse ? (
        <motion.div
          className="pointer-events-none absolute inset-0 z-[3] rounded-[inherit] opacity-30"
          style={{ background: `radial-gradient(circle at 50% 120%, ${accent}55, transparent 55%)` }}
          animate={{
            opacity: m?.pulseOpacity ?? [0.22, 0.38, 0.22],
          }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      {fe.has("horizon_line") && anchor === "depth" ? (
        <div
          className="pointer-events-none absolute bottom-[22%] left-[6%] right-[6%] z-[4] h-px opacity-30"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}55, transparent)`,
          }}
        />
      ) : null}

      {fe.has("split_plane") && anchor === "depth" ? (
        <div
          className="pointer-events-none absolute inset-0 z-[3] rounded-[inherit] opacity-[0.12]"
          style={{
            background: `linear-gradient(115deg, transparent 40%, ${accent}18 50%, transparent 60%)`,
          }}
        />
      ) : null}

      {(fe.has("neural_cluster") || anchor === "neural") && (
        <svg
          className="pointer-events-none absolute inset-0 z-[4] h-full w-full rounded-[inherit] text-cyan-400/35"
          viewBox="0 0 400 140"
          preserveAspectRatio="none"
        >
          <motion.path
            d="M32,72 C100,28 180,108 268,48 S352,92 378,68"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.25, delay: 0.1 }}
          />
          <motion.path
            d="M48,88 C130,52 210,120 290,72 S340,96 368,82"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.75"
            opacity={0.65}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, delay: 0.2 }}
          />
          {(
            [
              [44, 70],
              [118, 44],
              [196, 84],
              [268, 52],
              [312, 78],
              [352, 64],
            ] as const
          ).map(([x, y], i) => (
            <motion.circle
              key={`nn-${idx}-${i}`}
              cx={x}
              cy={y}
              r={tier >= 3 ? 3.5 : 3}
              fill="currentColor"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.22 + i * 0.06 }}
            />
          ))}
        </svg>
      )}

      {(fe.has("signal_line") || anchor === "signal") && (
        <>
          <motion.div
            className="pointer-events-none absolute left-[6%] right-[6%] top-[42%] z-[4] h-px -translate-y-1/2"
            style={{
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              boxShadow: `0 0 14px ${accent}`,
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          />
          {tier >= 2 ? (
            <div
              className="pointer-events-none absolute left-[12%] right-[12%] top-[46%] z-[4] h-px opacity-25"
              style={{
                background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              }}
            />
          ) : null}
          {fe.has("pulse_dot") ? (
            <motion.div
              className="pointer-events-none absolute left-1/2 top-[42%] z-[5] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.05, 0.9] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : null}
        </>
      )}

      {(fe.has("holo_disc") || anchor === "holographic") && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-[4] rounded-[inherit] opacity-40 mix-blend-screen"
          style={{
            background: `conic-gradient(from 200deg at 50% 50%, ${accent}38, transparent 38%, rgba(244,114,182,0.28) 68%, transparent)`,
            transformOrigin: "50% 50%",
          }}
          animate={{ rotate: reduceMotion ? 0 : [0, 360] }}
          transition={{ duration: reduceMotion ? 0 : 52, repeat: Infinity, ease: "linear" }}
        />
      )}

      {fe.has("ambient_sweep") && tier >= 3 ? (
        <motion.div
          className="pointer-events-none absolute inset-0 z-[3] rounded-[inherit] opacity-20 mix-blend-overlay"
          style={{
            background: `linear-gradient(100deg, transparent 0%, ${accent}22 50%, transparent 100%)`,
            backgroundSize: "200% 100%",
          }}
          animate={
            reduceMotion
              ? undefined
              : {
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }
          }
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        />
      ) : null}

      {fe.has("glow_frame") && anchor === "holographic" ? (
        <div
          className="pointer-events-none absolute inset-4 z-[5] rounded-xl"
          style={{
            boxShadow: `0 0 0 1px rgba(255,255,255,0.1), 0 0 40px -8px ${accent}66, inset 0 0 60px -20px ${accent}22`,
          }}
        />
      ) : null}

      {fe.has("data_panels") && dataPanels.length > 0 ? (
        <div className="pointer-events-none absolute right-3 top-3 z-[8] flex flex-col gap-1.5">
          {dataPanels.map((row, i) => (
            <motion.div
              key={`dp-${idx}-${i}`}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-lg border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[10px] shadow-lg backdrop-blur-md"
              style={{ boxShadow: `0 0 20px -6px ${accent}44` }}
            >
              <span className="font-medium text-slate-500">{String(row.label ?? "")}</span>
              <span className="ml-2 font-semibold tabular-nums text-slate-100">{String(row.value ?? "")}</span>
            </motion.div>
          ))}
        </div>
      ) : null}

      {fe.has("glass_row") && anchor === "holographic" ? (
        <div className="pointer-events-none absolute bottom-10 left-3 right-3 z-[7] flex justify-center gap-2 opacity-90">
          {["Chroma", "Glass", "Depth"].map((lab, i) => (
            <div
              key={`gr-${idx}-${i}`}
              className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-slate-400 backdrop-blur-sm"
            >
              {lab}
            </div>
          ))}
        </div>
      ) : null}

      <div
        className="relative z-[25]"
        style={{
          boxShadow: near?.contentShadow,
          transform: near && near.contentLift !== 1 ? `scale(${near.contentLift})` : undefined,
          transformOrigin: "50% 0%",
        }}
      >
        {children}
      </div>
    </div>
  );
}
