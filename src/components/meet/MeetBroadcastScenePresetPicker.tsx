"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { BroadcastSceneConfig } from "@/lib/meet/broadcast-scene";

export type ScenePresetListItem = {
  id: number;
  name: string;
  config: BroadcastSceneConfig;
  isDefault: boolean;
};

export function MeetBroadcastScenePresetPicker({
  onLoadPreset,
}: {
  onLoadPreset: (preset: ScenePresetListItem) => void;
}) {
  const [presets, setPresets] = useState<ScenePresetListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/meet/broadcast/scene-presets", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { presets?: ScenePresetListItem[]; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Failed to load presets");
        setPresets([]);
        return;
      }
      setPresets(data.presets ?? []);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setDefault(id: number) {
    const res = await fetch(`/api/meet/broadcast/scene-presets/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    if (res.ok) await refresh();
    else setErr("Could not set default preset");
  }

  async function removePreset(id: number) {
    if (!confirm("Delete this scene preset?")) return;
    const res = await fetch(`/api/meet/broadcast/scene-presets/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) await refresh();
    else setErr("Delete failed");
  }

  return (
    <div className="text-xs space-y-2" data-testid="meet-broadcast-scene-preset-picker">
      <div className="flex justify-between items-center">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Scene presets</span>
        <button
          type="button"
          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600"
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="text-[10px] text-slate-500">Loading…</p> : null}
      {err ? <p className="text-[10px] text-red-300">{err}</p> : null}
      <ul className="max-h-28 overflow-y-auto space-y-1">
        {presets.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center gap-1 bg-slate-900/60 rounded px-2 py-1 border border-slate-700/80"
          >
            <button
              type="button"
              className="text-left text-slate-200 hover:text-white flex-1 min-w-0 truncate"
              onClick={() => onLoadPreset(p)}
            >
              {p.name}
              {p.isDefault ? (
                <span className="ml-1 text-[9px] text-emerald-400">(default)</span>
              ) : null}
            </button>
            <button
              type="button"
              className="text-[9px] px-1 py-0.5 rounded bg-slate-700"
              onClick={() => void setDefault(p.id)}
            >
              Default
            </button>
            <button
              type="button"
              className="text-[9px] px-1 py-0.5 rounded bg-red-900/50"
              onClick={() => void removePreset(p.id)}
            >
              Del
            </button>
          </li>
        ))}
        {!loading && presets.length === 0 ? (
          <li className="text-[10px] text-slate-500">No saved presets yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
