"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, type CSSProperties } from "react";
import { BackgroundIntelligenceLayer } from "@/components/site-builder/preview/troothertz/BackgroundIntelligenceLayer";
import { TroothertzHeroDepthStack } from "@/components/site-builder/preview/troothertz/TroothertzHeroDepthStack";
import { useCinematicPreviewV3 } from "@/components/site-builder/preview/cinematic-preview-v3-context";
import { getBlockPlacement, getBlockStyle } from "@/lib/site-builder/preview/blockPreviewUtils";
import { parseCinematicMotionFromBlock } from "@/lib/site-builder/preview/cinematic-v3-preview-utils";
import { THZ_EASE_OUT, THZ_MOTION } from "@/lib/site-builder/ai/visual-tokens";

type BlockContent = Record<string, unknown> & {
  style?: Record<string, unknown>;
  visual?: Record<string, unknown>;
  motion?: Record<string, unknown>;
  title?: string;
  subtitle?: string;
  body?: string;
  text?: string;
  label?: string;
  href?: string;
  level?: string;
  variant?: string;
  items?: string[];
  images?: Array<{ src?: string; alt?: string }>;
  stats?: Array<{ value?: string; label?: string }>;
  floatingCards?: Array<{ label?: string }>;
};

type PreviewBlock = {
  type?: string;
  src?: string;
  href?: string;
  items?: string[];
  content?: BlockContent;
};

const stagger = THZ_MOTION.staggerBlock;

