"use client";

import React, { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseJarvaHandoff } from "@/lib/jarva/jarva-handoff";
import { applyJarvaNextUiActionInBrowser } from "@/lib/jarva/jarva-next-ui-client-actions";
import {
  buildJarvaNextUiSurfaceBundle,
  detectJarvaDestinationSurface,
  pickPrimaryJarvaNextUiAction,
  type JarvaNextUiAction,
} from "@/lib/jarva/jarva-next-ui-actions";
import { isJarvaFocusStepAligned, JARVA_NEXT_UI_COPY } from "@/lib/jarva/jarva-next-ui-alignment";
import { Button } from "@/components/ui/button";

export type JarvaNextActionStripProps = {
  /** Issue Security: jump to wizard step letter (A–F). */
  onApplyFocusStep?: (stepLetter: string) => void;
  /** Current wizard step (A–F) on Issue Security — hides redundant “Focus” CTA when already aligned. */
  wizardStepLetter?: string | null;
};

function JarvaNextActionStripInner({ onApplyFocusStep, wizardStepLetter }: JarvaNextActionStripProps) {
  const pathname = usePathname() ?? "";
  const sp = useSearchParams();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const handoff = useMemo(() => parseJarvaHandoff(new URLSearchParams(sp?.toString() ?? "")), [sp]);

  const bundle = useMemo(() => {
    if (!handoff) return null;
    return buildJarvaNextUiSurfaceBundle({
      pathname,
      searchParams: new URLSearchParams(sp?.toString() ?? ""),
      lane: handoff.lane,
    });
  }, [pathname, sp, handoff]);

  const surface = useMemo(() => detectJarvaDestinationSurface(pathname), [pathname]);

  const primary = useMemo(() => pickPrimaryJarvaNextUiAction(bundle?.actions ?? []), [bundle?.actions]);

  const tabCurrent = (sp.get("tab") || "").trim();
  const tabAligned = primary?.kind === "select_tab" && tabCurrent === primary.target.trim();
  const focusAligned =
    Boolean(primary && primary.kind === "focus_step" && isJarvaFocusStepAligned(primary, wizardStepLetter));
  const trustIdFromUrl = (sp.get("trustId") || "").trim() || undefined;

  const applyAction = useCallback(
    (a: JarvaNextUiAction) => {
      applyJarvaNextUiActionInBrowser(a, {
        pathname,
        searchParams: new URLSearchParams(sp?.toString() ?? ""),
        push: (href) => router.push(href),
        replace: (href) => router.replace(href, { scroll: false }),
        trustId: trustIdFromUrl,
        lane: handoff?.lane ?? null,
        onFocusStep: onApplyFocusStep,
      });
    },
    [handoff?.lane, onApplyFocusStep, pathname, router, sp, trustIdFromUrl]
  );

  if (dismissed || !handoff || !bundle?.actions.length) return null;

  const showApply =
    primary &&
    !focusAligned &&
    primary.kind !== "prefill_mode" &&
    ((primary.kind === "select_tab" && !tabCurrent) ||
      (primary.kind === "focus_step" && Boolean(onApplyFocusStep)) ||
      primary.kind === "highlight_action");

  const applyLabel =
    primary?.kind === "focus_step"
      ? "Focus this step"
      : primary?.kind === "select_tab"
        ? "Open tab"
        : primary?.kind === "highlight_action"
          ? "Show me"
          : "Continue here";

  return (
    <div
      className="mb-3 flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-950/40 px-3 py-2.5 text-[12px] leading-snug text-amber-50/95 shadow-sm"
      role="status"
      aria-label="Jarva suggested next action"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">Jarva suggests</p>
        <p className="text-amber-50/95">
          <span className="font-medium text-white">{primary?.label}</span>
          {surface !== "unknown" ? (
            <span className="text-amber-200/75"> · {surface.replace(/_/g, " ")}</span>
          ) : null}
        </p>
        {primary?.kind === "select_tab" && tabAligned ? (
          <p className="text-[11px] text-emerald-300/90">{JARVA_NEXT_UI_COPY.tabAlreadyAlignedLine}</p>
        ) : primary?.kind === "select_tab" && (sp.get("tab") || "").trim() && !tabAligned ? (
          <p className="text-[11px] text-slate-400">
            You have a different tab selected — Jarva will not switch it automatically.
          </p>
        ) : null}
        {primary?.kind === "focus_step" && focusAligned ? (
          <p className="text-[11px] text-emerald-300/90">{JARVA_NEXT_UI_COPY.focusStepStripAlignedLine}</p>
        ) : primary?.kind === "focus_step" && !onApplyFocusStep ? (
          <p className="text-[11px] text-slate-400">Use the step buttons (A–F) in this workspace to continue.</p>
        ) : null}
        {primary?.kind === "prefill_mode" ? (
          <p className="text-[11px] text-slate-400">
            Continue in the main wizard — Jarva matches your drafting lane (DRAFT — counsel review).
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {showApply && primary ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 border-amber-500/40 bg-amber-900/50 text-amber-50 hover:bg-amber-800/60"
            onClick={() => applyAction(primary)}
          >
            {applyLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] text-amber-200/80 hover:text-white"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

/** Compact operator strip: suggests the next safe UI action for the current Jarva handoff lane on this surface. */
export function JarvaNextActionStrip(props: JarvaNextActionStripProps) {
  return (
    <Suspense fallback={null}>
      <JarvaNextActionStripInner {...props} />
    </Suspense>
  );
}
