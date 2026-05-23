"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveAmbientSignalOverview } from "@/lib/executive-agent/executive-ambient-signal-types";
import { PRESENCE_MODE_LABEL } from "@/lib/executive-agent/operational-presence-state";

type OverviewResponse = {
  ok?: boolean;
  overview?: ExecutiveAmbientSignalOverview;
  error?: string;
};

type Props = {
  overview?: ExecutiveAmbientSignalOverview | null;
  loading?: boolean;
};

export function AmbientSignalPanel(props: Props = {}) {
  const { overview: externalOverview, loading: externalLoading } = props;
  const [overview, setOverview] = useState<ExecutiveAmbientSignalOverview | null>(externalOverview ?? null);
  const [loading, setLoading] = useState(externalLoading ?? !externalOverview);

  const load = useCallback(async () => {
    if (externalOverview) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/signals/overview?audit=0", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as OverviewResponse;
      if (r.ok && j.overview) setOverview(j.overview);
      else setOverview(null);
    } catch {
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [externalOverview]);

  useEffect(() => {
    if (externalOverview) {
      setOverview(externalOverview);
      setLoading(Boolean(externalLoading));
      return;
    }
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load, externalOverview, externalLoading]);

  if (loading && !overview) {
    return (
      <div className="rounded-xl border border-[#00A3FF]/15 bg-[#000814]/60 p-3 text-xs text-slate-500">
        Aggregating ambient signals…
      </div>
    );
  }
  if (!overview) return null;

  const modeLabel = PRESENCE_MODE_LABEL[overview.presenceMode] ?? overview.presenceMode;

  return (
    <div className="rounded-xl border border-[#00A3FF]/20 bg-[#000814]/70 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00A3FF]/85">
        Ambient signal intelligence
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        <span className="rounded-full border border-[#00A3FF]/30 px-2 py-0.5 text-[#00A3FF]">
          {modeLabel} mode
        </span>
        <span className="rounded-full border border-slate-600/40 px-2 py-0.5 text-slate-400">
          {overview.signalCount} signals
        </span>
        {overview.criticalCount > 0 ? (
          <span className="rounded-full border border-rose-500/40 px-2 py-0.5 text-rose-200">
            {overview.criticalCount} critical
          </span>
        ) : null}
        {overview.interruptionCount > 0 ? (
          <span className="rounded-full border border-amber-400/35 px-2 py-0.5 text-amber-100">
            {overview.interruptionCount} interruptions
          </span>
        ) : null}
      </div>
      {overview.topNarration ? (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{overview.topNarration}</p>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">Operational posture is steady — monitoring continues.</p>
      )}
      <p className="mt-2 text-[9px] text-slate-600">Advisory only · no auto-contact · no auto-decision</p>
    </div>
  );
}
