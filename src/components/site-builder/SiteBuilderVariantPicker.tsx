"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Sparkles } from "lucide-react";
import {
  buildVariantPickerItems,
  extractSiteVariantPreviewMeta,
} from "@/lib/site-builder/variant-picker-meta";

export type SiteBuilderVariantPickerItem = {
  index: number;
  label: string;
  schema: unknown;
  seed?: string;
  generationMeta?: {
    layoutFamilyId?: string;
    diversityScore?: number;
    retryCount?: number;
  };
};

type Props = {
  open: boolean;
  /** Primary schema first, then alternates in API order */
  primarySchema: unknown;
  alternates: Array<{ seed: string; schema: unknown; generationMeta?: SiteBuilderVariantPickerItem["generationMeta"] }>;
  primaryGenerationMeta?: SiteBuilderVariantPickerItem["generationMeta"];
  busy?: boolean;
  onSelectLayout: (index: number) => void;
};

export function SiteBuilderVariantPicker({
  open,
  primarySchema,
  alternates,
  primaryGenerationMeta,
  busy = false,
  onSelectLayout,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const items: SiteBuilderVariantPickerItem[] = useMemo(
    () => buildVariantPickerItems(primarySchema, alternates, primaryGenerationMeta).map((v) => ({ ...v })),
    [primarySchema, alternates, primaryGenerationMeta],
  );

  if (!open || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-builder-variant-picker-title"
    >
      <div className="max-h-[min(92vh,720px)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/[0.1] bg-slate-900/95 p-6 shadow-2xl shadow-indigo-950/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-300/90">Layouts ready</p>
            <h2 id="site-builder-variant-picker-title" className="mt-1 text-xl font-semibold tracking-tight text-slate-50">
              Pick a layout for the preview
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
              Each option is a full generated page. Choose one to load into the editor and continue in Refine—you can still change everything afterward.
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/10 text-indigo-200">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const meta = extractSiteVariantPreviewMeta(item.schema, item.generationMeta);
            const keyLine =
              meta.firstSectionTypes.length > 0
                ? meta.firstSectionTypes.join(", ")
                : "—";
            return (
              <div
                key={item.index}
                className="flex flex-col rounded-xl border border-white/[0.08] bg-slate-950/60 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-100">{item.label}</span>
                  <LayoutGrid className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                </div>
                <p className="mt-3 line-clamp-3 text-sm font-medium leading-snug text-indigo-100/95">{meta.heroHeadline}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  <span className="font-medium text-slate-400">{meta.homeSectionCount}</span> sections on home
                </p>
                <p className="mt-1 text-[11px] text-indigo-200/85">{meta.layoutFamilyLabel}</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Hero: <span className="text-slate-400">{meta.heroStyle}</span>
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  CTA: <span className="text-slate-400">{meta.ctaStrategy}</span>
                </p>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600" title={meta.registryKeys.join(", ")}>
                  <span className="font-semibold uppercase tracking-wider text-slate-500">First sections</span>{" "}
                  <span className="text-slate-500">{keyLine}</span>
                </p>
                {item.seed ? (
                  <p className="mt-2 font-mono text-[10px] text-slate-600">
                    seed <span className="text-slate-500">{item.seed.slice(0, 14)}…</span>
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelectLayout(item.index)}
                  className="mt-4 w-full rounded-full border border-indigo-400/35 bg-indigo-500/15 px-4 py-2.5 text-sm font-semibold text-indigo-50 transition-colors hover:border-indigo-300/50 hover:bg-indigo-500/25 disabled:pointer-events-none disabled:opacity-40"
                >
                  Use this layout
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
