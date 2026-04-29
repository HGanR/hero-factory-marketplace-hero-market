"use client";

import React from "react";
import type { BroadcastLowerThird } from "@/lib/meet/broadcast-overlays";

export function BroadcastLowerThirdEditor({
  value,
  onChange,
  disabled,
}: {
  value: BroadcastLowerThird;
  onChange: (patch: Partial<BroadcastLowerThird>) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1 rounded border border-slate-800/80 bg-slate-950/40 px-2 py-2" data-testid="broadcast-lower-third-editor">
      <label className="flex items-center gap-2 text-[11px] text-slate-300">
        <input
          type="checkbox"
          checked={value.visible}
          disabled={disabled}
          onChange={(e) => onChange({ visible: e.target.checked })}
          data-testid="broadcast-overlay-lt-visible"
        />
        Lower third
      </label>
      <input
        value={value.headline ?? ""}
        disabled={disabled}
        onChange={(e) => onChange({ headline: e.target.value })}
        placeholder="Headline"
        className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
      />
      <input
        value={value.subheadline ?? ""}
        disabled={disabled}
        onChange={(e) => onChange({ subheadline: e.target.value })}
        placeholder="Subheadline"
        className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
      />
      <select
        value={value.position ?? "bottom_left"}
        disabled={disabled}
        onChange={(e) => onChange({ position: e.target.value as BroadcastLowerThird["position"] })}
        className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
      >
        <option value="bottom_left">Bottom left</option>
        <option value="bottom_center">Bottom center</option>
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
