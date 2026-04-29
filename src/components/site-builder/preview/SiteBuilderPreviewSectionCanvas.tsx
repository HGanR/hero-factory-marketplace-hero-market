"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { SiteBuilderCanvasInlinePrompt } from "@/components/site-builder/preview/SiteBuilderCanvasInlinePrompt";
import { trackSiteBuilderEvent } from "@/lib/site-builder/siteBuilderAnalytics";
import { critiqueBadgeForScore, type SectionStylePreset } from "@/lib/site-builder/visual-editor";

export type SiteBuilderPreviewSectionCanvasProps = {
  enabled: boolean;
  sectionId: string;
  sectionType: string;
  selected: boolean;
  /** When false, selected sections still show focus ring but no on-canvas “Refine” chip (multi-select). */
  refineActionVisible: boolean;
  editorOpen: boolean;
  busy: boolean;
  /** Short emphasis after AI update (e.g. scroll target). */
  pulseHighlight?: boolean;
  feedback: "idle" | "success" | "error";
  errorMessage: string | null;
  styleMode?: string;
  workflowStage: string;
  onSelect: (opts?: { shiftKey?: boolean }) => void;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
  onSubmitEdit: (instruction: string) => Promise<void>;
  onDismissFeedback: () => void;
  onDismissError: () => void;
  onDuplicateSection?: () => void;
  onDeleteSection?: () => void;
  onToggleSectionStyle?: () => void;
  onReorderDrop?: (sourceSectionId: string, position: "before" | "after") => void;
  onInlineTextEdit?: (previousText: string, nextText: string) => void;
  onUpdateSpacing?: (updates: { padding?: number; margin?: number }) => void;
  onApplyStylePreset?: (preset: SectionStylePreset) => void;
  onFixSection?: () => void;
  critiqueScore?: number | null;
  children: ReactNode;
};

function suggestionChipsForType(sectionType: string): string[] {
  const t = sectionType.toLowerCase();
  if (t === "hero") return ["More premium feel", "Softer, editorial tone"];
  if (t === "call_to_action") return ["Softer CTA", "Clearer next step"];
  if (t === "stat_band") return ["More editorial", "Add one key metric"];
  if (t === "list") return ["Tighter wording", "More proof-forward"];
  return ["Refine wording", "Visual polish"];
}

