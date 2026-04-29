"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SiteBuilderCanvasInlinePromptProps = {
  sectionId: string;
  sectionType: string;
  onSubmit: (instruction: string) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
  suggestionChips?: string[];
};

export function SiteBuilderCanvasInlinePrompt({
  sectionId,
  sectionType,
  onSubmit,
  onCancel,
  busy,
  errorMessage,
  onDismissError,
  suggestionChips = [],
}: SiteBuilderCanvasInlinePromptProps) {
  const labelId = useId();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function submit() {
    const t = value.trim();
    if (!t || busy) return;
    onDismissError();
    await onSubmit(t);
  }

  return (
    <div
      data-canvas-editor-root
      className="site-builder-canvas-inline-prompt pointer-events-auto z-[60] w-full max-w-[min(100%,420px)] rounded-xl border border-white/[0.12] bg-slate-950/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-2 max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:mt-0 max-sm:max-h-[min(42vh,320px)] max-sm:max-w-none max-sm:overflow-y-auto max-sm:rounded-t-xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[max(12px,env(safe-area-inset-bottom,0px))]"
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelId}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <p id={labelId} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        Refine this section
      </p>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onDismissError();
        }}
        disabled={busy}
        rows={2}
        className="mt-2 w-full resize-y rounded-lg border border-white/[0.08] bg-slate-900/80 px-2.5 py-2 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-teal-400/40 focus:outline-none focus:ring-1 focus:ring-teal-500/25 disabled:opacity-50"
        placeholder="What should change?"
        aria-label="Describe how to refine this section"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
            e.stopPropagation();
          }
        }}
      />
      {suggestionChips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestionChips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              onClick={() => {
                setValue(chip);
                onDismissError();
                textareaRef.current?.focus();
              }}
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:border-teal-400/30 hover:text-slate-200 disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
      ) : null}
      {errorMessage ? (
        <p className="mt-2 text-xs text-red-300/95" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-full border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-white/[0.18] hover:bg-white/[0.04] disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={() => void submit()}
          className="rounded-full border border-teal-500/35 bg-teal-500/15 px-3 py-1.5 text-xs font-semibold text-teal-100 transition-colors hover:border-teal-400/50 hover:bg-teal-500/20 disabled:opacity-40"
        >
          {busy ? "Updating…" : "Apply"}
        </button>
      </div>
      <p className="mt-2 hidden text-[10px] leading-snug text-slate-600 sm:block">
        ⌘↵ or Ctrl+↵ to apply · Esc to close
      </p>
      <span className="sr-only" aria-live="polite">
        {busy ? `Updating section ${sectionId}` : ""}
      </span>
      <span className="sr-only">{sectionType ? `Block type ${sectionType}` : ""}</span>
    </div>
  );
}
