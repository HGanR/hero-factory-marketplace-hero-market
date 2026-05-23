"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { StephonSiteBuilderOverviewDto } from "@/lib/executive-agent/stephon-site-builder-types";

type Props = {
  embedded?: boolean;
};

export function StephonSiteBuilderPanel({ embedded = false }: Props) {
  const [data, setData] = useState<StephonSiteBuilderOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/site-builder/stephon/overview?limit=24", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as StephonSiteBuilderOverviewDto & {
        error?: string;
        message?: string;
      };
      if (!r.ok || !j.ok) {
        setError(j.message ?? j.error ?? `Load failed (${r.status})`);
        setData(null);
        return;
      }
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={embedded ? "" : "mb-4 rounded-2xl border border-indigo-500/22 bg-[#050b13]/88 p-4 backdrop-blur-md"}>
      {!embedded ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-300/90">
              Site Builder · Stephon
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Builder conversations — Skipper reads for usability and engine improvement signals
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/site-builder"
              className="rounded-full border border-indigo-500/35 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-indigo-200 hover:bg-indigo-950/30"
            >
              Open builder
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-full border border-slate-600 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              Refresh
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/site-builder"
            className="rounded-full border border-indigo-500/35 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-indigo-200 hover:bg-indigo-950/30"
          >
            Open builder
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="text-[9px] uppercase text-indigo-400/90"
          >
            Refresh
          </button>
        </div>
      )}

      {error ? <p className="mb-2 text-xs text-amber-200/90">{error}</p> : null}
      {loading && !data ? <p className="text-xs text-slate-500">Loading Stephon builder intelligence…</p> : null}

      {data ? (
        <div className="space-y-3 text-xs text-slate-300">
          {!data.npcConfigured ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-100/90">
              Stephon not found — expected NPC id <span className="font-mono">{data.npcId}</span> on{" "}
              <span className="font-mono">{data.worldId}</span>. Check Admin → NPC seed.
            </p>
          ) : (
            <>
              <p className="text-[10px] text-slate-500">
                {data.npcName} · <span className="font-mono">{data.npcId}</span> · {data.worldLabel}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Stat label="Sessions (30d)" value={String(data.totals.sessions30d)} />
                <Stat label="Messages (30d)" value={String(data.totals.messages30d)} />
                <Stat label="Active now" value={String(data.totals.activeSessions)} />
              </div>
            </>
          )}

          <p className="text-[11px] leading-relaxed text-slate-400">{data.skipperBrief}</p>

          {data.usabilityThemes.length > 0 ? (
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-950/15 px-3 py-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/80">
                Usability themes
              </h3>
              <ul className="mt-1 list-inside list-disc text-[11px] text-indigo-100/85">
                {data.usabilityThemes.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {data.sessions.length === 0 && !loading ? (
              <li className="text-[10px] text-slate-500">No builder sessions synced yet.</li>
            ) : null}
            {data.sessions.map((s) => (
              <li
                key={s.sessionId}
                className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-200">{s.siteLabel}</span>
                  <span className="font-mono text-[9px] text-slate-500">
                    {new Date(s.lastActivity).toLocaleString()}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500">{s.operatorLabel}</p>
                {s.lastSnippet ? (
                  <p className="mt-1 text-[11px] text-slate-400">{s.lastSnippet}</p>
                ) : null}
                <p className="mt-1 text-[9px] text-slate-600">
                  {s.messageCount} message{s.messageCount === 1 ? "" : "s"}
                </p>
                {s.usabilityHint ? (
                  <p className="mt-1 text-[10px] text-amber-200/90">{s.usabilityHint}</p>
                ) : null}
              </li>
            ))}
          </ul>

          <p className="text-[10px] text-slate-600">
            Read-only · PII masked · Skipper uses this for engine usability feedback — no autonomous product changes
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-700/50 bg-slate-900/50 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-200">{value}</div>
    </div>
  );
}