export function SiteBuilderPreviewSectionCanvas({
  enabled,
  sectionId,
  sectionType,
  selected,
  refineActionVisible,
  editorOpen,
  busy,
  pulseHighlight = false,
  feedback,
  errorMessage,
  styleMode,
  workflowStage,
  onSelect,
  onOpenEditor,
  onCloseEditor,
  onSubmitEdit,
  onDismissFeedback,
  onDismissError,
  onDuplicateSection,
  onDeleteSection,
  onToggleSectionStyle,
  onReorderDrop,
  onInlineTextEdit,
  onUpdateSpacing,
  onApplyStylePreset,
  onFixSection,
  critiqueScore,
  children,
}: SiteBuilderPreviewSectionCanvasProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [snapPosition, setSnapPosition] = useState<"before" | "after" | null>(null);
  const chips = useMemo(() => suggestionChipsForType(sectionType), [sectionType]);

  useEffect(() => {
    if (feedback === "success") {
      const t = window.setTimeout(() => onDismissFeedback(), 2200);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [feedback, onDismissFeedback]);

  if (!enabled) {
    return <>{children}</>;
  }

  const showChip = refineActionVisible && !editorOpen;
  const ringPulse = pulseHighlight ? "shadow-[inset_0_0_0_3px_rgba(251,191,36,0.55)]" : "";
  const ringSelected =
    selected && !pulseHighlight ? "shadow-[inset_0_0_0_2px_rgba(45,212,191,0.28)]" : "";
  const ringHover =
    !selected && !busy && !pulseHighlight ? "hover:shadow-[inset_0_0_0_1px_rgba(45,212,191,0.16)]" : "";

  return (
    <div
      className={`site-builder-preview-section-canvas relative rounded-[inherit] transition-shadow duration-300 ease-out ${ringPulse || ringSelected} ${ringHover}`}
      data-site-builder-section-id={sectionId}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/site-builder-section-id", sectionId);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const pos: "before" | "after" = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
        setSnapPosition(pos);
      }}
      onDragLeave={() => setSnapPosition(null)}
      onDrop={(e) => {
        e.preventDefault();
        const source = e.dataTransfer.getData("text/site-builder-section-id");
        if (source && source !== sectionId) onReorderDrop?.(source, snapPosition || "before");
        setSnapPosition(null);
      }}
    >
      {snapPosition === "before" ? <div className="absolute -top-1 left-0 right-0 z-50 h-1 rounded bg-cyan-400/90" /> : null}
      {snapPosition === "after" ? <div className="absolute -bottom-1 left-0 right-0 z-50 h-1 rounded bg-cyan-400/90" /> : null}
      <div className="pointer-events-none absolute left-2 top-2 z-40 rounded border border-white/20 bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-slate-300">
        Drag
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`Section ${sectionId}. Click to select; Shift-click to add or remove from a multi-section edit (up to three).`}
        className={`relative rounded-[inherit] outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(94,234,212,0.4)] ${busy ? "cursor-wait" : "cursor-pointer"}`}
        onClickCapture={(e) => {
          if (editorOpen) {
            const el = e.target as HTMLElement;
            if (el.closest("[data-canvas-editor-root]")) return;
          }
          e.preventDefault();
          e.stopPropagation();
          onSelect({ shiftKey: e.shiftKey });
        }}
        onDoubleClickCapture={(e) => {
          const target = e.target as HTMLElement;
          if (!onInlineTextEdit) return;
          if (!target) return;
          const tag = target.tagName.toLowerCase();
          if (!["p", "h1", "h2", "h3", "h4", "span", "a", "li"].includes(tag)) return;
          const original = (target.textContent || "").trim();
          if (!original) return;
          target.setAttribute("contenteditable", "true");
          target.setAttribute("data-inline-editing", "1");
          target.focus();
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(target);
          selection?.removeAllRanges();
          selection?.addRange(range);
          const finalize = () => {
            const next = (target.textContent || "").trim();
            target.removeAttribute("contenteditable");
            target.removeAttribute("data-inline-editing");
            target.removeEventListener("blur", finalize);
            if (next && next !== original) onInlineTextEdit(original, next);
          };
          target.addEventListener("blur", finalize, { once: true });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect({ shiftKey: e.shiftKey });
          }
        }}
      >
        <div className={busy ? "pointer-events-none opacity-[0.92]" : ""}>{children}</div>
        {busy ? (
          <div
            className="pointer-events-none absolute inset-0 z-[45] flex items-center justify-center rounded-[inherit] bg-slate-950/25"
            aria-hidden
          >
            <span className="rounded-full border border-teal-500/30 bg-slate-950/85 px-3 py-1 text-[11px] font-medium text-teal-100 shadow-lg backdrop-blur-sm">
              Updating…
            </span>
          </div>
        ) : null}
        {feedback === "success" && !busy ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[46] flex justify-center">
            <span className="rounded-full border border-emerald-500/35 bg-emerald-950/90 px-3 py-1 text-[11px] font-medium text-emerald-100 shadow-md backdrop-blur-sm">
              Updated
            </span>
          </div>
        ) : null}
      </div>

      {showChip ? (
        <div className="pointer-events-auto absolute bottom-2 right-2 z-50 sm:bottom-3 sm:right-3">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={editorOpen}
            onClick={(e) => {
              e.stopPropagation();
              trackSiteBuilderEvent("site_builder_canvas_edit_opened", {
                section_id: sectionId,
                workflow_stage: workflowStage,
                section_type: sectionType,
                ...(styleMode ? { style_mode: styleMode } : {}),
              });
              onOpenEditor();
            }}
            className="rounded-full border border-white/[0.12] bg-slate-950/90 px-3 py-1 text-[11px] font-semibold text-slate-200 shadow-md backdrop-blur-md transition-colors hover:border-teal-400/35 hover:text-white"
          >
            Refine this section
          </button>
        </div>
      ) : null}
      {selected ? (
        <div className="absolute left-2 top-8 z-50 flex flex-wrap gap-1">
          <button type="button" onClick={onOpenEditor} className="rounded border border-white/20 bg-slate-950/85 px-2 py-0.5 text-[10px] text-slate-200">Edit</button>
          <button type="button" onClick={onDuplicateSection} className="rounded border border-white/20 bg-slate-950/85 px-2 py-0.5 text-[10px] text-slate-200">Duplicate</button>
          <button type="button" onClick={onDeleteSection} className="rounded border border-red-500/40 bg-slate-950/85 px-2 py-0.5 text-[10px] text-red-200">Delete</button>
          <button type="button" onClick={onToggleSectionStyle} className="rounded border border-white/20 bg-slate-950/85 px-2 py-0.5 text-[10px] text-slate-200">Style</button>
          <button type="button" onClick={onFixSection} className="rounded border border-amber-500/40 bg-slate-950/85 px-2 py-0.5 text-[10px] text-amber-200">Fix section</button>
          {(["minimal", "corporate", "web3", "bold"] as const).map((preset) => (
            <button key={preset} type="button" onClick={() => onApplyStylePreset?.(preset)} className="rounded border border-white/15 bg-slate-950/85 px-1.5 py-0.5 text-[10px] text-slate-300">
              {preset}
            </button>
          ))}
        </div>
      ) : null}
      {typeof critiqueScore === "number" ? (
        <div className="absolute right-2 top-2 z-50 rounded border border-white/20 bg-slate-950/85 px-2 py-0.5 text-[10px] text-slate-200">
          {critiqueBadgeForScore(critiqueScore) === "strong" ? "strong" : "needs improvement"} · {Math.round(critiqueScore)}
        </div>
      ) : null}
      {selected ? (
        <div className="absolute bottom-2 left-2 z-50 rounded border border-white/15 bg-slate-950/85 px-2 py-1 text-[10px] text-slate-300">
          <label className="mr-2 inline-flex items-center gap-1">
            pad
            <input type="range" min={0} max={120} defaultValue={24} onChange={(e) => onUpdateSpacing?.({ padding: Number(e.target.value) })} />
          </label>
          <label className="inline-flex items-center gap-1">
            mar
            <input type="range" min={0} max={120} defaultValue={8} onChange={(e) => onUpdateSpacing?.({ margin: Number(e.target.value) })} />
          </label>
        </div>
      ) : null}

      {editorOpen ? (
        <SiteBuilderCanvasInlinePrompt
          sectionId={sectionId}
          sectionType={sectionType}
          busy={busy}
          errorMessage={localError || errorMessage}
          onDismissError={() => {
            setLocalError(null);
            onDismissError();
          }}
          suggestionChips={chips}
          onCancel={() => {
            trackSiteBuilderEvent("site_builder_canvas_edit_cancelled", {
              section_id: sectionId,
              workflow_stage: workflowStage,
              section_type: sectionType,
              ...(styleMode ? { style_mode: styleMode } : {}),
            });
            setLocalError(null);
            onCloseEditor();
          }}
          onSubmit={async (instruction) => {
            setLocalError(null);
            trackSiteBuilderEvent("site_builder_canvas_edit_submitted", {
              section_id: sectionId,
              workflow_stage: workflowStage,
              section_type: sectionType,
              ...(styleMode ? { style_mode: styleMode } : {}),
            });
            try {
              await onSubmitEdit(instruction);
            } catch (err) {
              setLocalError(err instanceof Error ? err.message : "Could not update section");
              throw err;
            }
          }}
        />
      ) : null}

      <span className="sr-only" aria-live="polite">
        {selected ? `Section ${sectionId} selected for refinement` : ""}
      </span>
    </div>
  );
}
