"use client";

import { useEffect, useState } from "react";

const GOLD = "#D4AF37";

export type Snapshot = {
  id: string;
  month: string;
  traffic: number;
  conversionRatePct: number;
  avgOrderValue: number;
  revenue: number;
  cac: number;
  ltv: number;
};

export function SnapshotHistory({
  userId,
  clientId = "",
  trustId = "",
  refreshKey = 0,
  snapshots: externalSnapshots,
}: {
  userId: string;
  clientId?: string;
  trustId?: string;
  refreshKey?: number;
  snapshots?: Snapshot[];
}) {
  const [internalSnapshots, setInternalSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const useExternal = externalSnapshots != null;

  useEffect(() => {
    if (useExternal) return;
    let ignore = false;
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ userId, limit: "12" });
        if (clientId) params.set("clientId", clientId);
        if (trustId) params.set("trustId", trustId);
        const r = await fetch(
          `/api/revenue-os/snapshots?${params.toString()}`
        );
        const j = await r.json();
        if (!ignore && r.ok) setInternalSnapshots(j.snapshots ?? []);
      } catch {
        if (!ignore) setInternalSnapshots([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [userId, clientId, trustId, refreshKey, useExternal]);

  const snapshots = useExternal ? externalSnapshots! : internalSnapshots;
  const isLoading = useExternal ? false : loading;

  if (isLoading) return null;
  if (snapshots.length === 0) return null;

  const money = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="rounded-2xl border border-[#D4AF37]/50 bg-black/50 p-6">
      <div className="text-sm text-gray-400 mb-2">Performance Memory</div>
      <div className="text-lg font-semibold" style={{ color: GOLD }}>
        Snapshot History
      </div>
      <p className="text-gray-500 text-xs mt-1">
        Month-over-month KPI tracking. Save snapshots after each Run Analysis.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-[#D4AF37]/30">
              <th className="py-2 pr-4">Month</th>
              <th className="py-2 pr-4">Revenue</th>
              <th className="py-2 pr-4">Conv %</th>
              <th className="py-2 pr-4">AOV</th>
              <th className="py-2 pr-4">CAC</th>
              <th className="py-2">Traffic</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id} className="border-b border-white/5">
                <td className="py-2 pr-4 font-medium text-gray-200">{s.month}</td>
                <td className="py-2 pr-4" style={{ color: GOLD }}>{money(s.revenue)}</td>
                <td className="py-2 pr-4 text-gray-300">{s.conversionRatePct.toFixed(2)}%</td>
                <td className="py-2 pr-4 text-gray-300">{money(s.avgOrderValue)}</td>
                <td className="py-2 pr-4 text-gray-300">{money(s.cac)}</td>
                <td className="py-2 text-gray-300">{s.traffic.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
