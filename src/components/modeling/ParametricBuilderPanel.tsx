"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Sparkles, Copy } from "lucide-react";
import { PlanLibrary, type PlanMeta } from "@/components/modeling/PlanLibrary";
import { SceneInspectorPanel } from "@/components/modeling/SceneInspectorPanel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ScenePlan } from "@/lib/modeling/prompt-schema";
import { isScenePlan, normalizeScene } from "@/lib/modeling/scene-plan";

export type SuggestedAssetPayload = { label?: string; query?: string; modelUrl?: string; assetUri?: string };
export type SuggestedObjectPayload = {
  kind?: "room" | "office_hq" | "conference_room" | "podium" | "vault_room";
  placement?: { mode: "auto"; anchor: "center" | "near_wall" | "on_table" | "near_door" };
  label?: string;
};

export interface ParametricBuilderPanelProps {
  /** Called when API returns a parametric plan */
  onGenerateFromPlan: (plan: Record<string, unknown>) => void;
  /** Called when API returns a model URL (library asset) */
  onLoadModel?: (url: string) => void;
  /** Called when user saves a plan */
  onSavePlan?: (plan: Record<string, unknown>, name: string) => Promise<void>;
  selectedSceneObjectId?: string | null;
  onSelectSceneObjectId?: (id: string | null) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  "Family office HQ",
  "Conference room 10x8",
  "Vault room",
  "Podium",
];

