"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, RefreshCw, Tag } from "lucide-react";

type LeadPriority = {
  closeLikelihood: number;
  urgency: number;
  tier: "high" | "medium" | "low";
  followUpNeeded: boolean;
  reasons: string[];
};

type TrackedLead = {
  id: string;
  platform: string;
  handle: string;
  comment: string;
  painType: string;
  intentScore: string;
  status: string;
  source: string;
  leadRecordId: string | null;
  contentDeploymentId: string | null;
  priority?: LeadPriority;
};

const STATUS_OPTIONS = ["new", "contacted", "booked", "closed", "lost"] as const;

export function TrackedLeadsPanel() {
  const [leads, setLeads] = useState<TrackedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/bentley-social-leads/tracked-leads?includePriority=1", {
        credentials: "include",
      });
      if (r.status === 401) {
        setLeads([]);
        return;
      }
      const data = (await r.json()) as { leads?: TrackedLead[]; error?: string };
      if (!r.ok) throw new Error(data?.error ?? "Failed");
      setLeads(data.leads ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStatus(id: string, status: string) {
    try {
      const r = await fetch(`/api/bentley-social-leads/tracked-leads/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Update failed");
      void load();
    } catch {
      setErr("Could not update status");
    }
  }

  return (
    <div className="rounded-2xl border border-violet-500/35 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-violet-300" />
          <h3 className="text-lg font-semibold text-white">Leads (tracked)</h3>
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
        Lightweight lifecycle list — updated when engagement batches finish classification, or add rows via API. Priority
        uses conversion baselines + intent + age (explainable heuristics).
      </p>
      {err ? <p className="text-xs text-rose-400 mb-2">{err}</p> : null}
      {loading && leads.length === 0 ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-slate-500">No tracked leads yet. Ingest engagement CSV and run analysis, or POST a manual lead.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase text-slate-500">
                <th className="py-2 pr-2">Platform</th>
                <th className="py-2 pr-2">Handle</th>
                <th className="py-2 pr-2">Comment</th>
                <th className="py-2 pr-2">Pain</th>
                <th className="py-2 pr-2">Intent</th>
                <th className="py-2 pr-2">Source</th>
                <th className="py-2 pr-2">Priority</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-white/5 align-top ${
                    row.priority?.tier === "high" ? "bg-amber-500/5" : ""
                  }`}
                >
                  <td className="py-2 pr-2 font-mono text-xs">{row.platform}</td>
                  <td className="py-2 pr-2 font-mono text-xs">@{row.handle}</td>
                  <td className="py-2 pr-2 max-w-[220px] text-xs text-slate-400 line-clamp-3">{row.comment}</td>
                  <td className="py-2 pr-2 text-xs">{row.painType || "—"}</td>
                  <td className="py-2 pr-2 text-xs">{row.intentScore}</td>
                  <td className="py-2 pr-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                        row.source === "engagement"
                          ? "border-amber-500/50 text-amber-200 bg-amber-950/40"
                          : "border-slate-600 text-slate-400"
                      }`}
                    >
                      <Tag className="w-3 h-3" />
                      {row.source === "engagement" ? "Captured from engagement" : row.source}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    {row.priority ? (
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit text-[10px] px-2 py-0.5 rounded-md border ${
                            row.priority.tier === "high"
                              ? "border-amber-500/50 text-amber-200 bg-amber-950/50"
                              : row.priority.tier === "medium"
                                ? "border-slate-500/50 text-slate-300 bg-slate-900/60"
                                : "border-white/10 text-slate-500"
                          }`}
                          title={[...row.priority.reasons].join(" · ")}
                        >
                          {row.priority.tier} · pClose {(row.priority.closeLikelihood * 100).toFixed(0)}%
                        </span>
                        {row.priority.followUpNeeded ? (
                          <span className="text-[10px] text-rose-300/90">Follow-up</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    <select
                      value={row.status}
                      onChange={(e) => void patchStatus(row.id, e.target.value)}
                      className="bg-black/50 border border-white/15 rounded px-2 py-1 text-xs text-white"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-slate-600 mt-4">
        Link to SLI record when <span className="font-mono">leadRecordId</span> is set — open Social Lead Intelligence to
        review full analysis.
      </p>
    </div>
  );
}
