"use client";

import type { NeuroDocumentViewerDto } from "@/lib/executive-agent/neuro/neuro-types";
import { NeuroPassageHighlighter } from "./NeuroPassageHighlighter";

type Props = {
  viewer: NeuroDocumentViewerDto;
  onClose?: () => void;
};

export function NeuroDocumentViewer({ viewer, onClose }: Props) {
  const { document: doc, viewerMode, fullText, storageUri, citation, highlightChunkId, disclaimer } =
    viewer;
  const chunk = highlightChunkId ? viewer.chunks.find((c) => c.id === highlightChunkId) : null;
  const body = chunk?.text ?? fullText ?? doc.extractedTextPreview ?? "";

  return (
    <div className="flex h-full min-h-[220px] flex-col rounded-xl border border-cyan-500/30 bg-[#040a14]/95">
      <div className="flex items-start justify-between gap-2 border-b border-cyan-500/20 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-cyan-100">{doc.title}</div>
          <div className="truncate text-[9px] text-slate-500">{doc.fileName}</div>
          {citation ? (
            <div className="mt-0.5 text-[9px] text-violet-300/90">
              {citation.citationLabel} · confidence {(citation.confidence * 100).toFixed(0)}%
            </div>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[9px] uppercase tracking-wide text-slate-400 hover:text-cyan-200"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {viewerMode === "pdf" && storageUri ? (
          <div className="space-y-2">
            <iframe
              title={doc.title}
              src={storageUri}
              className="h-48 w-full rounded-lg border border-slate-700/80 bg-black/40"
            />
            {body ? (
              <NeuroPassageHighlighter
                text={body}
                highlightStart={citation?.highlightStart}
                highlightEnd={citation?.highlightEnd}
              />
            ) : (
              <p className="text-[10px] text-slate-500">PDF loaded — highlighted excerpt below when indexed.</p>
            )}
          </div>
        ) : body ? (
          <NeuroPassageHighlighter
            text={body}
            highlightStart={citation?.highlightStart}
            highlightEnd={citation?.highlightEnd}
          />
        ) : (
          <p className="text-[10px] text-amber-200/90">
            No indexed text for this document ({doc.status}
            {doc.statusMessage ? `: ${doc.statusMessage}` : ""}).
          </p>
        )}
      </div>

      {disclaimer ? (
        <p className="border-t border-amber-500/20 bg-amber-950/20 px-3 py-2 text-[9px] leading-snug text-amber-100/85">
          {disclaimer}
        </p>
      ) : null}
    </div>
  );
}
