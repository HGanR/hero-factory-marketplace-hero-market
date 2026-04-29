"use client";

import { Monitor, Smartphone, Tablet, ExternalLink, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { type CSSProperties, type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { BuilderWorkflowStage } from "@/components/site-builder/builder-workflow-stage";
import {
  resolveSiteBuilderPreviewBackground,
  type PreviewVisualMetaBoost,
} from "@/lib/site-builder/preview/cinematic-preview-background";
import { getPreviewBlockSectionMeta } from "@/lib/site-builder/preview/blockPreviewUtils";
import { getCinematicImageOverlayPlaceholderUrl } from "@/lib/site-builder/preview/cinematic-v3-preview-utils";
import { SiteBuilderPreviewSectionCanvas } from "@/components/site-builder/preview/SiteBuilderPreviewSectionCanvas";
import { SiteBuilderPreviewBlock } from "@/components/site-builder/preview/SiteBuilderPreviewBlocks";
import {
  CinematicAtmosphereScrim,
  CinematicBlockScrollWrap,
  CinematicPreviewV3Provider,
  CinematicSectionTransition,
} from "@/components/site-builder/preview/cinematic-preview-v3-context";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

export type SiteBuilderCanvasEditProps = {
  workflowStage: BuilderWorkflowStage;
  /** Ordered Refine targets (max 3); first is primary for the on-canvas refine chip. */
  selectedSectionIds: string[];
  editorOpenSectionId: string | null;
  busySectionIds: string[];
  flashSuccessSectionIds: string[];
  /** Brief emphasis ring after AI edit (section scope). */
  pulseSectionIds: string[];
  errorSectionId: string | null;
  errorMessage: string | null;
  styleMode?: string;
  onSelectSection: (sectionId: string, sectionType?: string, opts?: { shiftKey?: boolean }) => void;
  onOpenEditor: (sectionId: string) => void;
  onCloseEditor: () => void;
  onSubmitSection: (sectionIds: string[], instruction: string) => Promise<void>;
  onInlineTextEdit: (sectionId: string, previousText: string, nextText: string) => void;
  onReorderSectionDrop: (targetSectionId: string, sourceSectionId: string, position: "before" | "after") => void;
  onDuplicateSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleSectionStyle: (sectionId: string) => void;
  onUpdateSectionSpacing: (sectionId: string, updates: { padding?: number; margin?: number }) => void;
  onApplyStylePreset: (sectionId: string, preset: "minimal" | "corporate" | "web3" | "bold") => void;
  onFixSection: (sectionId: string) => void;
  sectionCritiqueScoreById?: Record<string, number>;
  onDismissFlash: () => void;
  onDismissError: () => void;
};

type Props = {
  livePreviewRef: RefObject<HTMLDivElement | null>;
  firstPageBlocks: unknown[];
  previewDevice: PreviewDevice;
  onPreviewDeviceChange: (d: PreviewDevice) => void;
  previewViewportStyle: CSSProperties | undefined;
  backgroundMode: string;
  gradientStart: string;
  gradientEnd: string;
  customGradient: string;
  backgroundColor: string;
  backgroundMediaUrl: string;
  backgroundMediaType: "image" | "video";
  /** Cinematic layer — must affect preview when set (from `metadata.theme`). */
  gradientStyle?: string;
  depthStyle?: string;
  motionHint?: string;
  buttonStyle?: string;
  /** Cinematic v2 — additive shell layers from `metadata.visualMeta`. */
  visualMetaBoost?: PreviewVisualMetaBoost;
  onOpenPreviewTab: () => void;
  /** Larger preview for AI-first layout */
  variant?: "default" | "hero";
  /** Show a subtle building overlay (e.g. while AI pipeline runs). */
  isLoading?: boolean;
  /** Used to pick loading copy (display only). */
  workflowStage?: BuilderWorkflowStage;
  /** On-canvas Refine targeting (optional; Refine stage only). */
  canvasEdit?: SiteBuilderCanvasEditProps;
  /** Increment to scroll the preview shell to top (e.g. full-page regen). */
  scrollPreviewToTopTrigger?: number;
};

export function SiteBuilderLivePreview({
  livePreviewRef,
  firstPageBlocks,
  previewDevice,
  onPreviewDeviceChange,
  previewViewportStyle,
  backgroundMode,
  gradientStart,
  gradientEnd,
  customGradient,
  backgroundColor,
  backgroundMediaUrl,
  backgroundMediaType,
  gradientStyle,
  depthStyle,
  motionHint,
  buttonStyle,
  visualMetaBoost,
  onOpenPreviewTab,
  variant = "default",
  isLoading = false,
  workflowStage,
  canvasEdit,
  scrollPreviewToTopTrigger = 0,
}: Props) {
  const previewShellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollPreviewToTopTrigger) return;
    previewShellRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [scrollPreviewToTopTrigger]);

  const pulseScrollKey = (canvasEdit?.pulseSectionIds ?? []).join("|");
  useLayoutEffect(() => {
    if (!pulseScrollKey) return;
    const first = canvasEdit?.pulseSectionIds?.[0];
    if (!first) return;
    const root = livePreviewRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-site-builder-section-id="${CSS.escape(first)}"]`);
    requestAnimationFrame(() => {
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [pulseScrollKey, canvasEdit?.pulseSectionIds, livePreviewRef]);

  const loadingMessage =
    !isLoading || !workflowStage
      ? "Working…"
      : workflowStage === "publish"
        ? "Saving…"
        : workflowStage === "refine"
          ? "Applying changes…"
          : "Building your site…";
  const previewShell =
    variant === "hero"
      ? "relative min-h-[min(72vh,820px)] max-h-[85vh] overflow-auto rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_24px_64px_rgba(0,0,0,0.45)] ring-1 ring-indigo-500/10"
      : "relative min-h-[520px] max-h-[78vh] overflow-auto rounded-xl border border-white/[0.08] bg-slate-950/50 p-4 shadow-inner shadow-black/30";

  const deviceLabel = previewDevice === "desktop" ? "Desktop" : previewDevice === "tablet" ? "Tablet" : "Mobile";
  const isEmpty = !Array.isArray(firstPageBlocks) || firstPageBlocks.length === 0;

  const previewBackground = resolveSiteBuilderPreviewBackground({
    backgroundMode,
    gradientStart,
    gradientEnd,
    customGradient,
    backgroundColor,
    gradientStyle,
    visualMetaBoost,
  });

  const mergedVisualMetaBoost = useMemo(
    () =>
      !visualMetaBoost && !motionHint
        ? undefined
        : {
            ...visualMetaBoost,
            motionHint: visualMetaBoost?.motionHint ?? motionHint,
            motionIntensity: visualMetaBoost?.motionIntensity,
            backgroundStyle: visualMetaBoost?.backgroundStyle,
          },
    [visualMetaBoost, motionHint],
  );

  function previewSectionShellClass(raw: unknown): string {
    const ve = (raw as { content?: { visualEngine?: { sectionTone?: string } } })?.content?.visualEngine;
    const t = ve?.sectionTone;
    if (t === "dark") {
      return "rounded-2xl border border-white/[0.06] bg-slate-950/55 p-1.5 shadow-inner shadow-black/25";
    }
    if (t === "visual") {
      return "rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-950/35 via-slate-950/40 to-slate-950/75 p-1.5";
    }
    return "rounded-2xl border border-white/[0.05] bg-slate-900/25 p-1.5";
  }

  const depthRing =
    depthStyle === "cinematic-layered" || depthStyle === "floating-panels"
      ? "inset 0 1px 0 rgba(255,255,255,0.07), 0 40px 120px -32px rgba(0,0,0,0.55)"
      : depthStyle === "card-depth"
        ? "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 64px -28px rgba(0,0,0,0.4)"
        : undefined;

  return (
    <CinematicPreviewV3Provider scrollRef={previewShellRef} visualBoost={mergedVisualMetaBoost} themeMotionHint={motionHint}>
    <motion.div
      className={`${variant === "hero" ? "flex h-full min-h-0 flex-col" : ""}`}
      initial={false}
      animate={variant === "hero" ? { opacity: 1 } : undefined}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">Preview</p>
          <div className="mt-0.5 text-base font-semibold tracking-tight text-slate-100">Live preview</div>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
            Built from your description—responsive layout, ready for desktop, tablet, and phone.
          </p>
          <p className="mt-2 max-w-md text-[11px] leading-relaxed text-slate-500/95">
            Your generated page uses the same Signature visual treatment as this preview—cohesive sections and a polished, calm finish.
          </p>
          {workflowStage === "describe" ? (
            <p className="mt-2 max-w-md text-[11px] leading-relaxed text-slate-500/85">
              The mood can shift with your brief—brighter and forward, steady and credible, or quiet and spare—without changing how you work here.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-0.5 rounded-xl border border-white/[0.08] bg-slate-950/60 p-0.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
            role="group"
            aria-label="Screen size for preview"
          >
            {(["desktop", "tablet", "mobile"] as const).map((device) => (
              <button
                key={device}
                type="button"
                onClick={() => onPreviewDeviceChange(device)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-slate-400 transition-colors ${
                  previewDevice === device
                    ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-100 shadow-[0_0_0_1px_rgba(129,140,248,0.35)]"
                    : "border-transparent hover:bg-white/[0.04] hover:text-slate-200"
                }`}
                title={
                  device === "mobile" && workflowStage === "publish"
                    ? "Phone layout — selecting this marks the Ship checklist mobile step for this project"
                    : `Preview as ${device}`
                }
                aria-label={
                  device === "mobile" && workflowStage === "publish"
                    ? "Preview as mobile — marks publish readiness when you are on the Ship step"
                    : `Preview as ${device}`
                }
                aria-pressed={previewDevice === device}
              >
                {device === "desktop" ? (
                  <Monitor className="h-4 w-4" />
                ) : device === "tablet" ? (
                  <Tablet className="h-4 w-4" />
                ) : (
                  <Smartphone className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
          <span className="hidden text-xs text-slate-500 sm:inline">{deviceLabel}</span>
          <button
            type="button"
            onClick={onOpenPreviewTab}
            aria-label="Open live preview in a new browser tab"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-indigo-400/35 hover:bg-indigo-500/10 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
            Open in new tab
          </button>
        </div>
      </div>
      <div
        ref={previewShellRef}
        className={previewShell}
        style={{
          background: previewBackground,
          boxShadow: depthRing,
        }}
      >
        {buttonStyle === "glow" || buttonStyle === "chrome" ? (
          <div
            className="pointer-events-none absolute bottom-3 right-4 h-8 w-28 rounded-full bg-gradient-to-r from-cyan-400/25 via-fuchsia-400/20 to-indigo-400/30 opacity-80 blur-md"
            aria-hidden
          />
        ) : null}
        {motionHint === "floating-orbs" ? (
          <>
            <div
              className="pointer-events-none absolute left-[8%] top-[12%] h-32 w-32 rounded-full bg-cyan-500/20 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute right-[6%] top-[28%] h-40 w-40 rounded-full bg-fuchsia-500/15 blur-3xl"
              aria-hidden
            />
          </>
        ) : null}
        {motionHint === "subtle-parallax" ? (
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(99,102,241,0.12),transparent_50%)]"
            aria-hidden
          />
        ) : null}
        {mergedVisualMetaBoost?.backgroundStyle === "image-overlay" ? (
          <>
            <div
              className="pointer-events-none absolute inset-0 z-0 max-h-full bg-slate-950/40 bg-cover bg-center"
              style={{
                backgroundImage: `url(${getCinematicImageOverlayPlaceholderUrl("site-builder-preview-shell", 2560)})`,
                filter: "saturate(0.9)",
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 z-0 max-h-full bg-gradient-to-b from-slate-950/92 via-slate-950/68 to-slate-950/94"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 z-0 max-h-full mix-blend-soft-light [background:radial-gradient(ellipse_90%_60%_at_50%_0%,rgba(99,102,241,0.18),transparent_55%)]"
              aria-hidden
            />
          </>
        ) : null}
        <AnimatePresence>
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-slate-950/55 backdrop-blur-[2px]"
            >
              <div className="flex items-center gap-2 rounded-full border border-indigo-500/25 bg-slate-950/80 px-4 py-2 text-sm font-medium text-indigo-100 shadow-lg shadow-indigo-950/40">
                <Sparkles className="h-4 w-4 animate-pulse text-indigo-300" aria-hidden />
                <span aria-live="polite">{loadingMessage}</span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {backgroundMode === "custom_media" && backgroundMediaUrl ? (
          backgroundMediaType === "video" ? (
            <video
              src={backgroundMediaUrl}
              autoPlay
              muted
              loop
              playsInline
              className="absolute left-0 top-0 h-full w-full object-cover opacity-25"
            />
          ) : (
            <img src={backgroundMediaUrl} alt="Background" className="absolute left-0 top-0 h-full w-full object-cover opacity-25" />
          )
        ) : null}
        <CinematicAtmosphereScrim>
        <div
          className={`relative z-10 min-h-0 ${previewDevice === "desktop" ? "w-full" : "mx-auto"} ${
            previewDevice === "mobile"
              ? "rounded-[36px] border-4 border-slate-700 bg-slate-900/50 p-3 [box-shadow:0_24px_64px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[0.5px]"
              : previewDevice === "tablet"
                ? "rounded-3xl border-4 border-slate-700 bg-slate-900/40 p-3 [box-shadow:0_20px_48px_rgba(0,0,0,0.32)] backdrop-blur-[0.5px]"
                : ""
          }`}
          style={previewViewportStyle}
        >
          <div ref={livePreviewRef} className="grid gap-2 [transform:translateZ(0)]">
            {isEmpty ? (
              <div className="flex min-h-[min(40vh,320px)] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.1] bg-slate-950/40 px-6 py-12 text-center">
                <div className="rounded-full border border-white/[0.08] bg-white/[0.04] p-3 text-slate-400">
                  <Sparkles className="h-6 w-6 text-indigo-300/90" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">Your site will show here.</p>
                  <p className="mt-1 max-w-xs text-sm leading-relaxed text-slate-500">
                    Generate from Describe, import a public URL as a redesign blueprint, or add pieces in Advanced—updates appear as you go.
                  </p>
                </div>
              </div>
            ) : null}
            {firstPageBlocks.map((raw, idx: number) => {
              const { sectionId: sid, sectionType } = getPreviewBlockSectionMeta(raw);
              const block = <SiteBuilderPreviewBlock block={raw} index={idx} />;
              const shell = previewSectionShellClass(raw);
              const heroPop =
                idx === 0 && visualMetaBoost
                  ? " ring-1 ring-cyan-400/20 shadow-[0_0_48px_-14px_rgba(34,211,238,0.32)]"
                  : "";
              if (!canvasEdit || !sid) {
                return (
                  <CinematicSectionTransition
                    key={`preview-wrap-${idx}`}
                    block={raw}
                    index={idx}
                    className={`${shell}${heroPop}`}
                  >
                    <CinematicBlockScrollWrap block={raw} index={idx}>
                      {block}
                    </CinematicBlockScrollWrap>
                  </CinematicSectionTransition>
                );
              }
              const selected = canvasEdit.selectedSectionIds.includes(sid);
              const primaryId = canvasEdit.selectedSectionIds[0] ?? "";
              const refineActionVisible = selected && sid === primaryId;
              const pulseHighlight = canvasEdit.pulseSectionIds.includes(sid);
              return (
                <CinematicSectionTransition
                  key={`preview-canvas-wrap-${sid}-${idx}`}
                  block={raw}
                  index={idx}
                  className={`${shell}${heroPop}`}
                >
                  <CinematicBlockScrollWrap block={raw} index={idx}>
                    <SiteBuilderPreviewSectionCanvas
                      enabled
                      sectionId={sid}
                      sectionType={sectionType}
                      selected={selected}
                      refineActionVisible={refineActionVisible}
                      editorOpen={canvasEdit.editorOpenSectionId === sid}
                      busy={canvasEdit.busySectionIds.includes(sid)}
                      pulseHighlight={pulseHighlight}
                      feedback={canvasEdit.flashSuccessSectionIds.includes(sid) ? "success" : "idle"}
                      errorMessage={canvasEdit.errorSectionId === sid ? canvasEdit.errorMessage : null}
                      styleMode={canvasEdit.styleMode}
                      workflowStage={canvasEdit.workflowStage}
                      onSelect={(opts) => canvasEdit.onSelectSection(sid, sectionType, opts)}
                      onOpenEditor={() => canvasEdit.onOpenEditor(sid)}
                      onCloseEditor={canvasEdit.onCloseEditor}
                      onSubmitEdit={(instruction) => canvasEdit.onSubmitSection(canvasEdit.selectedSectionIds, instruction)}
                      onInlineTextEdit={(previousText, nextText) => canvasEdit.onInlineTextEdit(sid, previousText, nextText)}
                      onReorderDrop={(sourceSectionId, position) => canvasEdit.onReorderSectionDrop(sid, sourceSectionId, position)}
                      onDuplicateSection={() => canvasEdit.onDuplicateSection(sid)}
                      onDeleteSection={() => canvasEdit.onDeleteSection(sid)}
                      onToggleSectionStyle={() => canvasEdit.onToggleSectionStyle(sid)}
                      onUpdateSpacing={(updates) => canvasEdit.onUpdateSectionSpacing(sid, updates)}
                      onApplyStylePreset={(preset) => canvasEdit.onApplyStylePreset(sid, preset)}
                      onFixSection={() => canvasEdit.onFixSection(sid)}
                      critiqueScore={canvasEdit.sectionCritiqueScoreById?.[sid] ?? null}
                      onDismissFeedback={canvasEdit.onDismissFlash}
                      onDismissError={canvasEdit.onDismissError}
                    >
                      {block}
                    </SiteBuilderPreviewSectionCanvas>
                  </CinematicBlockScrollWrap>
                </CinematicSectionTransition>
              );
            })}
          </div>
        </div>
        </CinematicAtmosphereScrim>
      </div>
    </motion.div>
    </CinematicPreviewV3Provider>
  );
}
