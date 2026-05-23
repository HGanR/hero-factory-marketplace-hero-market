"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AmbientExecutiveSignal } from "@/lib/executive-agent/executive-ambient-signal-types";
import { interruptionChoreographyLevel } from "@/lib/executive-agent/executive-presence-choreography";

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

  const SEVERITY_SHELL: Record<AmbientExecutiveSignal["severity"], string> = {
    critical: "border-rose-500/55 bg-rose-950/30 shadow-[0_0_28px_rgba(244,63,94,0.25)]",
    high: "border-orange-400/45 bg-orange-950/20 shadow-[0_0_20px_rgba(251,146,60,0.18)]",
    medium: "border-amber-400/35 bg-amber-950/15",
    low: "border-slate-500/30 bg-slate-950/20",
    watch: "border-slate-600/25 bg-slate-950/15",
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">
        Executive interruptions
      </p>
      {loading && !visible.length ? (
        <p className="text-xs text-slate-500">Evaluating interruption thresholds…</p>
      ) : null}
      <AnimatePresence initial={false}>
        {visible.slice(0, 5).map((item) => {
          const level = interruptionChoreographyLevel(item.severity);
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -12, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={`relative overflow-hidden rounded-xl border p-3 ${SEVERITY_SHELL[item.severity] ?? SEVERITY_SHELL.watch}`}
            >
              {level === "crisis_overlay" ? (
                <div aria-hidden className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-rose-500/10 via-transparent to-rose-500/10" />
              ) : null}
              {level === "rail_flash" || level === "hud_banner" ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-300/80 to-transparent"
                />
              ) : null}
              <div className="relative flex items-start justify-between gap-2">
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
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
