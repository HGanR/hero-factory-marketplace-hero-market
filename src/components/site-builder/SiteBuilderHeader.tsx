"use client";

import Link from "next/link";
import { Save, Settings2 } from "lucide-react";
type Props = {
  selectedSiteName: string | null;
  currentVersionLabel: string | null;
  lastIpfsShort: string;
  onOpenAdvanced: () => void;
  /** Revenue OS client label when the open site is attributed to a hub client. */
  clientBadgeLabel?: string | null;
  /** When true, hides long marketing copy and client chip — AI-first builder surface. */
  compactMarketing?: boolean;
  /** Opens the slide-over with manual editor, deploy, and advanced controls. */
  onOpenEngines?: () => void;
  /** Persist version to the server (when a project exists) or in-browser draft for the selected client. */
  onSaveProgress?: () => void | Promise<void>;
  saveProgressDisabled?: boolean;
  saveProgressBusy?: boolean;
};

export function SiteBuilderHeader({
  selectedSiteName,
  currentVersionLabel,
  lastIpfsShort,
  onOpenAdvanced,
  clientBadgeLabel,
  compactMarketing = false,
  onOpenEngines,
  onSaveProgress,
  saveProgressDisabled = false,
  saveProgressBusy = false,
}: Props) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-6">
      <div className="min-w-0 max-w-2xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
          {compactMarketing ? "AI builder" : "From one brief to a full page"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.65rem]">Site Builder</h1>
        {compactMarketing ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Prompt on the left, live preview on the right. Project metadata, manual editor, and deploy live in{" "}
            <span className="text-slate-300">Engines</span> or <span className="text-slate-300">Advanced</span>.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-200">
              Turn a short description into a complete, multi-section site—live in the preview, not a blank template.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              You stay in charge: refine until it feels right, save a version when you’re ready, then deploy. Nothing goes public until you choose. Extra
              power lives in Advanced.
            </p>
          </>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-slate-500">
            <span className="text-slate-500">Project</span>
            <span className="font-medium text-slate-200">{selectedSiteName || "—"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-slate-500">
            <span className="text-slate-500">Version</span>
            <span className="font-mono text-slate-200">{currentVersionLabel || "none"}</span>
          </span>
          {!compactMarketing ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-slate-500">
              <span className="text-slate-500">IPFS</span>
              <span className="font-mono text-slate-300">{lastIpfsShort}</span>
            </span>
          ) : null}
          {clientBadgeLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/[0.08] px-2.5 py-1 text-xs text-cyan-100/90">
              <span className="text-cyan-200/70">Client</span>
              <span className="max-w-[14rem] truncate font-medium text-cyan-50/95">{clientBadgeLabel}</span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
        {onSaveProgress ? (
          <button
            type="button"
            onClick={() => void onSaveProgress()}
            disabled={saveProgressDisabled || saveProgressBusy}
            aria-label="Save site progress"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.12] px-4 py-2 text-sm font-semibold text-emerald-100/95 transition-colors hover:border-emerald-400/45 hover:bg-emerald-500/18 disabled:pointer-events-none disabled:opacity-45"
          >
            <Save className="h-4 w-4 text-emerald-200/90" aria-hidden />
            {saveProgressBusy ? "Saving…" : "Save"}
          </button>
        ) : null}
        {onOpenEngines ? (
          <button
            type="button"
            onClick={onOpenEngines}
            aria-label="Open engines — manual editor, project tools, deploy"
            className="inline-flex items-center gap-2 rounded-full border border-indigo-500/25 bg-indigo-500/[0.08] px-4 py-2 text-sm font-medium text-indigo-100/95 transition-colors hover:border-indigo-400/40 hover:bg-indigo-500/12"
          >
            Engines
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenAdvanced}
          aria-label="Open Advanced — full configuration, deploy, and mint"
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/[0.16] hover:bg-white/[0.05]"
        >
          <Settings2 className="h-4 w-4 text-slate-400" aria-hidden />
          Advanced
        </button>
        <Link
          href="/site-builder/templates"
          className="rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-4 py-2 text-sm font-medium text-amber-100/90 transition-colors hover:border-amber-400/35 hover:bg-amber-500/10"
        >
          Templates
        </Link>
        <Link
          href="/dashboard"
          className="rounded-full border border-white/[0.08] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-white/[0.14] hover:text-slate-100"
        >
          Dashboard
        </Link>
        <Link
          href="/trust-records"
          className="rounded-full border border-teal-500/25 bg-teal-500/[0.08] px-4 py-2 text-sm font-semibold text-teal-100/95 shadow-[0_0_0_1px_rgba(45,212,191,0.12)_inset] transition-colors hover:border-teal-400/40 hover:bg-teal-500/12"
        >
          Trust Records
        </Link>
      </div>
    </header>
  );
}
