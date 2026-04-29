"use client";

import React from "react";
import type { BroadcastCountdownConfig } from "@/lib/meet/broadcast-schedule";

export function BroadcastCountdownEditor({
  value,
  onChange,
  disabled,
}: {
  value: BroadcastCountdownConfig;
  onChange: (next: Partial<BroadcastCountdownConfig>) => void;
  disabled?: boolean;
}) {
  const targetLocal =
    value.targetTimeIso && !Number.isNaN(Date.parse(value.targetTimeIso))
      ? (() => {
          const d = new Date(value.targetTimeIso!);
          const pad = (n: number) => String(n).padStart(2, "0");
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        })()
      : "";

  return (
    <div className="space-y-2 text-[11px] text-slate-200">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.visible}
          disabled={disabled}
          onChange={(e) => onChange({ visible: e.target.checked })}
        />
        Show countdown on stream
      </label>
      <div>
        <span className="block text-slate-500 mb-0.5">Target (local)</span>
        <input
          type="datetime-local"
          className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
          value={targetLocal}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) {
              onChange({ targetTimeIso: undefined });
              return;
            }
            const iso = new Date(v).toISOString();
            onChange({ targetTimeIso: iso });
          }}
        />
      </div>
      <div>
        <span className="block text-slate-500 mb-0.5">Label</span>
        <input
          type="text"
          maxLength={120}
          className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
          value={value.label ?? ""}
          disabled={disabled}
          placeholder="Optional"
          onChange={(e) => onChange({ label: e.target.value || undefined })}
        />
      </div>
      <div>
        <span className="block text-slate-500 mb-0.5">Position</span>
        <select
          className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
          value={value.position ?? "top_right"}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              position: e.target.value as BroadcastCountdownConfig["position"],
            })
          }
        >
          <option value="top_right">Top right</option>
          <option value="top_center">Top center</option>
          <option value="bottom_right">Bottom right</option>
        </select>
      </div>
      <div>
        <span className="block text-slate-500 mb-0.5">Accent (#RRGGBB)</span>
        <input
          type="text"
          className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 font-mono text-[10px] text-slate-100"
          value={value.accentHex ?? ""}
          disabled={disabled}
          placeholder="#00d1ff"
          onChange={(e) => onChange({ accentHex: e.target.value.trim() || undefined })}
        />
      </div>
    </div>
  );
}
