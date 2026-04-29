"use client";

import type { BuilderWorkflowStage } from "@/components/site-builder/builder-workflow-stage";
import { ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { RefObject } from "react";
import type { SiteBuilderAiPanelHandle } from "@/components/site-builder/SiteBuilderAiPanel";

const STAGE_LABEL: Record<BuilderWorkflowStage, string> = {
  describe: "Brief",
  review: "Outline",
  refine: "Edit",
  publish: "Ship",
};

const SKIP_LABEL: Record<BuilderWorkflowStage, string> = {
  describe: "Outline",
  review: "Edit",
  refine: "Ship",
  publish: "Ship",
};

export type PublishChecklistItem = { id: string; label: string; done: boolean; hint?: string };

type Props = {
  stage: BuilderWorkflowStage;
  onStageChange: (s: BuilderWorkflowStage) => void;
  busy: boolean;
  aiPanelRef: RefObject<SiteBuilderAiPanelHandle | null>;
  selectedSiteId: string;
  canDeployOps: boolean;
  onSaveVersion: () => void | Promise<void>;
  onOpenAdvanced: () => void;
  /** When stage is publish, all items must be done to enable the primary “Open Advanced” action. */
  publishChecklist?: PublishChecklistItem[];
};

export function SiteBuilderStickyBar({
  stage,
  onStageChange,
  busy,
  aiPanelRef,
  selectedSiteId,
  canDeployOps,
  onSaveVersion,
  onOpenAdvanced,
  publishChecklist,
}: Props) {
  const reduceMotion = useReducedMotion();
  const firstIncomplete = publishChecklist?.find((i) => !i.done);
  const nextStage: Record<BuilderWorkflowStage, BuilderWorkflowStage | null> = {
    describe: "review",
    review: "refine",
    refine: "publish",
    publish: null,
  };

  const primaryLabel =
    stage === "describe" || stage === "review"
      ? "Build preview"
      : stage === "refine"
        ? "Save version"
        : "Open Advanced";

  async function primaryAction() {
    if (stage === "describe" || stage === "review") {
      await aiPanelRef.current?.runFullBuildWithRefinement({ source: "sticky_bar" });
      return;
    }
    if (stage === "refine") {
      await onSaveVersion();
      onStageChange("publish");
      return;
    }
    onOpenAdvanced();
  }

  const publishChecklistOk =
    !publishChecklist?.length || publishChecklist.every((i) => i.done);
  const primaryDisabled =
    busy ||
    (stage === "refine" && !selectedSiteId) ||
    (stage === "publish" && (!canDeployOps || !publishChecklistOk));

  return (
    <motion.div
      layout={!reduceMotion}
      className="fixed bottom-0 left-0 right-0 z-[90] border-t border-white/[0.07] bg-slate-950/90 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/75"
      initial={false}
      animate={{ boxShadow: primaryDisabled ? "0 -8px 32px rgba(0,0,0,0.35)" : "0 -12px 40px rgba(0,0,0,0.45)" }}
      transition={{ duration: reduceMotion ? 0 : 0.25 }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/25 to-transparent" aria-hidden />
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium tracking-wide text-slate-400">
            <span className="text-slate-500">View</span>
            <span className="truncate text-slate-200">{STAGE_LABEL[stage]}</span>
          </span>
          {nextStage[stage] ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStageChange(nextStage[stage]!)}
              aria-label={`Jump ahead to ${SKIP_LABEL[stage]}`}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-white/[0.08] px-3 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-white/[0.14] hover:text-slate-200 disabled:pointer-events-none disabled:opacity-40"
            >
              Jump to {SKIP_LABEL[stage]}
              <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {stage !== "describe" ? (
            <button
              type="button"
              disabled={busy}
              aria-label="Go to previous step"
              onClick={() => {
                const order: BuilderWorkflowStage[] = ["describe", "review", "refine", "publish"];
                const idx = order.indexOf(stage);
                if (idx > 0) onStageChange(order[idx - 1]!);
              }}
              className="rounded-full border border-white/[0.1] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-white/[0.16] hover:bg-white/[0.03] disabled:pointer-events-none disabled:opacity-40"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            disabled={primaryDisabled}
            aria-label={primaryLabel}
            title={
              stage === "publish" && !canDeployOps
                ? "Save a version first to unlock deploy and mint."
                : stage === "publish" && !publishChecklistOk
                  ? firstIncomplete?.hint || firstIncomplete?.label || "Complete the publish checklist above."
                  : undefined
            }
            onClick={() => void primaryAction()}
            className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset] transition-[filter,transform] hover:brightness-[1.06] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40 disabled:grayscale-[0.2] disabled:brightness-90"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
      {stage === "publish" && publishChecklist?.length ? (
        <div
          className="border-t border-white/[0.06] px-4 py-2.5 sm:px-6"
          role="region"
          aria-label="Publish readiness checklist"
        >
          <p className="text-center text-[11px] font-medium uppercase tracking-wide text-slate-500" id="publish-checklist-heading">
            Publish readiness
          </p>
          <ul
            className="mx-auto mt-2 flex max-w-2xl flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400"
            role="list"
            aria-labelledby="publish-checklist-heading"
          >
            {publishChecklist.map((item) => (
              <li
                key={item.id}
                className="inline-flex max-w-[11rem] items-center gap-1.5 sm:max-w-none"
                title={item.done ? `${item.label} — done` : item.hint || `${item.label} — pending`}
                aria-label={`${item.label}: ${item.done ? "complete" : "incomplete"}`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.done ? "bg-emerald-400" : "bg-slate-600"}`}
                  aria-hidden
                />
                <span className={item.done ? "text-emerald-100/85" : ""}>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {stage === "publish" ? (
        <div
          className={`border-t px-4 py-2.5 text-center text-xs leading-snug sm:px-6 ${
            canDeployOps && publishChecklistOk
              ? "border-emerald-500/15 bg-emerald-950/20 text-emerald-200/85"
              : "border-amber-500/15 bg-amber-950/25 text-amber-100/90"
          }`}
        >
          {canDeployOps && publishChecklistOk
            ? "Ready when you are—deploy and mint are in Advanced. You confirm each step."
            : !canDeployOps
              ? "Save a version first—that’s what you’ll publish. Use the bar in Edit, or save from Advanced."
              : `Finish the checklist above${firstIncomplete ? ` — next: ${firstIncomplete.label}` : ""}.`}
        </div>
      ) : null}
    </motion.div>
  );
}
