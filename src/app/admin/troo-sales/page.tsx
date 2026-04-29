// src/app/admin/troo-sales/page.tsx
"use client";

import { useEffect, useState } from "react";

type TrooSale = {
  id: number;
  txHash: string;
  buyerWallet: string | null;
  treasuryWallet: string | null;
  tokenAddress: string | null;
  amount: string | null;
  currency: string | null;
  elementId: number | null;
  elementName: string | null;
  assetUri: string | null;
  placementJson: string | null;
  chainId: number | null;
  createdAt: string;
};

export default function TrooSalesPage() {
  const [sales, setSales] = useState<TrooSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/oasis/troo-sales");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load sales");
        if (active) setSales(Array.isArray(data?.sales) ? data.sales : []);
      } catch (err: any) {
        if (active) setError(err?.message || "Failed to load sales");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 text-white">
      <div className="px-6 py-5 border-b border-cyan-500/30">
        <div className="text-xl font-bold">TROO Sells</div>
        <div className="text-xs text-slate-300 mt-1">OASIS element sales recorded from the world register.</div>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="text-slate-300">Loading…</div>
        ) : error ? (
          <div className="text-red-400">{error}</div>
        ) : sales.length === 0 ? (
          <div className="text-slate-300">No TROO sales recorded yet.</div>
        ) : (
          <div className="bg-black/50 rounded-lg border border-cyan-500/30 overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">Time</th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">Element</th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">Amount</th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">Buyer</th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">Tx</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-t border-slate-700">
                    <td className="px-4 py-3 text-sm text-slate-200">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-200">
                      <div className="font-semibold">{s.elementName || `Element #${s.elementId ?? "?"}`}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[360px]">
                        {s.assetUri || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-200">
                      {s.amount ?? "0"} {s.currency ?? "TROO"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{s.buyerWallet || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {s.txHash ? (
                        <a
                          href={`https://polygonscan.com/tx/${s.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-300 hover:underline"
                        >
                          {s.txHash.slice(0, 10)}…{s.txHash.slice(-6)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
