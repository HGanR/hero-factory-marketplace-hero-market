"use client";

import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Lock, Pencil, Trash2, X } from "lucide-react";
import type { ScenePlan } from "@/lib/modeling/prompt-schema";
import {
  clearAddons,
  duplicateSceneObject,
  getContainerIndex,
  normalizeScene,
  removeSceneObject,
  renameSceneObject,
  reorderSceneObject,
} from "@/lib/modeling/scene-plan";

export interface SceneInspectorPanelProps {
  scenePlan: ScenePlan;
  onUpdateScenePlan: (next: ScenePlan) => void;
  selectedSceneObjectId?: string | null;
  onSelectSceneObjectId?: (id: string | null) => void;
  disabled?: boolean;
}

export function SceneInspectorPanel({
  scenePlan,
  onUpdateScenePlan,
  selectedSceneObjectId = null,
  onSelectSceneObjectId,
  disabled,
}: SceneInspectorPanelProps) {
  const normalized = useMemo(() => normalizeScene(scenePlan), [scenePlan]);
  const containerIdx = getContainerIndex(normalized);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  return (
    <div className="mt-2 rounded border border-slate-700/70 bg-slate-900/50 p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">Scene</span>
        <div className="flex items-center gap-2">
          {selectedSceneObjectId && (
            <button
              disabled={disabled}
              onClick={() => onSelectSceneObjectId?.(null)}
              className="text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
              title="Clear selection"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <button
            disabled={disabled || normalized.objects.length <= 1}
            onClick={() => onUpdateScenePlan(clearAddons(normalized))}
            className="text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
            title="Remove all objects except container"
          >
            Clear add-ons
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {normalized.objects.map((entry, idx) => {
          const isContainer = idx === containerIdx;
          const isEditing = editingId === entry.id;
          return (
            <div
              key={entry.id}
              onClick={() => {
                if (!isEditing) onSelectSceneObjectId?.(entry.id);
              }}
              className={`flex items-center gap-1 rounded px-2 py-1 ${
                selectedSceneObjectId === entry.id
                  ? "bg-cyan-800/40 ring-1 ring-cyan-500/40"
                  : "bg-slate-800/70"
              }`}
            >
              {isEditing ? (
                <input
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onBlur={() => {
                    const next = editingLabel.trim();
                    if (next) onUpdateScenePlan(renameSceneObject(normalized, entry.id, next));
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const next = editingLabel.trim();
                      if (next) onUpdateScenePlan(renameSceneObject(normalized, entry.id, next));
                      setEditingId(null);
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="min-w-0 flex-1 rounded bg-slate-900 px-1 py-0.5 text-[11px] text-slate-200"
                  autoFocus
                />
              ) : (
                <button
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSceneObjectId?.(entry.id);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-[11px] text-slate-300 hover:text-white disabled:opacity-40"
                  title={entry.label ?? entry.plan.kind}
                >
                  {entry.label ?? entry.plan.kind}
                  <span className="ml-1 text-[10px] text-slate-500">({entry.plan.kind})</span>
                </button>
              )}
              {isContainer && <Lock className="h-3 w-3 text-slate-500" />}
              <button
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(entry.id);
                  setEditingLabel(entry.label ?? entry.plan.kind);
                }}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-30"
                title="Rename"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                disabled={disabled || idx === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateScenePlan(reorderSceneObject(normalized, entry.id, -1));
                }}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-30"
                title="Move up"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                disabled={disabled || idx === normalized.objects.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateScenePlan(reorderSceneObject(normalized, entry.id, 1));
                }}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-30"
                title="Move down"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
              <button
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateScenePlan(duplicateSceneObject(normalized, entry.id));
                }}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-30"
                title="Duplicate"
              >
                <Copy className="h-3 w-3" />
              </button>
              <button
                disabled={disabled || entry.locked}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateScenePlan(removeSceneObject(normalized, entry.id));
                }}
                className="rounded p-0.5 text-rose-400 hover:bg-slate-700 hover:text-rose-300 disabled:opacity-30"
                title={entry.locked ? "Locked" : "Remove"}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

