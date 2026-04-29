"use client";

import { SiteBuilderCodeViewer } from "@/components/site-builder/SiteBuilderCodeViewer";
import { SiteBuilderFileTree, type SiteBuilderFileNode } from "@/components/site-builder/SiteBuilderFileTree";

type Props = {
  open: boolean;
  files: SiteBuilderFileNode[];
  activeFileId: string;
  onSelectFile: (id: string) => void;
  onClose: () => void;
};

export function SiteBuilderFileDrawer({ open, files, activeFileId, onSelectFile, onClose }: Props) {
  if (!open) return null;
  const active = files.find((f) => f.id === activeFileId) ?? files[0];
  if (!active) return null;
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-slate-950/70 p-3" aria-label="Files and code drawer">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Files / Code</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-600"
        >
          Close
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SiteBuilderFileTree files={files} activeId={active.id} onSelect={onSelectFile} />
        <SiteBuilderCodeViewer title={active.label} languageHint={active.languageHint} code={active.content} />
      </div>
    </section>
  );
}
