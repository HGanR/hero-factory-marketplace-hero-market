"use client";

import React, { useMemo, useState } from "react";
import {
  BROADCAST_LAYOUT_MODES,
  getDefaultSceneConfig,
  type BroadcastSceneConfig,
  type BroadcastLayoutMode,
} from "@/lib/meet/broadcast-scene";
import {
  suggestPortraitSafeForDestinations,
  suggestSceneLayoutForDestinations,
} from "@/lib/meet/broadcast-scene-suggestions";
import type { PublicDestination } from "@/hooks/useMeetBroadcast";
import { BroadcastLayoutPreviewCard } from "./BroadcastLayoutPreviewCard";
import { MeetBroadcastBrandingForm } from "./MeetBroadcastBrandingForm";
import { MeetBroadcastScenePresetPicker } from "./MeetBroadcastScenePresetPicker";

export type SceneConfigChangeMeta = { fromPresetId?: number };

export function MeetBroadcastSceneControls({
  destinations,
  sceneConfig,
  onSceneConfigChange,
}: {
  destinations: PublicDestination[];
  sceneConfig: BroadcastSceneConfig;
  /** Pass `fromPresetId` when applying a saved preset so start can use `scenePresetId` until the host edits the scene. */
  onSceneConfigChange: (next: BroadcastSceneConfig, meta?: SceneConfigChangeMeta) => void;
}) {
  const activeDests = useMemo(() => destinations.filter((d) => d.isActive), [destinations]);
  const suggestedLayout = useMemo(() => suggestSceneLayoutForDestinations(activeDests), [activeDests]);
  const suggestedPortrait = useMemo(() => suggestPortraitSafeForDestinations(activeDests), [activeDests]);
  const [saveName, setSaveName] = useState("");

  async function savePreset() {
    const name = saveName.trim() || "My scene";
    const res = await fetch("/api/meet/broadcast/scene-presets", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, config: sceneConfig }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "Save failed");
      return;
    }
    setSaveName("");
    alert("Preset saved.");
  }

  return (
    <div
      className="mt-3 pt-3 border-t border-slate-700 space-y-3"
      data-testid="meet-broadcast-scene-controls"
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500">Program scene (V1)</div>
      <p className="text-[10px] text-slate-500 leading-snug" data-testid="meet-broadcast-scene-v1-disclaimer">
        Current V1 scene engine stores intent and metadata; rendered compositor polish is a later phase. LiveKit still
        uses standard room composites only.
      </p>

      {(suggestedLayout !== sceneConfig.layoutMode || suggestedPortrait !== sceneConfig.portraitSafe) && (
        <div className="text-[10px] text-sky-200/90 bg-sky-950/30 border border-sky-800/40 rounded px-2 py-1.5 space-y-1">
          <div>
            Suggested layout for your destinations: <code className="text-sky-100">{suggestedLayout}</code>
          </div>
          {suggestedPortrait ? (
            <div>Portrait-safe framing is recommended for at least one destination — toggle below if you stream vertical.</div>
          ) : null}
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="text-[9px] px-1.5 py-0.5 rounded bg-sky-800/60 hover:bg-sky-700/80"
              onClick={() =>
                onSceneConfigChange({
                  ...sceneConfig,
                  layoutMode: suggestedLayout,
                  portraitSafe: suggestedPortrait || sceneConfig.portraitSafe,
                })
              }
            >
              Apply suggestions
            </button>
          </div>
        </div>
      )}

      <label className="block text-xs text-slate-400">
        Layout
        <select
          className="mt-1 w-full rounded bg-slate-800 border border-slate-600 text-sm p-2 text-white"
          value={sceneConfig.layoutMode}
          onChange={(e) =>
            onSceneConfigChange({ ...sceneConfig, layoutMode: e.target.value as BroadcastLayoutMode })
          }
        >
          {BROADCAST_LAYOUT_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <BroadcastLayoutPreviewCard layoutMode={sceneConfig.layoutMode} />

      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sceneConfig.showParticipantNames}
            onChange={(e) => onSceneConfigChange({ ...sceneConfig, showParticipantNames: e.target.checked })}
          />
          Names
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sceneConfig.showMutedIndicators}
            onChange={(e) => onSceneConfigChange({ ...sceneConfig, showMutedIndicators: e.target.checked })}
          />
          Muted
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sceneConfig.showFooter}
            onChange={(e) => onSceneConfigChange({ ...sceneConfig, showFooter: e.target.checked })}
          />
          Footer
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sceneConfig.portraitSafe}
            onChange={(e) => onSceneConfigChange({ ...sceneConfig, portraitSafe: e.target.checked })}
          />
          Portrait safe
        </label>
        <label className="flex items-center gap-2 cursor-pointer col-span-2">
          <input
            type="checkbox"
            checked={sceneConfig.screenSharePriority}
            onChange={(e) => onSceneConfigChange({ ...sceneConfig, screenSharePriority: e.target.checked })}
          />
          Screen share priority
        </label>
      </div>

      <MeetBroadcastBrandingForm branding={sceneConfig.branding} onChange={(b) => onSceneConfigChange({ ...sceneConfig, branding: b })} />

      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex-1 min-w-[120px] text-[10px] text-slate-400">
          Save as preset
          <input
            className="mt-0.5 w-full rounded bg-slate-800 border border-slate-600 text-sm p-1.5 text-white"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Preset name"
          />
        </label>
        <button
          type="button"
          className="text-xs px-2 py-1.5 rounded bg-cyan-800 hover:bg-cyan-700"
          onClick={() => void savePreset()}
        >
          Save
        </button>
        <button
          type="button"
          className="text-xs px-2 py-1.5 rounded bg-slate-700 hover:bg-slate-600"
          onClick={() => onSceneConfigChange(getDefaultSceneConfig())}
        >
          Reset
        </button>
      </div>

      <MeetBroadcastScenePresetPicker onLoadPreset={(p) => onSceneConfigChange(p.config, { fromPresetId: p.id })} />
    </div>
  );
}
