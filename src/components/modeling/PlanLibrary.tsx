"use client";

import React, { useEffect, useState } from "react";
import { FolderOpen, Copy, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export type PlanSummary = {
  id: number;
  name: string;
  planKind: string;
  planVersion: number;
  prompt: string | null;
  trustId: string | null;
  createdAt: string | null;
  updatedAt?: string | null;
};

const KINDS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "room", label: "Room" },
  { value: "conference_room", label: "Conference" },
  { value: "office_hq", label: "Office HQ" },
  { value: "vault_room", label: "Vault" },
  { value: "podium", label: "Podium" },
];

export type PlanMeta = { planHash?: string | null; planVersion?: number; seed?: number | null };

export interface PlanLibraryProps {
  onLoadPlan: (planJson: Record<string, unknown>, meta?: PlanMeta) => void;
  onSavePlan?: (plan: Record<string, unknown>, name: string) => Promise<void>;
  disabled?: boolean;
  /** Increment to trigger refresh (e.g. after saving a new plan) */
  refreshKey?: number;
}

export function PlanLibrary({ onLoadPlan, onSavePlan, disabled, refreshKey = 0 }: PlanLibraryProps) {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [kindFilter, setKindFilter] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameUpdatedAt, setRenameUpdatedAt] = useState<string | null>(null);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (kindFilter) params.set("kind", kindFilter);
      const res = await fetch(`/api/modeling/plans?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load plans");
      const data = await res.json();
      setPlans(data.plans ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load plans");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) loadPlans();
  }, [expanded, kindFilter, refreshKey]);

  const handleLoad = async (id: number) => {
    if (disabled) return;
    try {
      const res = await fetch(`/api/modeling/plans/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load plan");
      const data = await res.json();
      if (data.planJson && typeof data.planJson === "object") {
        onLoadPlan(data.planJson, {
          planHash: data.planHash ?? null,
          planVersion: data.planVersion,
          seed: data.seed ?? null,
        });
        toast.success(`Loaded: ${data.name}`);
      } else {
        throw new Error("Invalid plan data");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load plan");
    }
  };

  const handleDuplicate = async (p: PlanSummary) => {
    if (disabled || !onSavePlan) return;
    try {
      const res = await fetch(`/api/modeling/plans/${p.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load plan");
      const data = await res.json();
      if (!data.planJson || typeof data.planJson !== "object") throw new Error("Invalid plan data");
      await onSavePlan(data.planJson, `Copy of ${p.name}`);
      toast.success("Plan duplicated");
      loadPlans();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate");
    }
  };

  const handleRenameStart = (p: PlanSummary) => {
    setRenamingId(p.id);
    setRenameValue(p.name);
    setRenameUpdatedAt(p.updatedAt ?? null);
  };

  const handleRenameSave = async () => {
    if (renamingId == null || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      const body: { name: string; updatedAt?: string } = { name: renameValue.trim() };
      if (renameUpdatedAt) body.updatedAt = renameUpdatedAt;
      const res = await fetch(`/api/modeling/plans/${renamingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.error("Plan was updated elsewhere. Reloading…");
        setRenamingId(null);
        loadPlans();
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Failed to rename");
      toast.success("Plan renamed");
      setRenamingId(null);
      loadPlans();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename");
    }
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
    setRenameValue("");
    setRenameUpdatedAt(null);
  };

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        My Plans
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="w-full rounded px-2 py-1.5 text-xs bg-slate-800/80 border border-slate-700 text-slate-200"
          >
            {KINDS.map((k) => (
              <option key={k.value || "_"} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          {loading ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : plans.length === 0 ? (
            <p className="text-xs text-slate-500">No plans saved yet.</p>
          ) : (
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {plans.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded bg-slate-800/60 px-2 py-1.5 text-xs group"
                >
                  {renamingId === p.id ? (
                    <>
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameSave();
                          if (e.key === "Escape") handleRenameCancel();
                        }}
                        className="flex-1 rounded px-1.5 py-0.5 bg-slate-900 text-slate-200"
                        autoFocus
                      />
                      <button
                        onClick={handleRenameSave}
                        className="text-amber-400 hover:text-amber-300"
                        title="Save"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleRenameCancel}
                        className="text-slate-500 hover:text-slate-300"
                        title="Cancel"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate text-slate-200" title={p.name}>
                        {p.name}
                      </span>
                      <span className="shrink-0 rounded px-1.5 py-0.5 bg-slate-700/80 text-slate-400">
                        {p.planKind}
                      </span>
                      <button
                        onClick={() => handleLoad(p.id)}
                        disabled={disabled}
                        className="opacity-70 hover:opacity-100 text-cyan-400"
                        title="Load into canvas"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </button>
                      {onSavePlan && (
                        <button
                          onClick={() => handleDuplicate(p)}
                          disabled={disabled}
                          className="opacity-70 hover:opacity-100 text-slate-400"
                          title="Duplicate"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRenameStart(p)}
                        disabled={disabled}
                        className="opacity-70 hover:opacity-100 text-slate-400"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
