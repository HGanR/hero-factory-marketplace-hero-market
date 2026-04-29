"use client";

import React from "react";
import type { BroadcastAutoDirectingPolicy } from "@/lib/meet/broadcast-auto-directing";

export function BroadcastAutoDirectingPolicyEditor({
  policy,
  disabled,
  onChange,
}: {
  policy: BroadcastAutoDirectingPolicy;
  disabled: boolean;
  onChange: (patch: Partial<BroadcastAutoDirectingPolicy>) => void;
}) {
  return (
    <div className="space-y-2 text-[11px] text-slate-300">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={policy.preferScreenShareFocus}
          disabled={disabled}
          onChange={(e) => onChange({ preferScreenShareFocus: e.target.checked })}
        />
        Prefer screen-share focus layout when sharing
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={policy.preferPortraitLayouts}
          disabled={disabled}
          onChange={(e) => onChange({ preferPortraitLayouts: e.target.checked })}
        />
        Prefer portrait speaker when destinations support portrait
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={policy.allowAutoReturnToProgramDefault}
          disabled={disabled}
          onChange={(e) => onChange({ allowAutoReturnToProgramDefault: e.target.checked })}
        />
        Allow auto return to program default (conservative; mostly unused this phase)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-500">Speaker debounce (ms)</span>
        <input
          type="number"
          min={0}
          max={120_000}
          step={500}
          className="w-24 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-slate-200"
          value={policy.speakerSwitchDebounceMs}
          disabled={disabled}
          onChange={(e) => onChange({ speakerSwitchDebounceMs: Number(e.target.value) })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-500">Gallery threshold</span>
        <input
          type="number"
          min={1}
          max={50}
          className="w-16 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-slate-200"
          value={policy.galleryParticipantThreshold}
          disabled={disabled}
          onChange={(e) => onChange({ galleryParticipantThreshold: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
