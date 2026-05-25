"use client";

import type { NeuroDocumentDto } from "@/lib/executive-agent/neuro/neuro-types";

type Props = {
  doc: NeuroDocumentDto;
  x: number;
  y: number;
  selected?: boolean;
  onClick: () => void;
};

export function NeuroSourceNode({ doc, x, y, selected, onClick }: Props) {
  const statusColor =
    doc.status === "indexed"
      ? "border-cyan-400/60 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
      : doc.status === "processing"
        ? "border-violet-400/50 animate-pulse"
        : doc.status === "failed" || doc.status === "unsupported_for_text"
          ? "border-amber-500/40"
          : "border-slate-600/50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-left transition ${statusColor} ${selected ? "ring-2 ring-gold-400/60" : ""}`}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        background: "rgba(6, 20, 36, 0.88)",
        maxWidth: "120px",
      }}
      title={doc.fileName}
    >
      <span className="block truncate text-[8px] font-semibold uppercase tracking-wide text-cyan-200/90">
        {doc.subjectArea.replace(/_/g, " ")}
      </span>
      <span className="block truncate text-[9px] text-slate-200">{doc.fileName}</span>
    </button>
  );
}
