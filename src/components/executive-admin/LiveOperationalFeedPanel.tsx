"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveCommandOverviewDto } from "@/lib/executive-agent/executive-command-types";

export function LiveOperationalFeedPanel() {
  const [data, setData] = useState<ExecutiveCommandOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/command/overview", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveCommandOverviewDto;
      if (r.ok && j.ok) setData(j);
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const events = data?.eventStream.events ?? [];

  return (
    <div className="mt-4 rounded-xl border border-blue-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300/90">
        Live operational feed
      </h3>
      {loading ? <p className="mt-2 text-xs text-slate-500">Streaming…</p> : null}
      {events.length > 0 ? (
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-[10px] text-slate-500">
          {events.slice(0, 12).map((e) => (
            <li key={e.id}>
              <span className="text-blue-200">{e.severity}</span> {e.summary}
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">No live events in window.</p>
      ) : null}
    </div>
  );
}
