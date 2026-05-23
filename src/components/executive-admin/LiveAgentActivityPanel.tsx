"use client";

import { useCallback, useEffect, useState } from "react";
import type { AmbientExecutiveSignal } from "@/lib/executive-agent/executive-ambient-signal-types";

type AgentActivityRow = {
  id: string;
  label: string;
  icon: string;
  category: string;
  severity: string;
  occurredAt: string;
};

type OverviewResponse = {
  ok?: boolean;
  feed?: { events: AmbientExecutiveSignal[] };
  error?: string;
};

const AGENT_CATEGORIES = new Set([
  "jarva_activity",
  "reality_activity",
  "bentley_campaign",
  "smart_trust",
  "executive_inbox",
]);

export function LiveAgentActivityPanel() {
  const [rows, setRows] = useState<AgentActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/signals/overview?audit=0", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as OverviewResponse;
      if (r.ok && j.feed?.events) {
        const filtered = j.feed.events
          .filter((e) => AGENT_CATEGORIES.has(e.category))
          .slice(0, 10)
          .map((e) => ({
            id: e.id,
            label: e.entityLabel ?? e.summary.slice(0, 48),
            icon: e.entityIcon ?? "📡",
            category: e.category,
            severity: e.severity,
            occurredAt: e.occurredAt,
          }));
        setRows(filtered);
      } else setRows([]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 50_000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className="rounded-xl border border-violet-500/20 bg-[#000814]/65 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
        Live agent activity
      </p>
      {loading && !rows.length ? <p className="mt-2 text-xs text-slate-500">Scanning desks…</p> : null}
      {rows.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-[10px]">
              <span>{r.icon}</span>
              <span className="min-w-0 flex-1 truncate text-slate-300">{r.label}</span>
              <span className="text-[9px] uppercase text-slate-500">{r.severity}</span>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">No agent desk activity in current window.</p>
      ) : null}
    </div>
  );
}
