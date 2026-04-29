"use client";

import { useCallback, useEffect, useState } from "react";
import type { NormalizedMarketScan } from "@/lib/revenue-os/market-scan-normalize";

const ACCENT = "#00D1FF";

type ScanRow = {
  id: string;
  industry: string;
  geo: string | null;
  offerType: string | null;
  createdAt: string;
  preview: {
    competitorCount: number;
    demandGapCount: number;
    regulatoryCount: number;
    citationCount: number;
  };
};

function qs(userId: string, clientId: string) {
  const p = new URLSearchParams({ userId });
  if (clientId) p.set("clientId", clientId);
  return p.toString();
}

/**
 * Lists persisted market scans and loads a selected scan (normalized v2 payload).
 */
export function MarketScanHistoryPanel({
  industry,
  geo,
  offerType,
  userId,
  clientId,
}: {
  industry: string;
  geo?: string;
  offerType?: string;
  userId: string;
  clientId: string;
}) {
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NormalizedMarketScan | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [runLoading, setRunLoading] = useState(false);

  const workspaceClient = clientId.trim();

  const loadList = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const r = await fetch(
        `/api/revenue-os/market/scans?${qs(userId, workspaceClient)}`
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to load scans");
      setScans(j.scans ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load scans");
      setScans([]);
    } finally {
      setLoading(false);
    }
  }, [userId, workspaceClient]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailError(null);
      setDetail(null);
      try {
        const r = await fetch(
          `/api/revenue-os/market/scans/${encodeURIComponent(id)}?${qs(userId, workspaceClient)}`
        );
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load scan");
        const n = j.scan?.normalized as NormalizedMarketScan | undefined;
        if (!n || n.v !== 2) {
          setDetail(null);
          setDetailError("Invalid scan payload");
          return;
        }
        setDetail(n);
      } catch (e) {
        setDetailError(e instanceof Error ? e.message : "Failed to load scan");
      }
    },
    [userId, workspaceClient]
  );

  const onSelect = (id: string) => {
    setSelectedId(id);
    void loadDetail(id);
  };

  const runScan = async () => {
    setRunLoading(true);
    setListError(null);
    try {
      const r = await fetch("/api/revenue-os/market/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry,
          geo: geo?.trim() || undefined,
          offerType: offerType?.trim() || undefined,
          userId,
          clientId: workspaceClient || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Scan failed");
      await loadList();
      if (j.scanId) {
        onSelect(j.scanId as string);
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setRunLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-cyan-500/60 bg-slate-800/50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-400">Market intelligence</div>
          <div className="text-xl font-semibold" style={{ color: ACCENT }}>
            Scan history
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Persisted scans include competitors, pricing bands, demand gaps, regulatory notes, and
            citations (every claim requires a citation URL). Run a new scan or open a past result.
          </p>
          <p className="text-xs text-cyan-200/90 mt-3 max-w-xl rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-3 py-2">
            <span className="font-semibold text-cyan-300">Offer engineering:</span> merging a scan
            into generated offers is optional and explicit—use the{" "}
            <strong className="text-gray-200">Offer Ladder</strong> panel, pick a saved scan, and
            enable &quot;Apply scan to this generation&quot;. v2 normalized scans show as guidance;
            non-v2 scans surface a &quot;skipped merge&quot; note instead of silent changes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runScan()}
          disabled={runLoading || !industry.trim()}
          className="px-4 py-2 rounded-xl text-sm font-medium text-black disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          {runLoading ? "Running…" : "Run market scan"}
        </button>
      </div>

      {listError && (
        <div className="mt-4 text-sm text-amber-400" role="alert">
          {listError}
        </div>
      )}

      <div className="mt-6 grid md:grid-cols-2 gap-6">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Previous scans
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : scans.length === 0 ? (
            <p className="text-sm text-gray-500">
              No saved scans yet. Run a market scan to persist results for this workspace.
            </p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {scans.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selectedId === s.id
                        ? "border-cyan-400 bg-cyan-500/10 text-white"
                        : "border-cyan-500/30 bg-slate-900/40 text-gray-300 hover:border-cyan-500/50"
                    }`}
                  >
                    <div className="font-medium">{s.industry}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(s.createdAt).toLocaleString()} · competitors{" "}
                      {s.preview.competitorCount} · citations {s.preview.citationCount}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Selected scan
          </div>
          {detailError && (
            <p className="text-sm text-amber-400" role="alert">
              {detailError}
            </p>
          )}
          {!selectedId && !detailError && (
            <p className="text-sm text-gray-500">Select a scan to view cited details.</p>
          )}
          {detail && (
            <div className="text-sm text-gray-300 space-y-3 max-h-80 overflow-y-auto pr-1">
              <div>
                <span className="text-gray-500">Industry:</span> {detail.industry}
                {detail.geo ? ` · ${detail.geo}` : ""}
              </div>
              <div>
                <span className="text-gray-500">Competitors (cited):</span>{" "}
                {detail.competitors.length}
              </div>
              <ul className="list-disc pl-5 space-y-1 text-gray-400">
                {detail.competitors.slice(0, 6).map((c, i) => (
                  <li key={i}>
                    {c.source} —{" "}
                    <a
                      href={c.citationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#D4AF37] hover:underline"
                    >
                      citation
                    </a>
                  </li>
                ))}
              </ul>
              {detail.demandGaps.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">Demand gaps (cited)</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {detail.demandGaps.map((d, i) => (
                      <li key={i}>
                        {d.summary}{" "}
                        <a
                          href={d.citationUrl}
                          className="text-[#D4AF37] hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          source
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.regulatory.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">Regulatory notes (cited)</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {detail.regulatory.map((r, i) => (
                      <li key={i}>
                        {r.note}{" "}
                        <a
                          href={r.citationUrl}
                          className="text-[#D4AF37] hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          source
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
