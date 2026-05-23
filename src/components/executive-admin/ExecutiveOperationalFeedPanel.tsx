"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveAmbientSignalFeed } from "@/lib/executive-agent/executive-ambient-signal-types";
import type { AmbientOrbState } from "@/lib/executive-agent/executive-ambient-signal-types";
import {
  CATEGORY_FEED_LABEL,
  SEVERITY_FEED_COLOR,
} from "@/lib/executive-agent/executive-operational-feed";

type FeedResponse = ExecutiveAmbientSignalFeed & { ok?: boolean; orbState?: AmbientOrbState; error?: string };

export function ExecutiveOperationalFeedPanel() {
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/signals/feed", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as FeedResponse;
      if (r.ok) setData(j);
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(id);
  }, [load]);

  const events = data?.events ?? [];

  return (
    <div className="rounded-2xl border border-[#00A3FF]/20 bg-[#000814]/85 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00A3FF]/90">
          Executive operational feed
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="text-[9px] uppercase tracking-wider text-slate-500 hover:text-[#00A3FF]"
        >
          Refresh
        </button>
      </div>
      <p className="mt-1 text-[9px] text-slate-600">Advisory telemetry · auditable · no autonomous action</p>
      {loading && !events.length ? <p className="mt-3 text-xs text-slate-500">Streaming live signals…</p> : null}
      {events.length > 0 ? (
        <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
          {events.slice(0, 20).map((e) => {
            const color = SEVERITY_FEED_COLOR[e.severity] ?? SEVERITY_FEED_COLOR.watch;
            return (
              <li
                key={e.id}
                className={`rounded-lg border px-2.5 py-2 ${color}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base leading-none">{e.entityIcon ?? "📡"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                        {e.severity}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {CATEGORY_FEED_LABEL[e.category] ?? e.category}
                      </span>
                      {e.isInterruption ? (
                        <span className="rounded bg-rose-500/20 px-1 text-[8px] uppercase text-rose-200">
                          interrupt
                        </span>
                      ) : null}
                      <span className="ml-auto text-[8px] text-slate-600">
                        {new Date(e.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-white/90">{e.summary}</p>
                    {e.memoryCorrelation ? (
                      <p className="mt-0.5 text-[9px] italic text-slate-500">{e.memoryCorrelation}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : !loading ? (
        <p className="mt-3 text-xs text-slate-500">Calm desk — no operational signals in window.</p>
      ) : null}
    </div>
  );
}