function SiteBuilderHeroPreview({ raw, idx }: { raw: unknown; idx: number }) {
  const block = raw as PreviewBlock;
  const c = block.content || {};
  const visual = (c.visual || {}) as Record<string, unknown>;
  const mot = (c.motion || {}) as {
    entrance?: string;
    stagger?: number;
    hover?: string;
    staggerChildren?: number;
    backgroundPulse?: boolean;
  };
  const cine = parseCinematicMotionFromBlock(raw);
  const cinV3 = cine;
  const cinCtx = useCinematicPreviewV3();
  const systemRm = useReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll(
    cinCtx?.scrollRef
      ? { container: cinCtx.scrollRef, target: sectionRef, offset: ["start end", "end start"] }
      : { target: sectionRef, offset: ["start end", "end start"] },
  );
  const parallaxK =
    cinV3?.type === "parallax" && !systemRm && !cinCtx?.reduceHeavyMotion
      ? (cinCtx?.motionIntensity ?? 0.5) * (cinV3?.intensity ?? 0.55)
      : 0;
  const parallaxBackgroundY = useTransform(scrollYProgress, [0, 1], [0, -18 * parallaxK]);
  const layout = String(c.layout || "stack");
    const gradient = String(visual.gradient || "linear-gradient(135deg, rgba(30,27,75,0.9), rgba(15,23,42,0.95))");
    const glow = visual.glowShadow ? String(visual.glowShadow) : "0 0 48px rgba(99,102,241,0.2)";
    const depthShadow = `0 22px 56px -18px rgba(0,0,0,0.5), 0 4px 16px -6px ${String(visual.accent || "#6366f1")}2a, inset 0 1px 0 rgba(255,255,255,0.06)`;
    const noise = typeof visual.noise === "number" ? visual.noise : 0.03;
    const grid = typeof visual.gridOverlay === "number" ? visual.gridOverlay : 0.06;
    const floating = Array.isArray(visual.floatingCards) ? (visual.floatingCards as Array<{ label?: string }>) : [];
    const anchor = visual.anchor ? String(visual.anchor) : "";
    const accent = visual.accent ? String(visual.accent) : "#22d3ee";
    const ambientGlow = visual.ambientGlow ? String(visual.ambientGlow) : undefined;
    const rhythmOverlay = visual.rhythmOverlay ? String(visual.rhythmOverlay) : undefined;
    const animateBg = Boolean(visual.animateBackground) && !parallaxK;
    const anchorNodes = Array.isArray(visual.anchors) ? (visual.anchors as Array<{ id?: string; label?: string }>) : [];
    const entranceY = mot.entrance === "fade" ? 6 : 12;
    const bgPulse = mot.backgroundPulse === true;
    const signatureAnchor = ["neural", "depth", "signal", "holographic"].includes(anchor);
    const headlineScale = String(c.headlineScale || "hero-md");
    const titleClass =
      headlineScale === "hero-xl"
        ? "text-2xl font-bold leading-tight tracking-tight text-slate-50 md:text-[2.75rem] md:leading-[1.05]"
        : headlineScale === "hero-lg"
          ? "text-xl font-semibold leading-tight text-slate-50 md:text-4xl md:leading-tight"
          : "text-lg font-semibold leading-tight text-slate-50 md:text-2xl md:leading-tight";
    const ctaEmphasis = visual.ctaEmphasis === true;
    const ub = visual.background as {
      type?: string;
      value?: string;
      behavior?: string;
      fallbackColor?: string;
      mimeType?: string;
    } | undefined;
    const userBgLayer =
      ub?.type === "color" && ub.value ? (
        <div className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]" style={{ background: ub.value }} />
      ) : ub?.type === "image" && ub.value ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
          style={{
            backgroundColor: ub.fallbackColor || "#0f172a",
            backgroundImage: `url(${ub.value})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: ub.behavior === "scroll" ? "scroll" : "fixed",
          }}
        />
      ) : ub?.type === "video" && ub.value ? (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
          <video className="h-full w-full object-cover" autoPlay muted loop playsInline>
            <source src={ub.value} type={ub.mimeType || "video/mp4"} />
          </video>
        </div>
      ) : null;

    const v3CinematicOverlays = (
      <>
        <div
          className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(145deg,rgba(99,102,241,0.12)_0%,transparent_42%,rgba(34,211,238,0.08)_100%)]"
          style={{ mixBlendMode: "soft-light" }}
        />
        <div
          className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-slate-950/25 via-transparent to-slate-950/55"
          style={{ mixBlendMode: "multiply" }}
        />
        <div
          className="absolute inset-0 rounded-[inherit] [background:radial-gradient(ellipse_85%_55%_at_12%_15%,rgba(99,102,241,0.2),transparent_60%)]"
          style={{ filter: "blur(0.5px)" }}
        />
        <div
          className="absolute -right-[8%] top-[-5%] h-2/3 w-1/2 rounded-full opacity-70 blur-3xl"
          style={{ background: `radial-gradient(circle at center, ${accent}55, transparent 68%)` }}
        />
        <div
          className="absolute inset-0 rounded-[inherit] [background:radial-gradient(ellipse_120%_80%_at_50%_120%,rgba(15,23,42,0.5),transparent_50%)]"
        />
      </>
    );

    const heroBody = (
      <>
        <div
          className={`relative z-10 flex flex-col gap-3 [transform:translateZ(0)] ${layout === "split" ? "md:flex-row md:items-center md:justify-between md:gap-6" : ""} ${layout === "grid" ? "md:grid md:grid-cols-[1fr_auto] md:items-center" : ""}`}
        >
          <div
            className="min-w-0 space-y-2 backdrop-blur-[1px] supports-[backdrop-filter]:bg-slate-950/10"
            style={{ boxShadow: "0 12px 40px -24px rgba(0,0,0,0.4)" }}
          >
            <motion.h1
              initial={{ opacity: 0, y: entranceY, filter: "blur(6px)", scale: 0.98 }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 100,
                damping: 20,
                delay: 0.04 + idx * stagger,
              }}
              className={titleClass}
            >
              {String(c.title || "Hero")}
            </motion.h1>
            {c.subtitle ? (
              <motion.p
                initial={{ opacity: 0, y: entranceY * 0.75 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: THZ_MOTION.micro.duration,
                  delay: 0.12 + idx * stagger,
                  ease: THZ_EASE_OUT,
                }}
                className="text-sm leading-relaxed text-slate-400"
              >
                {String(c.subtitle)}
              </motion.p>
            ) : null}
            {c.label && c.href ? (
              <motion.a
                href={String(c.href || "#")}
                className="mt-2 inline-flex w-fit items-center justify-center rounded-full border border-cyan-400/35 bg-slate-950/50 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/25 backdrop-blur-sm transition-colors hover:border-cyan-300/50"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + idx * stagger, type: "spring", stiffness: 200, damping: 22 }}
                whileHover={{ scale: 1.04, boxShadow: `0 0 32px ${accent}66, 0 14px 32px -10px ${accent}55` }}
                whileTap={{ scale: 0.98 }}
              >
                {String(c.label)}
              </motion.a>
            ) : null}
          </div>
          {floating.length > 0 ? (
            <div className="flex flex-wrap gap-2 md:justify-end">
              {floating.map((card, i) => (
                <motion.div
                  key={`float-${idx}-${i}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 + i * (mot.staggerChildren || 0.08) }}
                  whileHover={
                    mot.hover === "glow"
                      ? { y: -2, boxShadow: `0 12px 40px ${accent}33` }
                      : mot.hover === "lift"
                        ? { y: -3 }
                        : {}
                  }
                  className={`rounded-xl border px-3 py-2 text-xs font-medium shadow-inner backdrop-blur-sm ${
                    ctaEmphasis
                      ? "border-cyan-400/35 bg-slate-950/55 text-cyan-50 shadow-[0_0_28px_-6px_rgba(34,211,238,0.28)]"
                      : "border-white/10 bg-slate-950/50 text-indigo-100/90"
                  }`}
                >
                  {String(card.label || "")}
                </motion.div>
              ))}
            </div>
          ) : null}
        </div>
        {anchorNodes.length > 0 ? (
          <div className="pointer-events-none relative z-30 mt-3 flex flex-wrap justify-end gap-1.5">
            {anchorNodes.map((a, i) => (
              <span
                key={`anc-${idx}-${a.id ?? i}`}
                className="rounded-md border border-white/10 bg-slate-950/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400 backdrop-blur-sm"
              >
                {String(a.label ?? "")}
              </span>
            ))}
          </div>
        ) : null}
      </>
    );

    return (
      <motion.section
        key={`side-preview-${idx}`}
        ref={sectionRef}
        initial={{ opacity: 0, y: THZ_MOTION.section.y }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: THZ_MOTION.section.duration, delay: idx * stagger, ease: THZ_EASE_OUT }}
        className="relative isolate [z-index:1]"
        style={idx === 0 ? { zIndex: 2 } : undefined}
      >
        <BackgroundIntelligenceLayer
          gradient={gradient}
          glowShadow={glow}
          ambientGlow={ambientGlow}
          noiseOpacity={noise}
          gridOpacity={grid}
          animateBackground={animateBg}
          parallaxBackgroundY={parallaxK ? parallaxBackgroundY : undefined}
          cinematicOverlays={!cinCtx?.reduceHeavyMotion && !systemRm ? v3CinematicOverlays : <div className="absolute inset-0 rounded-[inherit] bg-slate-950/15" aria-hidden />}
          className="rounded-2xl border border-white/[0.08] p-5"
          rootStyle={{ boxShadow: depthShadow }}
        >
          <>
            {userBgLayer}
            {signatureAnchor ? (
              <TroothertzHeroDepthStack
                visual={visual}
                accent={accent}
                idx={idx}
                anchor={anchor}
                rhythmOverlay={rhythmOverlay}
                bgPulse={bgPulse}
              >
                {heroBody}
              </TroothertzHeroDepthStack>
            ) : (
              <div className="relative">
                {rhythmOverlay ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-[2] rounded-[inherit]"
                    style={{ background: rhythmOverlay }}
                  />
                ) : null}
                {bgPulse ? (
                  <motion.div
                    className="pointer-events-none absolute inset-0 z-[3] rounded-[inherit] opacity-30"
                    style={{ background: `radial-gradient(circle at 50% 120%, ${accent}55, transparent 55%)` }}
                    animate={{ opacity: [0.22, 0.38, 0.22] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                ) : null}
                {heroBody}
              </div>
            )}
          </>
        </BackgroundIntelligenceLayer>
      </motion.section>
    );
}

