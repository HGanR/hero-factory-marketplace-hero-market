"use client";

import { useEffect } from "react";

type SiteBuilderEnginesDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Slide-over shell for manual editor, conversion tools, publish checklist, and Advanced / deploy / mint flows.
 * Keeps the primary canvas focused on assistant + live preview while preserving every control in one scrollable panel.
 */
export function SiteBuilderEnginesDrawer({ open, onClose, children }: SiteBuilderEnginesDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-[90] transition-[visibility] duration-200 ${open ? "visible" : "invisible"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close tools panel"
        className={`absolute inset-0 bg-slate-950/75 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-[min(100vw,56rem)] flex-col border-l border-white/[0.08] bg-slate-950 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
        aria-label="Site builder engines and manual tools"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Engines &amp; manual tools</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Visual editor, project registry, deploy, widgets, and builder JSON — same as before, grouped here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-900"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-28">{children}</div>
      </aside>
    </div>
  );
}
