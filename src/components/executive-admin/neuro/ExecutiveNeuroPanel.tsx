"use client";

import { useCallback, useEffect, useState } from "react";
import type { NeuroDocumentDto, NeuroNetworkOverviewDto } from "@/lib/executive-agent/neuro/neuro-types";
import { NeuroHudProvider, useNeuroHud } from "./neuro-hud-context";
import { NeuroBrainMap } from "./NeuroBrainMap";
import { NeuroDocumentUploadPanel } from "./NeuroDocumentUploadPanel";
import { NeuroSourceSearchPanel } from "./NeuroSourceSearchPanel";
import { NeuroDocumentViewer } from "./NeuroDocumentViewer";

type Props = {
  embedded?: boolean;
};

function ExecutiveNeuroPanelInner({ embedded }: Props) {
  const { overview, setOverview, viewer, setViewer, searching, refreshOverview } = useNeuroHud();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/neuro/overview", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json()) as NeuroNetworkOverviewDto & { error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? `Load failed (${r.status})`);
      setOverview(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [setOverview]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSelectDocument = useCallback(
    async (doc: NeuroDocumentDto) => {
      setSelectedDocId(doc.id);
      const r = await fetch(
        `/api/admin/executive-agent/neuro/documents/${encodeURIComponent(doc.id)}/viewer`,
        { credentials: "include", cache: "no-store" }
      );
      const j = (await r.json()) as { viewer?: typeof viewer };
      if (r.ok && j.viewer) setViewer(j.viewer);
    },
    [setViewer]
  );

  const regions = overview?.regions ?? [];
  const documents = overview?.documents ?? [];

  return (
    <section className={embedded ? "space-y-3" : "mb-4 rounded-2xl border border-cyan-500/22 bg-[#050b13]/88 p-4"}>
      {!embedded ? (
        <div className="mb-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/90">
            NEURO Network
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Governed source-backed knowledge — Skipper cites uploaded materials, not guesswork.
          </p>
        </div>
      ) : null}

      {error ? <p className="text-xs text-amber-200/90">{error}</p> : null}
      {loading && !overview ? (
        <p className="text-xs text-slate-500">Loading NEURO brain map…</p>
      ) : null}

      <NeuroSourceSearchPanel />

      <NeuroBrainMap
        regions={regions}
        documents={documents}
        pulse={searching}
        selectedDocumentId={selectedDocId}
        onSelectDocument={(doc) => void onSelectDocument(doc)}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <NeuroDocumentUploadPanel onUploaded={() => void refreshOverview()} />
        {viewer ? (
          <NeuroDocumentViewer viewer={viewer} onClose={() => setViewer(null)} />
        ) : (
          <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-700/60 bg-slate-950/30 p-4 text-center text-[10px] text-slate-500">
            Select a neural source node or search citation to open the document viewer inside the HUD.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-[9px] text-slate-500">
        <span>{overview?.totalIndexed ?? 0} indexed</span>
        <span>·</span>
        <span>{overview?.totalDocuments ?? 0} total sources</span>
        <button type="button" onClick={() => void load()} className="text-cyan-400/90 hover:text-cyan-200">
          Refresh map
        </button>
      </div>
    </section>
  );
}

export function ExecutiveNeuroPanel(props: Props) {
  return (
    <NeuroHudProvider>
      <ExecutiveNeuroPanelInner {...props} />
    </NeuroHudProvider>
  );
}
