"use client";

import React from "react";
import type { BroadcastLayoutMode } from "@/lib/meet/broadcast-scene";

const PROGRAM_LAYOUTS: { id: BroadcastLayoutMode; label: string }[] = [
  { id: "speaker", label: "Speaker" },
  { id: "gallery", label: "Gallery" },
  { id: "screenshare_focus", label: "Screen share" },
  { id: "portrait_speaker", label: "Portrait speaker" },
];

export function BroadcastSceneQuickActions({
  disabled,
  activeLayout,
  onPickLayout,
}: {
  disabled: boolean;
  activeLayout: string;
  onPickLayout: (layout: BroadcastLayoutMode) => void;
}) {
  return (
    <div className="mt-2 space-y-1" data-testid="broadcast-scene-quick-actions">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">Program layout</div>
      <div className="flex flex-wrap gap-1">
        {PROGRAM_LAYOUTS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            data-testid={`broadcast-quick-layout-${p.id}`}
            onClick={() => onPickLayout(p.id)}
            className={`rounded px-2 py-0.5 text-[11px] border ${
              activeLayout === p.id
                ? "border-cyan-500/70 bg-cyan-950/50 text-cyan-100"
                : "border-slate-600 bg-slate-800/60 text-slate-200 hover:border-slate-500"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
