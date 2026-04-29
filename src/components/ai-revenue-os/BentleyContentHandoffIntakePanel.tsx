"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  buildBentleyContentBundleReadableNotes,
  serializeContentBundleHandoff,
  type BentleyContentBundleHandoff,
} from "@/lib/bentley-social-leads/handoff";
import { loadWorkflowState, saveWorkflowState } from "@/lib/revenue-os/bentley-workflow";

/**
 * Review latest Bentley SLI → Content Bundle handoff on the AI Revenue OS landing page.
 * Upstream market intelligence only — not generated campaign output.
 */
export function BentleyContentHandoffIntakePanel() {
  const [handoff, setHandoff] = useState<BentleyContentBundleHandoff | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"readable" | "json">("readable");
  const [rawOpen, setRawOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/bentley-social-leads/content-bundle-handoff", { credentials: "include" });
      if (r.status === 401) {
        setHandoff(null);
        setErr(null);
        return;
      }
      if (!r.ok) throw new Error("Could not load handoff");
      const j = (await r.json()) as { handoff: BentleyContentBundleHandoff | null };
      setHandoff(j.handoff ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function attachToWorkflow() {
    if (!handoff) return;
    const ws = loadWorkflowState();
    saveWorkflowState({
      ...ws,
      artifacts: { ...ws.artifacts, bentleySliContentHandoff: handoff },
    });
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-violet-500/35 bg-slate-900/60 p-6 text-sm text-slate-500">
        Loading Bentley intelligence handoff…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-rose-500/35 bg-rose-950/20 p-6 text-sm text-rose-200">
        {err}{" "}
        <button type="button" className="underline text-violet-300" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!handoff) {
    return (
      <div className="rounded-2xl border border-slate-600/50 bg-slate-900/50 p-6 text-sm text-slate-400">
        <p className="text-slate-300 font-medium mb-1">Bentley intelligence handoff</p>
        <p className="mb-3">
          No handoff yet. Run Social Lead Intelligence, filter leads, then use{" "}
          <strong className="text-violet-200">Send to AI Revenue OS</strong> on the content intelligence panel.
        </p>
        <Link
          href="/revenue-os/social-lead-intelligence"
          className="text-cyan-400 hover:underline text-sm font-medium"
        >
          Open Social Lead Intelligence →
        </Link>
      </div>
    );
  }

  const notes = buildBentleyContentBundleReadableNotes(handoff);

  return (
    <div className="rounded-2xl border border-violet-500/40 bg-slate-900/70 p-6 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-violet-400/90">Upstream intelligence</p>
          <h3 className="text-xl font-semibold text-white mt-1">Bentley Social Lead Intelligence handoff</h3>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            id {handoff.handoffId ?? "—"} · {handoff.basedOnFilteredRowCount} filtered rows ·{" "}
            {handoff.provenance.uploadSourceType ?? "—"} · {handoff.provenance.uploadFilename ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => attachToWorkflow()}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-2"
          >
            Use in workflow (this session)
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-white/15 text-slate-300 text-xs px-3 py-2 hover:bg-white/5"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTab("readable")}
          className={`rounded-lg px-3 py-1 text-xs ${
            tab === "readable" ? "bg-violet-600 text-white" : "border border-white/15 text-slate-400"
          }`}
        >
          Market summary & angles
        </button>
        <button
          type="button"
          onClick={() => setTab("json")}
          className={`rounded-lg px-3 py-1 text-xs ${
            tab === "json" ? "bg-violet-600 text-white" : "border border-white/15 text-slate-400"
          }`}
        >
          Structured view
        </button>
        <button
          type="button"
          onClick={() => setRawOpen((o) => !o)}
          className="rounded-lg border border-white/10 text-slate-500 text-xs px-3 py-1"
        >
          {rawOpen ? "Hide" : "View"} raw JSON
        </button>
      </div>

      {tab === "readable" ? (
        <div className="space-y-4 text-sm text-slate-300">
          <section>
            <p className="text-[10px] uppercase text-slate-500 mb-1">Market summary</p>
            <p className="leading-relaxed">{handoff.marketSummary}</p>
          </section>
          <section className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">Pain themes</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {handoff.topPainThemes.slice(0, 8).map((t) => (
                  <li key={t.theme}>
                    {t.theme} <span className="text-slate-500">({t.count})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">Hooks</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {handoff.hooks.slice(0, 8).map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          </section>
          <section className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">CTA / offer angles</p>
              <p className="text-slate-400 text-xs">{handoff.ctaAngles.join(" · ") || "—"}</p>
              <p className="text-slate-400 text-xs mt-2">{handoff.offerAngles.join(" · ") || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">What to post next</p>
              <ol className="list-decimal pl-4 space-y-1 text-xs">
                {handoff.whatToPostNext.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ol>
            </div>
          </section>
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer text-slate-400">Full notes block (deterministic)</summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-slate-400 border border-white/10 rounded-lg p-3 bg-black/30">
              {notes.compactMarkdown}
            </pre>
          </details>
        </div>
      ) : (
        <pre className="text-[11px] text-slate-400 overflow-x-auto font-mono border border-white/10 rounded-lg p-4 bg-black/30 max-h-[320px]">
          {JSON.stringify(
            {
              source: handoff.source,
              schemaVersion: handoff.schemaVersion,
              handoffId: handoff.handoffId,
              createdAt: handoff.createdAt,
              basedOnFilteredRowCount: handoff.basedOnFilteredRowCount,
              filtersApplied: handoff.filtersApplied,
              provenance: handoff.provenance,
              platformsInvolved: handoff.platformsInvolved,
              engineBatchSummary: handoff.engineBatchSummary,
            },
            null,
            2
          )}
        </pre>
      )}

      {rawOpen ? (
        <pre className="mt-4 text-[10px] text-slate-500 overflow-x-auto font-mono border border-white/10 rounded-lg p-4 bg-black/40 max-h-[240px]">
          {serializeContentBundleHandoff(handoff)}
        </pre>
      ) : null}

      <p className="text-[10px] text-slate-600 mt-4">
        Single-block paste: <span className="font-mono text-slate-500">{notes.singleBlock.slice(0, 160)}…</span>
      </p>
    </div>
  );
}
