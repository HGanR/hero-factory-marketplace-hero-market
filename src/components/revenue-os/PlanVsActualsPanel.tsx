"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChannelComparisonRow } from "@/lib/revenue-os/capital-plan-vs-actuals";

const ACCENT = "#00D1FF";

type PlanVsActualsResponse = {
  month: string;
  comparison: ChannelComparisonRow[];
  activePlan: { id: string; snapshotMonth: string | null; adSpend: number } | null;
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function statusColor(row: ChannelComparisonRow): string {
  if (row.performanceStatus === "underperforming") return "#f97316";
  if (row.spendStatus === "overspend") return "#ef4444";
  if (row.spendStatus === "underspend") return "#eab308";
  return "#94a3b8";
}

/**
 * Plan vs channel spend actuals — highlights overspend, underspend, and weak ROAS channels.
 */
export function PlanVsActualsPanel({
  userId,
  clientId,
  trustId,
  profileId,
  refreshKey,
}: {
  userId: string;
  clientId: string;
  trustId: string;
  profileId?: string | null;
  refreshKey?: number;
}) {
  const [data, setData] = useState<PlanVsActualsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [paid, setPaid] = useState("");
  const [organic, setOrganic] = useState("");
  const [referral, setReferral] = useState("");
  const [revPaid, setRevPaid] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const p = new URLSearchParams({ userId, month });
      if (clientId) p.set("clientId", clientId);
      if (trustId) p.set("trustId", trustId);
      const r = await fetch(`/api/revenue-os/capital/plan-vs-actuals?${p.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to load");
      setData({
        month: j.month,
        comparison: j.comparison ?? [],
        activePlan: j.activePlan ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, clientId, trustId, month]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function saveActuals() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const rows: { channel: string; spend: number; revenueAttributed?: number }[] = [];
      const p = parseFloat(paid);
      const o = parseFloat(organic);
      const r = parseFloat(referral);
      const rp = parseFloat(revPaid);
      if (!Number.isNaN(p) && p >= 0) rows.push({ channel: "paid", spend: p });
      if (!Number.isNaN(o) && o >= 0) rows.push({ channel: "organic", spend: o });
      if (!Number.isNaN(r) && r >= 0) rows.push({ channel: "referral", spend: r });
      if (rows.length === 0) {
        setSaveMsg("Enter at least one channel spend.");
        return;
      }
      if (!Number.isNaN(rp) && rp >= 0) {
        const paidRow = rows.find((x) => x.channel === "paid");
        if (paidRow) paidRow.revenueAttributed = rp;
      }

      const r2 = await fetch("/api/revenue-os/capital/channel-spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          clientId: clientId || undefined,
          trustId: trustId || undefined,
          profileId: profileId || undefined,
          month,
          rows,
        }),
      });
      const j = await r2.json();
      if (!r2.ok) throw new Error(j.error ?? "Save failed");
      setSaveMsg("Actuals saved.");
      await load();
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-cyan-500/60 bg-slate-800/50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-400">Capital allocation</div>
          <div className="text-xl font-semibold" style={{ color: ACCENT }}>
            Plan vs actuals
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Planned spend comes from the latest capital plan (saved when you run analysis). Enter actual
            channel spend to compare — overspend/underspend vs plan and low ROAS are highlighted.
          </p>
        </div>
        <label className="text-xs text-gray-500 flex flex-col gap-1">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-black/40 border border-cyan-500/40 rounded-lg px-2 py-1 text-sm text-white"
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 text-sm text-amber-400" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          {data?.activePlan && (
            <p className="mt-3 text-xs text-gray-500">
              Active plan total ad budget: {money(data.activePlan.adSpend)}
              {data.activePlan.snapshotMonth ? ` · snapshot ${data.activePlan.snapshotMonth}` : ""}
            </p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 border-b border-cyan-500/20">
                  <th className="py-2 pr-3">Channel</th>
                  <th className="py-2 pr-3">Planned</th>
                  <th className="py-2 pr-3">Actual</th>
                  <th className="py-2 pr-3">Δ vs plan</th>
                  <th className="py-2 pr-3">ROAS</th>
                  <th className="py-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {(data?.comparison ?? []).map((row) => (
                  <tr key={row.channel} className="border-b border-white/5">
                    <td className="py-2 pr-3 font-medium text-gray-200">{row.channel}</td>
                    <td className="py-2 pr-3 text-gray-400">{money(row.plannedSpend)}</td>
                    <td className="py-2 pr-3 text-gray-300">{money(row.actualSpend)}</td>
                    <td className="py-2 pr-3" style={{ color: statusColor(row) }}>
                      {(row.varianceVsPlan * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 pr-3 text-gray-400">
                      {row.roas != null ? row.roas.toFixed(2) : "—"}
                    </td>
                    <td className="py-2 text-xs">
                      {row.spendStatus !== "on_plan" && (
                        <span className="mr-2 text-amber-400/90">{row.spendStatus}</span>
                      )}
                      {row.performanceStatus === "underperforming" && (
                        <span className="text-orange-400">underperforming</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 border-t border-cyan-500/20 pt-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Record actual spend ({month})
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <label className="text-gray-500">
                Paid
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                  className="mt-1 w-full bg-black/40 border border-cyan-500/40 rounded-lg px-2 py-1 text-white"
                  placeholder="0"
                />
              </label>
              <label className="text-gray-500">
                Organic
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={organic}
                  onChange={(e) => setOrganic(e.target.value)}
                  className="mt-1 w-full bg-black/40 border border-cyan-500/40 rounded-lg px-2 py-1 text-white"
                  placeholder="0"
                />
              </label>
              <label className="text-gray-500">
                Referral
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={referral}
                  onChange={(e) => setReferral(e.target.value)}
                  className="mt-1 w-full bg-black/40 border border-cyan-500/40 rounded-lg px-2 py-1 text-white"
                  placeholder="0"
                />
              </label>
              <label className="text-gray-500">
                Revenue (paid, optional)
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={revPaid}
                  onChange={(e) => setRevPaid(e.target.value)}
                  className="mt-1 w-full bg-black/40 border border-cyan-500/40 rounded-lg px-2 py-1 text-white"
                  placeholder="0"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void saveActuals()}
              disabled={saving}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-black disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {saving ? "Saving…" : "Save channel actuals"}
            </button>
            {saveMsg && (
              <p
                className={`mt-2 text-xs ${saveMsg.includes("saved") || saveMsg.includes("Actuals") ? "text-green-400" : "text-amber-400"}`}
              >
                {saveMsg}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
