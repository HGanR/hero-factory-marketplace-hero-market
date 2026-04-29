"use client";

import React, { useState } from "react";
import {
  BROADCAST_SCHEDULED_ACTION_TYPES,
  type BroadcastScheduledAction,
  type BroadcastScheduledActionType,
} from "@/lib/meet/broadcast-schedule";

function newActionId(): string {
  return `sched_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function BroadcastScheduledActionsEditor({
  actions,
  onChange,
  disabled,
}: {
  actions: BroadcastScheduledAction[];
  onChange: (next: BroadcastScheduledAction[]) => void;
  disabled?: boolean;
}) {
  const [draftType, setDraftType] = useState<BroadcastScheduledActionType>("switch_scene");
  const [draftAt, setDraftAt] = useState("");
  const [draftScene, setDraftScene] = useState("intro");
  const [draftKind, setDraftKind] = useState<"lower_third" | "ticker" | "cta_banner">("lower_third");
  const [draftPatchJson, setDraftPatchJson] = useState("{}");
  const [draftErr, setDraftErr] = useState<string | null>(null);

  const toggleEnabled = (id: string) => {
    onChange(actions.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  };

  const remove = (id: string) => {
    onChange(actions.filter((a) => a.id !== id));
  };

  const add = () => {
    setDraftErr(null);
    if (!draftAt.trim()) {
      setDraftErr("Pick a run time");
      return;
    }
    const executeAtIso = new Date(draftAt).toISOString();
    if (Number.isNaN(Date.parse(executeAtIso))) {
      setDraftErr("Invalid time");
      return;
    }

    let payload: Record<string, unknown> = {};
    switch (draftType) {
      case "switch_scene":
        payload = { sceneType: draftScene };
        break;
      case "reset_scene_to_program":
      case "stop_countdown":
        payload = {};
        break;
      case "show_overlay":
      case "hide_overlay":
        payload = { kind: draftKind };
        break;
      case "update_overlay": {
        let patch: Record<string, unknown> = {};
        try {
          patch = JSON.parse(draftPatchJson || "{}") as Record<string, unknown>;
        } catch {
          setDraftErr("Patch must be valid JSON");
          return;
        }
        payload = { kind: draftKind, patch };
        break;
      }
      case "start_countdown":
        payload = { visible: true };
        break;
      default:
        payload = {};
    }

    const next: BroadcastScheduledAction = {
      id: newActionId(),
      actionType: draftType,
      executeAtIso,
      payload,
      enabled: true,
    };
    onChange([...actions, next].sort((a, b) => Date.parse(a.executeAtIso) - Date.parse(b.executeAtIso)));
  };

  return (
    <div className="space-y-2 text-[11px] text-slate-200">
      <div className="text-slate-500 uppercase tracking-wide text-[10px]">Scheduled actions</div>
      {actions.length === 0 ? (
        <p className="text-slate-500">No actions. Add timed scene, overlay, or countdown steps below.</p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-slate-800 p-1">
          {actions.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-1 rounded bg-slate-950/60 px-1.5 py-1"
            >
              <span className="font-mono text-[10px] text-slate-400">
                {new Date(a.executeAtIso).toLocaleString()}
              </span>
              <span className="text-slate-300">{a.actionType}</span>
              <span className={a.enabled ? "text-emerald-400" : "text-slate-600"}>{a.enabled ? "on" : "off"}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded border border-slate-600 px-1 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  onClick={() => toggleEnabled(a.id)}
                >
                  Toggle
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded border border-slate-600 px-1 text-[10px] text-red-300 hover:bg-slate-800 disabled:opacity-40"
                  onClick={() => remove(a.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5 rounded border border-slate-800 bg-slate-950/40 p-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="block text-slate-500 mb-0.5">Type</span>
            <select
              className="w-full rounded border border-slate-600 bg-slate-950 px-1 py-1 text-[10px] text-slate-100"
              value={draftType}
              disabled={disabled}
              onChange={(e) => setDraftType(e.target.value as BroadcastScheduledActionType)}
            >
              {BROADCAST_SCHEDULED_ACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-slate-500 mb-0.5">Run at (local)</span>
            <input
              type="datetime-local"
              className="w-full rounded border border-slate-600 bg-slate-950 px-1 py-1 text-[10px] text-slate-100"
              value={draftAt}
              disabled={disabled}
              onChange={(e) => setDraftAt(e.target.value)}
            />
          </div>
        </div>
        {draftType === "switch_scene" ? (
          <div>
            <span className="block text-slate-500 mb-0.5">Scene</span>
            <select
              className="w-full rounded border border-slate-600 bg-slate-950 px-1 py-1 text-[10px]"
              value={draftScene}
              disabled={disabled}
              onChange={(e) => setDraftScene(e.target.value)}
            >
              <option value="program">program</option>
              <option value="intro">intro</option>
              <option value="brb">brb</option>
              <option value="outro">outro</option>
              <option value="holding">holding</option>
            </select>
          </div>
        ) : null}
        {(draftType === "show_overlay" ||
          draftType === "hide_overlay" ||
          draftType === "update_overlay") && (
          <div>
            <span className="block text-slate-500 mb-0.5">Overlay kind</span>
            <select
              className="w-full rounded border border-slate-600 bg-slate-950 px-1 py-1 text-[10px]"
              value={draftKind}
              disabled={disabled}
              onChange={(e) => setDraftKind(e.target.value as typeof draftKind)}
            >
              <option value="lower_third">lower_third</option>
              <option value="ticker">ticker</option>
              <option value="cta_banner">cta_banner</option>
            </select>
          </div>
        )}
        {draftType === "update_overlay" ? (
          <div>
            <span className="block text-slate-500 mb-0.5">Patch JSON</span>
            <textarea
              className="h-16 w-full rounded border border-slate-600 bg-slate-950 p-1 font-mono text-[10px] text-slate-100"
              value={draftPatchJson}
              disabled={disabled}
              onChange={(e) => setDraftPatchJson(e.target.value)}
              placeholder='{"visible":true,"headline":"Hi"}'
            />
          </div>
        ) : null}
        {draftErr ? <p className="text-[10px] text-red-300">{draftErr}</p> : null}
        <button
          type="button"
          disabled={disabled}
          className="w-full rounded bg-slate-700 py-1 text-[11px] text-white hover:bg-slate-600 disabled:opacity-40"
          onClick={() => add()}
        >
          Add action
        </button>
      </div>
    </div>
  );
}
