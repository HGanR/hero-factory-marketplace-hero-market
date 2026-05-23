"use client";

import { useCallback, useEffect, useState } from "react";
import type { AmbientExecutiveSignal } from "@/lib/executive-agent/executive-ambient-signal-types";

type OverviewResponse = {
  ok?: boolean;
  interruptions?: AmbientExecutiveSignal[];
  error?: string;
};

type Props = {
  onDismiss?: (id: string) => void;
  dismissedIds?: Set<string>;
  interruptions?: AmbientExecutiveSignal[];
  loading?: boolean;
};

export function ExecutiveInterruptionPanel({
  onDismiss,
  dismissedIds,
  interruptions: externalItems,
  loading: externalLoading,
}: Props) {
  const [items, setItems] = useState<AmbientExecutiveSignal[]>(externalItems ?? []);
  const [loading, setLoading] = useState(externalLoading ?? !externalItems);

  const load = useCallback(async () => {
    if (externalItems) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/signals/overview?audit=0", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as OverviewResponse;
      if (r.ok && j.interruptions) setItems(j.interruptions);
      else setItems([]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [externalItems]);

  useEffect(() => {
    if (externalItems) {
      setItems(externalItems);
      setLoading(Boolean(externalLoading));
      return;
    }
    void load();
    const id = window.setInterval(() => void load(), 40_000);
    return () => window.clearInterval(id);
  }, [load, externalItems, externalLoading]);

  const visible = items.filter((i) => !dismissedIds?.has(i.id));
  if (!loading && visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">
        Executive interruptions
      </p>
      {loading && !visible.length ? (
        <p className="text-xs text-slate-500">Evaluating interruption thresholds…</p>
      ) : null}
      {visible.slice(0, 5).map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-amber-400/30 bg-amber-950/15 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-200/80">
                {item.severity} · advisory
              </p>
              <p className="mt-1 text-xs text-white">{item.summary}</p>
              <p className="mt-1 text-[10px] text-slate-400">{item.narration}</p>
            </div>
            {onDismiss ? (
              <button
                type="button"
                onClick={() => onDismiss(item.id)}
                className="shrink-0 text-[9px] uppercase text-slate-500 hover:text-white"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
