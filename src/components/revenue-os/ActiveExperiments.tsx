"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

const ACCENT = "#00D1FF";

type CreateMetrics = {
  traffic: number;
  conversionRatePct: number;
  avgOrderValue: number;
  cac: number;
  revenue: number;
};

type Experiment = {
  id: string;
  name: string;
  lever: string;
  hypothesis: string | null;
  status: string;
  winnerVariantId?: string | null;
  startedAt: string;
  endedAt: string | null;
};

export function ActiveExperiments({
  userId,
  clientId = "",
  trustId = "",
  createWithMetrics,
  onExperimentEnded,
}: {
  userId: string;
  clientId?: string;
  trustId?: string;
  createWithMetrics?: CreateMetrics;
  onExperimentEnded?: () => void;
}) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createLever, setCreateLever] = useState<"conversion" | "aov" | "traffic" | "cac">("conversion");
  const [applyingOfferId, setApplyingOfferId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ userId });
        if (clientId) params.set("clientId", clientId);
        if (trustId) params.set("trustId", trustId);
        const r = await fetch(`/api/revenue-os/experiments?${params.toString()}`);
        const j = await r.json();
        if (!ignore && r.ok) setExperiments(j.experiments ?? []);
      } catch {
        if (!ignore) setExperiments([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [userId, clientId, trustId]);

  const active = experiments.filter((e) => e.status === "ACTIVE");
  const recent = experiments.filter((e) => e.status !== "ACTIVE").slice(0, 5);

  const createExperiment = async () => {
    if (!createName.trim()) {
      toast.error("Enter experiment name");
      return;
    }
    setCreating(true);
    try {
      const r = await fetch("/api/revenue-os/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          clientId,
          trustId,
          name: createName.trim(),
          lever: createLever,
          inputSnapshot: createWithMetrics ?? undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? "Create failed");
      toast.success("Experiment created");
      setCreateName("");
      setExperiments((prev) => [
        {
          id: j.id,
          name: createName.trim(),
          lever: createLever,
          hypothesis: null,
          status: "ACTIVE",
          startedAt: new Date().toISOString(),
          endedAt: null,
        },
        ...prev,
      ]);
      onExperimentEnded?.();
    } catch {
      toast.error("Failed to create experiment");
    } finally {
      setCreating(false);
    }
  };

  const markResult = async (id: string, status: "WON" | "LOST") => {
    try {
      const r = await fetch(`/api/revenue-os/experiments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Update failed");
      toast.success(`Experiment marked as ${status}`);
      setExperiments((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status } : e))
      );
      onExperimentEnded?.();
    } catch {
      toast.error("Failed to update experiment");
    }
  };

  const applyWinnerToOffer = async (experimentId: string) => {
    setApplyingOfferId(experimentId);
    try {
      const r = await fetch(
        `/api/revenue-os/experiments/${experimentId}/apply-winner-to-offer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            clientId,
            trustId,
            confirm: true,
          }),
        }
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? "Apply failed");
      toast.success(`Offer v${j.version} created from experiment winner`);
      onExperimentEnded?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply winner");
    } finally {
      setApplyingOfferId(null);
    }
  };

  if (loading) return null;
  if (active.length === 0 && recent.length === 0) return null;

  return (
    <div className="rounded-2xl border border-cyan-500/50 bg-slate-800/50 p-6">
      <div className="text-sm text-gray-400 mb-2">Performance Memory</div>
      <div className="text-lg font-semibold" style={{ color: ACCENT }}>
        Active Experiments
      </div>
      <p className="text-gray-500 text-xs mt-1">
        Track experiments with win/loss results.
      </p>

      {createWithMetrics && (
        <div className="mt-4 p-4 rounded-xl border border-cyan-500/40 bg-black/40">
          <div className="text-xs text-gray-400 mb-2">Create Experiment</div>
          <input
            type="text"
            placeholder="e.g. New checkout flow"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            className="w-full p-2 rounded-lg bg-black/50 border border-cyan-500/40 text-white text-sm mb-2 placeholder-gray-600"
          />
          <select
            value={createLever}
            onChange={(e) => setCreateLever(e.target.value as typeof createLever)}
            className="w-full p-2 rounded-lg bg-black/50 border border-cyan-500/40 text-white text-sm mb-2"
          >
            <option value="conversion">Conversion</option>
            <option value="aov">AOV</option>
            <option value="traffic">Traffic</option>
            <option value="cac">CAC</option>
          </select>
          <button
            onClick={createExperiment}
            disabled={creating || !createName.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Start Experiment"}
          </button>
        </div>
      )}

      {active.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="text-xs text-gray-400 uppercase">Active</div>
          {active.map((e) => (
            <div
              key={e.id}
              className="rounded-xl border border-cyan-500/40 bg-black/40 p-4"
            >
              <div className="font-medium text-gray-200">{e.name}</div>
              <div className="text-xs text-gray-500 mt-1">
                Lever: {e.lever} • Started {new Date(e.startedAt).toLocaleDateString()}
              </div>
              {e.hypothesis && (
                <div className="text-xs text-gray-400 mt-2">{e.hypothesis}</div>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => markResult(e.id, "WON")}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-green-500/30"
                >
                  Mark Won
                </button>
                <button
                  onClick={() => markResult(e.id, "LOST")}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                >
                  Mark Lost
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="text-xs text-gray-400 uppercase">Recent</div>
          <div className="space-y-2">
            {recent.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-300 truncate">{e.name}</span>
                  <span
                    className={`ml-2 shrink-0 text-xs font-medium ${
                      e.status === "WON"
                        ? "text-green-400"
                        : e.status === "LOST"
                          ? "text-red-400"
                          : "text-gray-500"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>
                {e.status === "WON" && e.winnerVariantId ? (
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => applyWinnerToOffer(e.id)}
                      disabled={applyingOfferId === e.id}
                      className="self-start px-2 py-1 rounded-md text-xs font-medium border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
                    >
                      {applyingOfferId === e.id
                        ? "Applying…"
                        : "Apply winner to offer ladder"}
                    </button>
                    <p className="text-[10px] text-gray-600 max-w-sm">
                      Committed change: creates a new offer version with audit. Provenance shows under
                      Offer Ladder (persisted provenance).
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