export function ParametricBuilderPanel({
  onGenerateFromPlan,
  onLoadModel,
  onSavePlan,
  selectedSceneObjectId = null,
  onSelectSceneObjectId,
  disabled,
}: ParametricBuilderPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastPlan, setLastPlan] = useState<Record<string, unknown> | null>(null);
  const [lastPlanMeta, setLastPlanMeta] = useState<PlanMeta | null>(null);
  const [lastAssumptions, setLastAssumptions] = useState<string[]>([]);
  const [suggestedAsset, setSuggestedAsset] = useState<SuggestedAssetPayload | null>(null);
  const [suggestedObject, setSuggestedObject] = useState<SuggestedObjectPayload | null>(null);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [allowCatalogFallback, setAllowCatalogFallback] = useState(false);
  const [plansRefreshKey, setPlansRefreshKey] = useState(0);

  const handleSubmit = async () => {
    const text = prompt.trim();
    if (!text || busy || disabled) return;
    setBusy(true);
    try {
      const res = await fetch("/api/modeling/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text, allowCatalogFallback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");
      if (data.plan && typeof data.plan === "object") {
        setLastPlan(data.plan);
        setLastPlanMeta(null);
        setLastAssumptions(Array.isArray(data.assumptions) ? data.assumptions : []);
        setSuggestedAsset(
          data.suggestedAsset && typeof data.suggestedAsset === "object"
            ? (data.suggestedAsset as SuggestedAssetPayload)
            : null
        );
        setSuggestedObject(
          data.suggestedObject && typeof data.suggestedObject === "object"
            ? (data.suggestedObject as SuggestedObjectPayload)
            : null
        );
        onGenerateFromPlan(data.plan);
      } else {
        setSuggestedAsset(null);
        setSuggestedObject(null);
      }
      if (data.modelUrl && typeof data.modelUrl === "string" && onLoadModel) {
        onLoadModel(data.modelUrl);
      }
      if (data.suggestedAsset && typeof data.suggestedAsset === "object" && onLoadModel) {
        const sa = data.suggestedAsset as SuggestedAssetPayload;
        const uri = sa.modelUrl ?? sa.assetUri;
        if (uri) onLoadModel(uri.startsWith("ipfs://") ? uri.replace("ipfs://", "https://nftstorage.link/ipfs/") : uri);
      }
      if (!data.plan && !data.modelUrl) {
        setLastPlan(null);
        setLastPlanMeta(null);
        setSuggestedAsset(null);
        setSuggestedObject(null);
        setLastAssumptions([data.message ?? "No model produced."]);
      }
    } catch (err) {
      setLastPlan(null);
      setLastPlanMeta(null);
      setSuggestedAsset(null);
      setSuggestedObject(null);
      setLastAssumptions([err instanceof Error ? err.message : "Failed"]);
    } finally {
      setBusy(false);
    }
  };

  const buildDefaultPlanForKind = (kind: NonNullable<SuggestedObjectPayload["kind"]>) => {
    switch (kind) {
      case "podium":
        return { version: 1, kind: "podium", w: 0.6, d: 0.4, h: 1.1, hasPlaque: true, style: "classic" };
      case "vault_room":
        return { version: 1, kind: "vault_room", w: 4, d: 4, h: 3, wallThickness: 0.4, hasTable: true, style: "classic" };
      case "conference_room":
        return { version: 1, kind: "conference_room", w: 6, d: 5, h: 3, tableSeats: 8, style: "modern" };
      case "office_hq":
        return { version: 1, kind: "office_hq", floors: 1, footprint: { w: 12, d: 10 }, rooms: ["reception", "conference"], style: "modern" };
      case "room":
      default:
        return { version: 1, kind: "room", w: 8, d: 6, h: 3, doors: 1, windows: 2, style: "modern" };
    }
  };

  const composeWithSuggestedObject = () => {
    if (!lastPlan || !suggestedObject?.kind) return;
    const base = lastPlan as Record<string, unknown>;
    const nextObject = buildDefaultPlanForKind(suggestedObject.kind);
    const baseIsScene = (base.kind as string | undefined) === "scene" && Array.isArray((base as { objects?: unknown[] }).objects);
    const existingObjects = baseIsScene
      ? ([...(base as { objects: unknown[] }).objects] as Array<Record<string, unknown>>)
      : [{ id: "primary", label: "Primary", locked: true, plan: base }];
    const scenePlan = normalizeScene({
      version: 1,
      kind: "scene",
      seed: Number((base as { seed?: number }).seed ?? 0) || 0,
      objects: [
        ...existingObjects,
        {
          id: `addon_${suggestedObject.kind}_${Date.now()}`,
          label: `Add-on ${suggestedObject.kind.replace("_", " ")}`,
          locked: false,
          plan: nextObject,
          placement: suggestedObject.placement ?? { mode: "auto", anchor: "near_wall" },
        },
      ],
    } as ScenePlan);
    setLastPlan(scenePlan);
    setLastPlanMeta(null);
    onSelectSceneObjectId?.(null);
    onGenerateFromPlan(scenePlan);
  };

  return (
    <div className="border-b border-white/10 pb-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-400" />
        Parametric Builder
      </h3>
      <p className="text-xs text-slate-500 mb-2">
        Prompt → Plan → Build. Rooms, offices, podiums, vaults.
      </p>
      <label className="flex items-center gap-2 mb-2 text-xs text-slate-500 cursor-pointer">
        <input
          type="checkbox"
          checked={allowCatalogFallback}
          onChange={(e) => setAllowCatalogFallback(e.target.checked)}
          className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
        />
        Enable Asset Catalog (optional)
      </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="e.g. Conference room 12x10"
        className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none h-16"
        disabled={disabled}
      />
      <Button
        onClick={handleSubmit}
        disabled={!prompt.trim() || busy || disabled}
        size="sm"
        className="w-full mt-2 bg-amber-600 hover:bg-amber-700 text-white"
      >
        {busy ? "Generating…" : "Generate"}
      </Button>
      <div className="flex flex-wrap gap-1 mt-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setPrompt(s)}
            disabled={disabled}
            className="rounded px-2 py-1 text-xs bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700"
          >
            {s}
          </button>
        ))}
      </div>
      {lastAssumptions.length > 0 && (
        <div className="mt-2 px-2 py-1.5 rounded bg-slate-800/60 border border-slate-700/50">
          <p className="text-xs text-slate-400">{lastAssumptions.join(" ")}</p>
        </div>
      )}
      {suggestedAsset && (suggestedAsset.modelUrl || suggestedAsset.assetUri) && onLoadModel && (
        <div className="mt-2">
          <button
            onClick={() => {
              const uri = suggestedAsset.modelUrl ?? suggestedAsset.assetUri!;
              onLoadModel(uri.startsWith("ipfs://") ? uri.replace("ipfs://", "https://nftstorage.link/ipfs/") : uri);
            }}
            disabled={disabled}
            className="rounded-lg px-3 py-1.5 text-xs bg-amber-600/30 border border-amber-500/50 text-amber-200 hover:bg-amber-600/50"
          >
            {suggestedAsset.label ?? "Add suggested asset"}
          </button>
        </div>
      )}
      {suggestedObject?.kind && lastPlan && (
        <div className="mt-2">
          <button
            onClick={composeWithSuggestedObject}
            disabled={disabled}
            className="rounded-lg px-3 py-1.5 text-xs bg-cyan-600/25 border border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/45"
          >
            {suggestedObject.label ?? `Add ${suggestedObject.kind.replace("_", " ")} (auto-place)`}
          </button>
        </div>
      )}
      {isScenePlan(lastPlan) && (
        <SceneInspectorPanel
          scenePlan={normalizeScene(lastPlan)}
          selectedSceneObjectId={selectedSceneObjectId}
          onSelectSceneObjectId={onSelectSceneObjectId}
          disabled={disabled}
          onUpdateScenePlan={(next) => {
            const normalized = normalizeScene(next);
            setLastPlan(normalized);
            setLastPlanMeta(null);
            if (
              selectedSceneObjectId &&
              !normalized.objects.some((o) => o.id === selectedSceneObjectId)
            ) {
              onSelectSceneObjectId?.(null);
            }
            onGenerateFromPlan(normalized);
          }}
        />
      )}
      {lastPlan && (
        <div className="mt-2 space-y-1">
          {lastPlan && Object.keys(lastPlan).length > 0 && (
            <div className="mt-1">
              <button
                onClick={() => setPlanExpanded(!planExpanded)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
              >
                {planExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Plan
              </button>
              {planExpanded && (
                <div className="mt-1 space-y-1">
                  {lastPlanMeta && (lastPlanMeta.planHash || lastPlanMeta.planVersion != null || lastPlanMeta.seed != null) && (
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                      {lastPlanMeta?.planVersion != null && (
                        <span>v{lastPlanMeta.planVersion}</span>
                      )}
                      {lastPlanMeta?.seed != null && (
                        <span>seed: {lastPlanMeta.seed}</span>
                      )}
                      {lastPlanMeta?.planHash && (
                        <span className="flex items-center gap-1">
                          <code className="truncate max-w-[120px]" title={lastPlanMeta.planHash}>
                            {lastPlanMeta.planHash.slice(0, 12)}…
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(lastPlanMeta.planHash!);
                              toast.success("Hash copied");
                            }}
                            className="rounded p-0.5 hover:bg-slate-700"
                            title="Copy hash"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                  <pre className="p-2 rounded bg-slate-900/80 text-[10px] text-slate-400 overflow-x-auto">
                    {JSON.stringify(lastPlan, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {lastPlan && onSavePlan && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Plan name"
            className="flex-1 rounded px-2 py-1 text-xs bg-slate-800/80 border border-slate-700 text-slate-200 placeholder:text-slate-500"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!saveName.trim() || saving || disabled}
            onClick={async () => {
              if (!saveName.trim() || !lastPlan) return;
              setSaving(true);
              try {
                await onSavePlan(lastPlan, saveName.trim());
                setSaveName("");
                setPlansRefreshKey((k) => k + 1);
              } finally {
                setSaving(false);
              }
            }}
            className="shrink-0 text-xs"
          >
            {saving ? "…" : "Save"}
          </Button>
        </div>
      )}
      <PlanLibrary
        onLoadPlan={(planJson, meta) => {
          setLastPlan(planJson);
          setLastPlanMeta(meta ?? null);
          onSelectSceneObjectId?.(null);
          onGenerateFromPlan(planJson);
        }}
        onSavePlan={onSavePlan}
        disabled={disabled}
        refreshKey={plansRefreshKey}
      />
    </div>
  );
}
