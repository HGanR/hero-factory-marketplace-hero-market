"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { BroadcastLiveSceneType } from "@/lib/meet/broadcast-live-scenes";
import type { BroadcastLayoutMode } from "@/lib/meet/broadcast-scene";
import type { BroadcastLiveSceneSummary } from "@/hooks/useMeetBroadcast";
import { BroadcastSceneQuickActions } from "./BroadcastSceneQuickActions";

const SCENE_TYPES: { id: BroadcastLiveSceneType; label: string }[] = [
  { id: "program", label: "Program" },
  { id: "intro", label: "Intro" },
  { id: "brb", label: "BRB" },
  { id: "outro", label: "Outro" },
  { id: "holding", label: "Holding" },
];

export function MeetBroadcastLiveSceneControls({
  broadcastSessionId,
  hostWalletAddress,
  templateActive,
  liveScene,
  fetchLiveSceneState,
  updateLiveSceneState,
  resetLiveSceneState,
}: {
  broadcastSessionId: number;
  hostWalletAddress: string;
  templateActive: boolean;
  liveScene: BroadcastLiveSceneSummary | null | undefined;
  fetchLiveSceneState: (id: number) => Promise<{ ok: boolean; state?: unknown; error?: string; code?: string }>;
  updateLiveSceneState: (
    id: number,
    patch: Record<string, unknown>
  ) => Promise<{ ok: boolean; error?: string; code?: string }>;
  resetLiveSceneState: (id: number) => Promise<{ ok: boolean; error?: string; code?: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [subhead, setSubhead] = useState("");

  const syncFields = useCallback(() => {
    setHeadline(liveScene?.customHeadline ?? "");
    setSubhead(liveScene?.customSubheadline ?? "");
  }, [liveScene?.customHeadline, liveScene?.customSubheadline]);

  useEffect(() => {
    syncFields();
  }, [syncFields]);

  const onScene = async (sceneType: BroadcastLiveSceneType) => {
    setBusy(true);
    setLocalErr(null);
    const r = await updateLiveSceneState(broadcastSessionId, { sceneType });
    if (!r.ok) setLocalErr(r.error ?? r.code ?? "Update failed");
    setBusy(false);
  };

  const onLayout = async (layoutMode: BroadcastLayoutMode) => {
    setBusy(true);
    setLocalErr(null);
    const r = await updateLiveSceneState(broadcastSessionId, { layoutMode, sceneType: "program" });
    if (!r.ok) setLocalErr(r.error ?? r.code ?? "Update failed");
    setBusy(false);
  };

  const onApplyText = async () => {
    setBusy(true);
    setLocalErr(null);
    const r = await updateLiveSceneState(broadcastSessionId, {
      customHeadline: headline.trim() || null,
      customSubheadline: subhead.trim() || null,
    });
    if (!r.ok) setLocalErr(r.error ?? r.code ?? "Update failed");
    setBusy(false);
  };

  const onReset = async () => {
    setBusy(true);
    setLocalErr(null);
    const r = await resetLiveSceneState(broadcastSessionId);
    if (!r.ok) setLocalErr(r.error ?? r.code ?? "Reset failed");
    else void fetchLiveSceneState(broadcastSessionId);
    setBusy(false);
  };

  if (!templateActive) {
    return (
      <div
        className="mt-3 rounded border border-slate-800 bg-slate-950/40 px-2 py-2 text-[11px] text-slate-500"
        data-testid="meet-broadcast-live-scene-disabled"
      >
        Live scene control is available only when the V2 rendered compositor template is active (not V1 fallback).
      </div>
    );
  }

  const sceneType = (liveScene?.sceneType ?? "program") as BroadcastLiveSceneType;
  const nonProgram = sceneType !== "program";

  return (
    <div
      className="mt-3 rounded border border-slate-700/80 bg-slate-950/50 px-2 py-2 space-y-2"
      data-testid="meet-broadcast-live-scene-controls"
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500">Live scene (V2)</div>
      {localErr ? <p className="text-[11px] text-red-300">{localErr}</p> : null}
      <div className="flex flex-wrap gap-1">
        {SCENE_TYPES.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={busy}
            data-testid={`broadcast-live-scene-type-${s.id}`}
            onClick={() => void onScene(s.id)}
            className={`rounded px-2 py-0.5 text-[11px] border ${
              sceneType === s.id
                ? "border-violet-500/70 bg-violet-950/40 text-violet-100"
                : "border-slate-600 bg-slate-800/60 text-slate-200"
            } disabled:opacity-40`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {sceneType === "program" ? (
        <BroadcastSceneQuickActions disabled={busy} activeLayout={liveScene?.layoutMode ?? "gallery"} onPickLayout={onLayout} />
      ) : (
        <div className="space-y-1" data-testid="broadcast-live-scene-headline-editor">
          <label className="block text-[10px] text-slate-500">Headline / subheadline (optional)</label>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            disabled={busy}
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
            placeholder="Headline"
          />
          <input
            value={subhead}
            onChange={(e) => setSubhead(e.target.value)}
            disabled={busy}
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
            placeholder="Subheadline"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void onApplyText()}
            className="text-[11px] rounded bg-slate-700 px-2 py-0.5 text-white hover:bg-slate-600 disabled:opacity-40"
          >
            Apply text
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onReset()}
          className="text-[11px] rounded border border-slate-600 px-2 py-0.5 text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          data-testid="broadcast-live-scene-reset"
        >
          Reset to program default
        </button>
      </div>
    </div>
  );
}
