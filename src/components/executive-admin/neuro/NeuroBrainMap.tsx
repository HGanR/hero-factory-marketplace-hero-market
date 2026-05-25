"use client";

import type { NeuroBrainRegion, NeuroDocumentDto } from "@/lib/executive-agent/neuro/neuro-types";
import { NeuroSourceNode } from "./NeuroSourceNode";

type Props = {
  regions: Array<NeuroBrainRegion & { documentCount: number; indexedCount: number }>;
  documents: NeuroDocumentDto[];
  pulse?: boolean;
  selectedDocumentId?: string | null;
  onSelectDocument: (doc: NeuroDocumentDto) => void;
};

export function NeuroBrainMap({
  regions,
  documents,
  pulse,
  selectedDocumentId,
  onSelectDocument,
}: Props) {
  return (
    <div
      className={`relative mx-auto aspect-[16/10] w-full max-w-2xl overflow-hidden rounded-2xl border border-cyan-500/25 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.12),rgba(8,12,24,0.95)_65%)] ${pulse ? "animate-[neuro-pulse_1.2s_ease-in-out_2]" : ""}`}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-70" aria-hidden>
        <defs>
          <linearGradient id="neuro-link" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        {regions.map((r) => (
          <line
            key={`link-${r.id}`}
            x1="50%"
            y1="50%"
            x2={`${r.x * 100}%`}
            y2={`${r.y * 100}%`}
            stroke="url(#neuro-link)"
            strokeWidth="1"
            strokeOpacity="0.35"
          />
        ))}
        <ellipse cx="50%" cy="50%" rx="28%" ry="22%" fill="none" stroke="#22d3ee" strokeOpacity="0.25" />
        <ellipse cx="50%" cy="50%" rx="18%" ry="14%" fill="none" stroke="#a78bfa" strokeOpacity="0.2" />
      </svg>

      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-200/90">NEURO</div>
        <div className="text-[8px] uppercase tracking-widest text-violet-300/80">Source cortex</div>
      </div>

      {regions.map((r) => (
        <div
          key={r.id}
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-lg border px-2 py-1 text-center"
          style={{
            left: `${r.x * 100}%`,
            top: `${r.y * 100}%`,
            borderColor: `${r.accent}55`,
            background: "rgba(4, 10, 20, 0.82)",
            minWidth: "88px",
          }}
        >
          <div className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: r.accent }}>
            {r.label.split("/")[0]?.trim()}
          </div>
          <div className="text-[8px] text-slate-400">
            {r.indexedCount}/{r.documentCount} indexed
          </div>
        </div>
      ))}

      {documents.slice(0, 24).map((doc, i) => {
        const region = regions.find((r) => r.id === doc.subjectArea);
        const baseX = region?.x ?? 0.5;
        const baseY = region?.y ?? 0.5;
        const jitterX = baseX + ((i % 5) - 2) * 0.04;
        const jitterY = baseY + (Math.floor(i / 5) - 1) * 0.05;
        return (
          <NeuroSourceNode
            key={doc.id}
            doc={doc}
            x={Math.min(0.92, Math.max(0.08, jitterX))}
            y={Math.min(0.92, Math.max(0.08, jitterY))}
            selected={selectedDocumentId === doc.id}
            onClick={() => onSelectDocument(doc)}
          />
        );
      })}

      <style jsx>{`
        @keyframes neuro-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 rgba(34, 211, 238, 0);
          }
          50% {
            box-shadow: 0 0 28px rgba(34, 211, 238, 0.35);
          }
        }
      `}</style>
    </div>
  );
}
