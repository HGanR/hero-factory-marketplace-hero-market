"use client";

import React from "react";
import type { BroadcastLayoutMode } from "@/lib/meet/broadcast-scene";

const LABELS: Record<BroadcastLayoutMode, { title: string; hint: string }> = {
  speaker: { title: "Speaker", hint: "Primary speaker emphasis (landscape-style composite)." },
  gallery: { title: "Gallery", hint: "Grid of participants." },
  screenshare_focus: { title: "Screen share focus", hint: "Intent: prioritize screen share when active (V1 uses speaker composite)." },
  portrait_speaker: { title: "Portrait speaker", hint: "Tall single-speaker framing intent." },
  portrait_split: { title: "Portrait split", hint: "Split layout intent (V1 maps to grid composite)." },
};

export function BroadcastLayoutPreviewCard({
  layoutMode,
  compact,
}: {
  layoutMode: BroadcastLayoutMode;
  compact?: boolean;
}) {
  const L = LABELS[layoutMode] ?? LABELS.gallery;
  return (
    <div
      className={`rounded border border-slate-700/80 bg-slate-950/50 ${compact ? "p-2" : "p-3"}`}
      data-testid="broadcast-layout-preview-card"
    >
      <div className={`font-medium text-slate-200 ${compact ? "text-[11px]" : "text-xs"}`}>{L.title}</div>
      {!compact ? <p className="text-[10px] text-slate-500 mt-1 leading-snug">{L.hint}</p> : null}
    </div>
  );
}
