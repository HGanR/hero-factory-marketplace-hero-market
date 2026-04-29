"use client";

import React from "react";
import type { BroadcastTicker } from "@/lib/meet/broadcast-overlays";

export function BroadcastTickerEditor({
  value,
  onChange,
  disabled,
}: {
  value: BroadcastTicker;
  onChange: (patch: Partial<BroadcastTicker>) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1 rounded border border-slate-800/80 bg-slate-950/40 px-2 py-2" data-testid="broadcast-ticker-editor">
      <label className="flex items-center gap-2 text-[11px] text-slate-300">
        <input
          type="checkbox"
          checked={value.visible}
          disabled={disabled}
          onChange={(e) => onChange({ visible: e.target.checked })}
          data-testid="broadcast-overlay-ticker-visible"
        />
        Ticker
      </label>
      <input
        value={value.text ?? ""}
        disabled={disabled}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="Ticker text"
        className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
      />
      <select
        value={value.speed ?? "normal"}
        disabled={disabled}
        onChange={(e) => onChange({ speed: e.target.value as BroadcastTicker["speed"] })}
        className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
      >
        <option value="normal">Speed: normal (static line for now)</option>
        <option value="slow">Speed: slow</option>
      </select>
      <input
        value={value.accentHex ?? ""}
        disabled={disabled}
        onChange={(e) => onChange({ accentHex: e.target.value || undefined })}
        placeholder="Accent #RRGGBB (optional)"
        className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] font-mono text-slate-100"
      />
    </div>
  );
}
