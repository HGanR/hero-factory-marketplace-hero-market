"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, RefreshCw, GitCompare, BarChart2 } from "lucide-react";

type VariantRow = {
  id: string;
  experimentGroupId: string;
  variantTag: string;
  engineKind: string;
  title: string;
  createdAt: string | null;
};

type Rollup = {
  variantId: string;
  variantTag: string;
  deploymentIds: string[];
  trackedLeadCount: number;
  bookedOrClosed: number;
  closedCount: number;
  estimatedPipeline: number;
  closedRevenue: number;
};

export function PastGenerationsPanel() {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [compareGroup, setCompareGroup] = useState<string | null>(null);
  const [rollups, setRollups] = useState<Rollup[]>([]);
  const [loadingRollup, setLoadingRollup] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/bentley-social-leads/generation-variants?limit=80", { credentials: "include" });
      if (r.status === 401) {
        setVariants([]);
        return;
      }
      const data = (await r.json()) as { variants?: VariantRow[]; error?: string };
      if (!r.ok) throw new Error(data?.error ?? "Failed");
      setVariants(data.variants ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const m = new Map<string, VariantRow[]>();
    for (const v of variants) {
      const g = v.experimentGroupId;
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(v);
    }
    return Array.from(m.entries()).sort((a, b) => {
      const ta = a[1][0]?.createdAt ?? "";
      const tb = b[1][0]?.createdAt ?? "";
      return tb.localeCompare(ta);
    });
  }, [variants]);

  async function loadRollups(groupId: string) {
    setLoadingRollup(true);
    setCompareGroup(groupId);
    try {
      const r = await fetch(
        `/api/bentley-social-leads/generation-variants/analytics?experimentGroupId=${encodeURIComponent(groupId)}`,
        { credentials: "include" }
      );
      const data = (await r.json()) as { rollups?: Rollup[] };
      if (!r.ok) throw new Error("Analytics failed");
      setRollups(data.rollups ?? []);
    } catch {
      setRollups([]);
    } finally {
      setLoadingRollup(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-500/35 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-300" />
          <h3 className="text-lg font-semibold text-white">Past generations</h3>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs inline-flex items-center gap-1 text-slate-400 hover:text-white"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        Saved Content Engine outputs with unified context snapshots. Link deployments to a variant to trace leads →
        outcomes. Compare A/B/C rollups per experiment group.
      </p>

      {err ? <p className="text-xs text-rose-400 mb-2">{err}</p> : null}

      {loading && variants.length === 0 ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate-500">No saved generations yet. Use “Save to memory” after Content Engine runs.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([groupId, rows]) => (
            <div key={groupId} className="rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-xs font-mono text-slate-500 truncate max-w-[90%]" title={groupId}>
                  Experiment · {groupId.slice(0, 10)}…
                </p>
                <button
                  type="button"
                  onClick={() => void loadRollups(groupId)}
                  className="text-[10px] uppercase tracking-wider inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                >
                  <GitCompare className="w-3 h-3" />
                  Compare outcomes
                </button>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                {rows
                  .sort((a, b) => a.variantTag.localeCompare(b.variantTag))
                  .map((v) => (
                    <li key={v.id} className="flex flex-wrap gap-2">
                      <span className="font-mono text-cyan-300/90">[{v.variantTag}]</span>
                      <span className="text-slate-500 text-xs">{v.engineKind}</span>
                      <span className="truncate">{v.title || "Untitled"}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}

          {compareGroup ? (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4">
              <div className="flex items-center gap-2 text-cyan-200 text-xs font-semibold uppercase tracking-wider mb-2">
                <BarChart2 className="w-4 h-4" />
                Variant performance (deployments → leads)
                {loadingRollup ? <span className="text-slate-500">…</span> : null}
              </div>
              {rollups.length === 0 && !loadingRollup ? (
                <p className="text-xs text-slate-500">No deployments linked to these variants yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead>
                      <tr className="text-[10px] text-slate-500 border-b border-white/10">
                        <th className="py-1 pr-2">Tag</th>
                        <th className="py-1 pr-2">Leads</th>
                        <th className="py-1 pr-2">Booked+</th>
                        <th className="py-1 pr-2">Closed</th>
                        <th className="py-1">Pipeline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rollups.map((r) => (
                        <tr key={r.variantId} className="border-b border-white/5">
                          <td className="py-1 pr-2 font-mono">{r.variantTag}</td>
                          <td className="py-1 pr-2">{r.trackedLeadCount}</td>
                          <td className="py-1 pr-2">{r.bookedOrClosed}</td>
                          <td className="py-1 pr-2">{r.closedCount}</td>
                          <td className="py-1">
                            ${r.estimatedPipeline.toFixed(0)} / ${r.closedRevenue.toFixed(0)} closed
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