export function SiteBuilderPreviewBlock({ block: raw, index: idx }: { block: unknown; index: number }) {
  const block = raw as PreviewBlock;
  const style = getBlockStyle(block);
  const type = String(block?.type || "");
  const align = getBlockPlacement(block);
  const alignClass =
    align === "center" ? "justify-center text-center" : align === "right" ? "justify-end text-right" : "justify-start text-left";
  const c = block.content || {};
  const visual = (c.visual || {}) as Record<string, unknown>;
  const mot = (c.motion || {}) as {
    entrance?: string;
    stagger?: number;
    hover?: string;
    staggerChildren?: number;
    backgroundPulse?: boolean;
  };

  if (type === "hero") {
    return <SiteBuilderHeroPreview raw={raw} idx={idx} />;
  }

  if (type === "stat_band") {
    const stats = Array.isArray(c.stats) ? (c.stats as Array<{ value?: string; label?: string }>) : [];
    const barGrad = String(visual.gradient || "linear-gradient(90deg, transparent, rgba(56,189,248,0.15), transparent)");
    const ring = visual.ringAccent ? String(visual.ringAccent) : "#38bdf8";
    const edgeGlow = visual.edgeGlow === true;
    const rhythmOverlay = visual.rhythmOverlay ? String(visual.rhythmOverlay) : undefined;
    const sd = visual.sectionDepth as Record<string, unknown> | undefined;
    const cont = visual.continuity as Record<string, unknown> | undefined;
    const farWash = sd?.farWash ? String(sd.farWash) : undefined;
    const shellShadow = sd?.shellShadow ? String(sd.shellShadow) : undefined;
    const sdEdge = sd?.edgeGlow ? String(sd.edgeGlow) : undefined;
    const motifs = Array.isArray(sd?.motifs) ? (sd.motifs as string[]) : [];
    const soften = cont?.softenGlow === true;
    const ambientBleed = cont?.ambientBleed ? String(cont.ambientBleed) : undefined;
    const topLine = cont?.topLine ? String(cont.topLine) : undefined;
    const showNodeRail = motifs.includes("node_rail_fragment") || motifs.includes("restraint_motes");
    const restraintOnly = motifs.includes("restraint_motes") && !motifs.includes("node_rail_fragment");
    const boxShadowMerged = [
      shellShadow,
      sdEdge && !soften ? sdEdge : sdEdge && soften ? "0 0 20px -10px rgba(56,189,248,0.22)" : "",
      edgeGlow && !soften ? `0 0 40px -12px ${ring}38` : edgeGlow ? `0 0 28px -12px ${ring}26` : "",
      "inset 0 1px 0 rgba(255,255,255,0.05)",
    ]
      .filter(Boolean)
      .join(", ");
    return (
      <motion.div
        key={`side-preview-${idx}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: THZ_MOTION.section.duration, delay: idx * stagger, ease: THZ_EASE_OUT }}
        className="relative overflow-hidden rounded-xl border border-white/[0.08] py-4"
        style={{
          background: barGrad,
          boxShadow: boxShadowMerged || undefined,
        }}
      >
        {farWash ? (
          <div className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-90" style={{ background: farWash }} />
        ) : null}
        {ambientBleed ? (
          <div className="pointer-events-none absolute inset-0 z-[0] rounded-[inherit] mix-blend-screen" style={{ background: ambientBleed }} />
        ) : null}
        {topLine ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[4] h-px opacity-80" style={{ background: topLine }} />
        ) : null}
        {rhythmOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-[1]" style={{ background: rhythmOverlay }} />
        ) : null}
        {edgeGlow ? (
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${ring}, transparent)` }}
            animate={{ opacity: soften ? [0.25, 0.55, 0.25] : [0.35, 0.85, 0.35] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
        {/* Match static export: .stat-band .stat-row stacks below 640px (see site.css). */}
        <div className="relative z-[3] flex flex-col items-center gap-[18px] px-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={`st-${idx}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * (typeof mot.stagger === "number" ? mot.stagger : 0.1), ease: THZ_EASE_OUT }}
              whileHover={mot.hover === "lift" ? { y: -2 } : undefined}
              className={`text-center ${motifs.includes("glow_underline") ? "rounded-lg px-2 pb-1" : ""}`}
              style={
                motifs.includes("glow_underline")
                  ? { boxShadow: `0 8px 24px -10px ${ring}22`, borderBottom: `1px solid rgba(255,255,255,0.08)` }
                  : undefined
              }
            >
              <div className="text-2xl font-semibold tracking-tight tabular-nums text-slate-50">{String(s.value || "—")}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{String(s.label || "")}</div>
            </motion.div>
          ))}
        </div>
        {showNodeRail ? (
          <div
            className={`pointer-events-none relative z-[3] mt-3 flex justify-center ${restraintOnly ? "gap-4 opacity-[0.34]" : "gap-3 opacity-50"}`}
          >
            {[0, 1, 2, 3, 4].map((j) => (
              <span
                key={`nr-${idx}-${j}`}
                className={restraintOnly ? "h-[3px] w-[3px] rounded-full" : "h-1 w-1 rounded-full"}
                style={{ background: ring, boxShadow: `0 0 6px ${ring}` }}
              />
            ))}
          </div>
        ) : null}
      </motion.div>
    );
  }

  if (type === "visual_break") {
    const variant = String(c.variant || "gradient_divider");
    const h = Number(visual.height || (variant === "glow_strip" ? 64 : 2));
    const grad = String(visual.gradient || "linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)");
    const shimmer = visual.shimmer === true;
    const shimmerBand = visual.shimmerBand === true;
    const bgPulse = mot.backgroundPulse === true;
    const rhythmOverlay = visual.rhythmOverlay ? String(visual.rhythmOverlay) : undefined;
    const sd = visual.sectionDepth as Record<string, unknown> | undefined;
    const lip = sd?.dividerGlow ? String(sd.dividerGlow) : undefined;
    const motifs = Array.isArray(sd?.motifs) ? (sd.motifs as string[]) : [];
    const echo = motifs.includes("carry_gradient");
    return (
      <motion.div
        key={`side-preview-${idx}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: THZ_MOTION.section.duration, delay: idx * stagger, ease: THZ_EASE_OUT }}
        className="relative w-full overflow-hidden rounded-lg"
        style={{
          height: h,
          background: variant === "glow_strip" ? grad : undefined,
          boxShadow:
            variant === "glow_strip" && visual.glowShadow
              ? String(visual.glowShadow)
              : sd?.edgeGlow
                ? String(sd.edgeGlow)
                : undefined,
        }}
      >
        {variant === "gradient_divider" && lip ? (
          <div
            className="pointer-events-none absolute left-[5%] right-[5%] top-0 z-[3] h-[2px] rounded-full opacity-70"
            style={{ background: lip }}
          />
        ) : null}
        {echo && variant === "gradient_divider" ? (
          <div
            className="pointer-events-none absolute inset-0 z-[0] opacity-30 mix-blend-overlay"
            style={{ background: `linear-gradient(100deg, transparent, rgba(99,102,241,0.15), transparent)` }}
          />
        ) : null}
        {rhythmOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-[1] mix-blend-overlay" style={{ background: rhythmOverlay }} />
        ) : null}
        {variant === "gradient_divider" ? (
          <motion.div
            className="h-full w-full rounded-full"
            style={{
              background: grad,
              minHeight: 2,
              backgroundSize: shimmer ? "200% 100%" : undefined,
            }}
            animate={shimmer || bgPulse ? { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] } : undefined}
            transition={shimmer || bgPulse ? { duration: 10, repeat: Infinity, ease: "linear" } : undefined}
          />
        ) : null}
        {variant === "glow_strip" && shimmerBand ? (
          <motion.div
            className="pointer-events-none absolute inset-0 z-[2] opacity-50 mix-blend-screen"
            style={{
              background: "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)",
              backgroundSize: "200% 100%",
            }}
            animate={{ backgroundPosition: ["0% 0%", "100% 0%"] }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          />
        ) : null}
      </motion.div>
    );
  }

  if (type === "list") {
    const items = (Array.isArray(block.items) ? block.items : Array.isArray(c.items) ? c.items : []) as string[];
    const isTrust = c.variant === "trust_strip";
    if (isTrust) {
      const accent = String(visual.accent || "#38bdf8");
      const ro = visual.rhythmOverlay ? String(visual.rhythmOverlay) : undefined;
      const cont = visual.continuity as Record<string, unknown> | undefined;
      const sd = visual.sectionDepth as Record<string, unknown> | undefined;
      const farWash = sd?.farWash ? String(sd.farWash) : undefined;
      const shellShadow = sd?.shellShadow ? String(sd.shellShadow) : undefined;
      const ambientBleed = cont?.ambientBleed ? String(cont.ambientBleed) : undefined;
      const topLine = cont?.topLine ? String(cont.topLine) : undefined;
      const echo = cont?.echoSignal === true;
      return (
        <motion.div
          key={`side-preview-${idx}`}
          initial={{ opacity: 0, y: THZ_MOTION.micro.yOffset }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: THZ_MOTION.micro.duration, delay: idx * stagger, ease: THZ_EASE_OUT }}
          className="relative flex flex-wrap gap-2 overflow-hidden rounded-xl px-1 py-1"
          style={shellShadow ? { boxShadow: shellShadow } : undefined}
        >
          {farWash ? (
            <div className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-90" style={{ background: farWash }} />
          ) : null}
          {ambientBleed ? (
            <div className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-90" style={{ background: ambientBleed }} />
          ) : null}
          {topLine ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-px opacity-70" style={{ background: topLine }} />
          ) : null}
          {ro ? (
            <div className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]" style={{ background: ro }} />
          ) : null}
          {items.map((t, i) => (
            <motion.span
              key={`tr-${idx}-${i}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ scale: 1.02 }}
              className="relative z-10 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-[11px] font-medium text-slate-200"
              style={{ boxShadow: `0 0 0 1px ${accent}33` }}
            >
              {t}
            </motion.span>
          ))}
          {echo ? (
            <div className="pointer-events-none absolute bottom-1 right-2 z-[3] flex gap-1 opacity-40">
              {[0, 1, 2].map((k) => (
                <span key={`echo-${idx}-${k}`} className="h-0.5 w-2 rounded-full bg-cyan-400/80" />
              ))}
            </div>
          ) : null}
        </motion.div>
      );
    }
    return (
      <motion.ul
        key={`side-preview-${idx}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="list-inside list-decimal space-y-1 text-sm text-slate-300"
        style={style}
      >
        {items.map((t, i) => (
          <motion.li
            key={`li-${idx}-${i}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * (typeof mot.stagger === "number" ? mot.stagger : 0.05) }}
          >
            {t}
          </motion.li>
        ))}
      </motion.ul>
    );
  }

  if (type === "call_to_action") {
    const hover = mot.hover === "glow" ? "hover:shadow-[0_0_24px_rgba(99,102,241,0.25)]" : "hover:-translate-y-0.5";
    const sd = visual.sectionDepth as Record<string, unknown> | undefined;
    const cont = visual.continuity as Record<string, unknown> | undefined;
    const shellShadow = sd?.shellShadow ? String(sd.shellShadow) : undefined;
    const farWash = sd?.farWash ? String(sd.farWash) : undefined;
    const ambientBleed = cont?.ambientBleed ? String(cont.ambientBleed) : undefined;
    const motifs = Array.isArray(sd?.motifs) ? (sd.motifs as string[]) : [];
    const glass = motifs.includes("glass_panel");
    return (
      <motion.section
        key={`side-preview-${idx}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: idx * stagger }}
        whileHover={{ scale: 1.01 }}
        className={`relative overflow-hidden rounded-2xl border border-cyan-500/25 p-4 shadow-inner ${glass ? "backdrop-blur-md" : "bg-slate-950/50"} ${hover}`}
        style={{ boxShadow: shellShadow }}
      >
        {farWash ? <div className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-80" style={{ background: farWash }} /> : null}
        {ambientBleed ? (
          <div className="pointer-events-none absolute inset-0 z-[0] rounded-[inherit]" style={{ background: ambientBleed }} />
        ) : null}
        <div className="relative z-10">
          <h3 className="text-base font-semibold text-slate-100">{String(c.title || "CTA")}</h3>
          {c.body ? <p className="mt-1 text-sm text-slate-400">{String(c.body)}</p> : null}
          <motion.a
            href={String(c.href || "#")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.99 }}
            className="mt-3 inline-flex rounded-full bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100"
          >
            {String(c.label || "Continue")}
          </motion.a>
        </div>
      </motion.section>
    );
  }

  if (type === "section") {
    return (
      <motion.section
        key={`side-preview-${idx}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: idx * stagger }}
        className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-3"
        style={style}
      >
        <h2 className="text-sm font-semibold text-slate-200">{String(c.title || "Section")}</h2>
        <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{String(c.body || "")}</pre>
      </motion.section>
    );
  }

  if (type === "text") {
    const cont = visual.continuity as Record<string, unknown> | undefined;
    const sd = visual.sectionDepth as Record<string, unknown> | undefined;
    const ambientBleed = cont?.ambientBleed ? String(cont.ambientBleed) : undefined;
    const topLine = cont?.topLine ? String(cont.topLine) : undefined;
    const farWash = sd?.farWash ? String(sd.farWash) : undefined;
    const shellShadow = sd?.shellShadow ? String(sd.shellShadow) : undefined;
    const layered = Boolean(ambientBleed || topLine || farWash);
    return (
      <motion.p
        key={`side-preview-${idx}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * stagger }}
        className={`text-sm leading-relaxed text-slate-400 ${layered ? "relative overflow-hidden rounded-xl px-2.5 py-2" : "relative"}`}
        style={{ ...style, boxShadow: shellShadow || undefined }}
      >
        {farWash ? (
          <span
            className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-[0.82]"
            style={{ background: farWash }}
          />
        ) : null}
        {ambientBleed ? (
          <span
            className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-[0.88]"
            style={{ background: ambientBleed }}
          />
        ) : null}
        {topLine ? (
          <span className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-px opacity-75" style={{ background: topLine }} />
        ) : null}
        <span className="relative z-[3] block">{String(c.body || "")}</span>
      </motion.p>
    );
  }

  if (type === "footer") {
    return (
      <motion.footer
        key={`side-preview-${idx}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-500"
        style={style}
      >
        {String(c.body || "")}
      </motion.footer>
    );
  }

  if (type === "image_grid") {
    const images = Array.isArray(c.images) ? c.images : [];
    const sd = visual.sectionDepth as Record<string, unknown> | undefined;
    const cont = visual.continuity as Record<string, unknown> | undefined;
    const farWash = sd?.farWash ? String(sd.farWash) : undefined;
    const shellShadow = sd?.shellShadow ? String(sd.shellShadow) : undefined;
    const cardSh = sd?.cardShadow ? String(sd.cardShadow) : undefined;
    const ambientBleed = cont?.ambientBleed ? String(cont.ambientBleed) : undefined;
    return (
      <motion.div
        key={`side-preview-${idx}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: idx * stagger }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.06] p-3"
        style={{ boxShadow: shellShadow }}
      >
        {farWash ? <div className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-95" style={{ background: farWash }} /> : null}
        {ambientBleed ? (
          <div className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] mix-blend-overlay" style={{ background: ambientBleed }} />
        ) : null}
        <div className="relative z-10 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {images.map((im, i) => (
            <motion.div
              key={`ig-${idx}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -3 }}
              className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-slate-900/60"
              style={{
                backgroundImage: im.src ? `url(${im.src})` : undefined,
                backgroundSize: "cover",
                boxShadow: cardSh,
              }}
            >
              {!im.src ? <div className="flex h-full items-center justify-center p-2 text-center text-[10px] text-slate-500">{im.alt || "Feature"}</div> : null}
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (type === "avatar") {
    const ac = block.content || {};
    const shape = String(ac.shape || "circle");
    const radius = shape === "circle" ? "9999px" : shape === "rounded" ? "16px" : "0px";
    const width = Number(ac.width || 72);
    const height = Number(ac.height || 72);
    const avatarStyle = (ac.style || {}) as Record<string, unknown>;
    const avatarBorderStyle: CSSProperties = {
      borderWidth: typeof avatarStyle.borderWidth === "number" ? `${avatarStyle.borderWidth}px` : undefined,
      borderStyle: avatarStyle.borderWidth ? String(avatarStyle.borderStyle || "solid") : undefined,
      borderColor:
        avatarStyle.borderColor !== undefined && avatarStyle.borderColor !== null && avatarStyle.borderColor !== ""
          ? (String(avatarStyle.borderColor) as CSSProperties["borderColor"])
          : undefined,
    };
    return (
      <div key={`side-preview-${idx}`} style={style} className={`flex ${alignClass}`}>
        {block?.src ? (
          <img
            src={String(block.src)}
            alt="Avatar"
            style={{ width, height, borderRadius: radius, objectFit: "cover", ...avatarBorderStyle }}
          />
        ) : (
          <div style={{ width, height, borderRadius: radius, background: "#1e293b", ...avatarBorderStyle }} />
        )}
      </div>
    );
  }

  if (type === "heading") {
    const lv = String(c.level || "h2").toLowerCase();
    const isH3 = lv === "h3";
    const text = String(c.text || "Heading");
    const alignStyle = { ...style, textAlign: align as CSSProperties["textAlign"] };
    return isH3 ? (
      <motion.h3
        key={`side-preview-${idx}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        style={alignStyle}
        className="text-sm font-semibold text-slate-300"
      >
        {text}
      </motion.h3>
    ) : (
      <motion.h2
        key={`side-preview-${idx}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        style={alignStyle}
        className="text-base font-semibold text-slate-200"
      >
        {text}
      </motion.h2>
    );
  }

  if (type === "paragraph") {
    const ro = visual.rhythmOverlay ? String(visual.rhythmOverlay) : undefined;
    const cont = visual.continuity as Record<string, unknown> | undefined;
    const sd = visual.sectionDepth as Record<string, unknown> | undefined;
    const ambientBleed = cont?.ambientBleed ? String(cont.ambientBleed) : undefined;
    const topLine = cont?.topLine ? String(cont.topLine) : undefined;
    const farWash = sd?.farWash ? String(sd.farWash) : undefined;
    const shellShadow = sd?.shellShadow ? String(sd.shellShadow) : undefined;
    const layered = Boolean(ro || farWash || ambientBleed || topLine);
    return (
      <motion.p
        key={`side-preview-${idx}`}
        initial={{ opacity: 0, y: THZ_MOTION.micro.yOffset }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: THZ_MOTION.micro.duration, delay: idx * stagger, ease: THZ_EASE_OUT }}
        style={{ ...style, textAlign: align as CSSProperties["textAlign"], boxShadow: shellShadow || undefined }}
        className={`relative overflow-hidden text-sm text-slate-400 ${layered ? "rounded-xl px-3 py-2" : ""}`}
      >
        {farWash ? (
          <span
            className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-[0.82]"
            style={{ background: farWash }}
          />
        ) : null}
        {ambientBleed ? (
          <span
            className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-[0.88]"
            style={{ background: ambientBleed }}
          />
        ) : null}
        {ro ? (
          <span className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit]" style={{ background: ro }} />
        ) : null}
        {topLine ? (
          <span className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-px opacity-75" style={{ background: topLine }} />
        ) : null}
        <span className="relative z-[3] block">{String(c.text || "")}</span>
      </motion.p>
    );
  }

  if (type === "divider") {
    return (
      <hr
        key={`side-preview-${idx}`}
        style={{
          borderColor: String(c.color || "#334155"),
          borderTopWidth: Number(c.thickness || 1),
          borderTopStyle: "solid",
          transform: `translateY(${Number(c.offsetY || 0)}px)`,
          ...style,
        }}
      />
    );
  }

  if (type === "socials") {
    const rawLinks = c.links;
    const links = Array.isArray(rawLinks) ? (rawLinks as Array<Record<string, unknown>>) : [];
    return (
      <div key={`side-preview-${idx}`} className={`flex ${alignClass}`}>
        <div className="flex flex-nowrap items-center gap-2 overflow-auto rounded-xl border border-slate-700 bg-slate-900/70 px-2 py-2">
          {links.length ? (
            links.map((entry, linkIdx: number) => {
              const href = String(entry?.href || "#");
              const label = String(entry?.label || entry?.platform || "Social");
              const favicon = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(href)}&sz=64`;
              return (
                <a
                  key={`social-${idx}-${linkIdx}`}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-950 px-2 py-1 text-[11px] text-cyan-200 whitespace-nowrap"
                >
                  <img src={favicon} alt="" className="h-4 w-4 rounded-sm" />
                  <span>{label}</span>
                </a>
              );
            })
          ) : (
            <span className="text-xs text-slate-400">Add social links</span>
          )}
        </div>
      </div>
    );
  }

  if (type === "image" || type === "header_image") {
    return block?.src ? (
      <img
        key={`side-preview-${idx}`}
        src={String(block.src)}
        alt={String(c.alt || "image")}
        style={{ ...style, width: "100%", maxHeight: 180, objectFit: String(c.fit || "cover") as CSSProperties["objectFit"] }}
      />
    ) : null;
  }

  if (type === "video") {
    return block?.src ? (
      <video
        key={`side-preview-${idx}`}
        src={String(block.src)}
        controls
        playsInline
        style={{ ...style, width: "100%", maxHeight: 220, borderRadius: 12 }}
      />
    ) : (
      <div key={`side-preview-${idx}`} className="text-xs text-slate-400">
        Add video source
      </div>
    );
  }

  const label = String(c.label || c.title || type);
  const href = String(block?.href || c.href || "#");
  return (
    <div key={`side-preview-${idx}`} className={`flex ${alignClass}`}>
      <a href={href} style={{ ...style, display: "inline-flex", alignItems: "center", width: "fit-content", textDecoration: "none" }}>
        {label}
      </a>
    </div>
  );
}
