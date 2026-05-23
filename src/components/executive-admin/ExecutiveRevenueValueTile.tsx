"use client";

import {
  computeExecutiveRevenueValue,
  formatExecutiveCurrency,
} from "@/lib/executive-agent/executive-revenue-value";

type Props = {
  pendingAccounts: number | null | undefined;
  approvedAccounts: number | null | undefined;
  unavailable?: boolean;
  loading?: boolean;
};

function MetricRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[#00A3FF]/20 bg-[#00050A]/70 px-3 py-3 backdrop-blur-sm">
      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#00A3FF]/70">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-white drop-shadow-[0_0_12px_rgba(0,163,255,0.35)]">
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function ExecutiveRevenueValueTile({
  pendingAccounts,
  approvedAccounts,
  unavailable,
  loading,
}: Props) {
  const snap = computeExecutiveRevenueValue({ pendingAccounts, approvedAccounts, unavailable });

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#00A3FF]/30 bg-[#000814]/85 p-4 shadow-[0_0_32px_rgba(0,163,255,0.12),inset_0_0_24px_rgba(0,163,255,0.06)] backdrop-blur-md">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#00A3FF]/10 blur-3xl" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#00A3FF]/90">
          Executive revenue value
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Derived from live account counts · $155 setup · $20 MRR per approved account
        </p>
        {loading ? (
          <p className="mt-4 text-xs text-slate-500">Loading account metrics…</p>
        ) : snap.unavailable ? (
          <p className="mt-4 text-xs text-slate-500">Account counts unavailable</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <MetricRow
              label="Potential earnings"
              value={formatExecutiveCurrency(snap.potentialEarnings)}
              sub={`${snap.pendingAccounts} pending account${snap.pendingAccounts === 1 ? "" : "s"}`}
            />
            <MetricRow
              label="Approved account value"
              value={formatExecutiveCurrency(snap.approvedAccountValue)}
              sub={`${snap.approvedAccounts} approved active`}
            />
            <MetricRow
              label="Monthly recurring revenue"
              value={formatExecutiveCurrency(snap.monthlyRecurringRevenue)}
              sub="Approved × $20 MRR"
            />
          </div>
        )}
      </div>
    </div>
  );
}
