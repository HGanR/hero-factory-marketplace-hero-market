"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import {
  CapitalPlanHintsBadge,
  FunnelRunCapitalHints,
} from "@/components/revenue-os/cross-module-provenance";

const ACCENT = "#00D1FF";

function qs(userId: string, clientId: string, trustId: string) {
  const p = new URLSearchParams({ userId });
  if (clientId) p.set("clientId", clientId);
  if (trustId) p.set("trustId", trustId);
  return p.toString();
}

function badgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "success") return "bg-green-500/20 text-green-400";
  if (s === "failed") return "bg-red-500/20 text-red-400";
  return "bg-slate-600/40 text-gray-400";
}

type FunnelRun = {
  id: string;
  funnelId: string;
  provider: string;
  mode: string;
  status: string;
  resultSummary: unknown;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string;
};

type SeqRun = {
  id: string;
  sequenceId: string;
  provider: string;
  mode: string;
  status: string;
  resultSummary: unknown;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string;
};

type SequenceRow = {
  id: string;
  name: string;
  channel: string;
  status: string;
  crossModuleContext?: unknown;
};

type FunnelRow = {
  id: string;
  name: string;
  status: string;
  crossModuleContext?: unknown;
};

/**
 * Lists deployment/execution runs and triggers dry-run sequence execution (mock — no ESP).
 */
export function DeploymentCenterPanel({
  userId,
  clientId,
  trustId,
}: {
  userId: string;
  clientId: string;
  trustId: string;
}) {
  const [funnelRuns, setFunnelRuns] = useState<FunnelRun[]>([]);
  const [sequenceRuns, setSequenceRuns] = useState<SeqRun[]>([]);
  const [sequences, setSequences] = useState<SequenceRow[]>([]);
  const [funnels, setFunnels] = useState<FunnelRow[]>([]);
  const [integrationNote, setIntegrationNote] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeq, setSelectedSeq] = useState<string>("");
  const [runBusy, setRunBusy] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const workspaceClient = useMemo(() => coerceTrimmedString(clientId), [clientId]);
  const workspaceTrust = useMemo(() => coerceTrimmedString(trustId), [trustId]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const q = qs(userId, workspaceClient, workspaceTrust);
      const [rRuns, rSeqs, rFunnels] = await Promise.all([
        fetch(`/api/revenue-os/deploy/runs?${q}&limit=20`),
        fetch(`/api/revenue-os/deploy/sequences?${q}&limit=20`),
        fetch(`/api/revenue-os/deploy/funnel?${q}&limit=20`),
      ]);
      const jRuns = await rRuns.json();
      const jSeqs = await rSeqs.json();
      const jFunnels = await rFunnels.json();
      if (!rRuns.ok) throw new Error(jRuns.error ?? "Failed to load runs");
      if (!rSeqs.ok) throw new Error(jSeqs.error ?? "Failed to load sequences");
      if (!rFunnels.ok) throw new Error(jFunnels.error ?? "Failed to load funnels");
      setFunnelRuns(jRuns.funnelRuns ?? []);
      setSequenceRuns(jRuns.sequenceRuns ?? []);
      const seqList = jSeqs.sequences ?? [];
      setSequences(seqList);
      setFunnels(jFunnels.funnels ?? []);
      setIntegrationNote(
        typeof jRuns.integrationNote === "string" ? jRuns.integrationNote : ""
      );
      setSelectedSeq((prev) => prev || seqList[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [userId, workspaceClient, workspaceTrust]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runDry() {
    if (!selectedSeq) {
      setRunMsg("Create a sequence via API first, or select one.");
      return;
    }
    setRunBusy(true);
    setRunMsg(null);
    try {
      const r = await fetch(
        `/api/revenue-os/deploy/sequences/${encodeURIComponent(selectedSeq)}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, dryRun: true }),
        }
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Execute failed");
      setRunMsg(j.message ?? "Dry run recorded.");
      await load();
    } catch (e) {
      setRunMsg(e instanceof Error ? e.message : "Execute failed");
    } finally {
      setRunBusy(false);
    }
  }

  return (
    <div
      id="deployment-center"
      data-bentley-section="deployment-center"
      className="rounded-2xl border border-cyan-500/60 bg-slate-800/50 p-6 scroll-mt-24"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-400">Module 3</div>
          <div className="text-xl font-semibold" style={{ color: ACCENT }}>
            Deployment center
          </div>
          <p className="text-xs text-amber-200/90 mt-2 max-w-2xl rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <strong className="text-amber-100">Mock / dry-run only:</strong> SendGrid and Twilio are not
            connected. Sequence runs are recorded in the database but no real messages are sent.
          </p>
          {integrationNote ? (
            <p className="text-xs text-gray-500 mt-2">{integrationNote}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-500 flex flex-col gap-1">
            Sequence
            <select
              value={selectedSeq}
              onChange={(e) => setSelectedSeq(e.target.value)}
              className="bg-black/40 border border-cyan-500/40 rounded-lg px-2 py-1.5 text-sm text-white min-w-[180px]"
            >
              <option value="">—</option>
              {sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.channel})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void runDry()}
            disabled={runBusy || !selectedSeq}
            className="px-4 py-2 rounded-xl text-sm font-medium text-black disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            {runBusy ? "Running…" : "Run sequence (dry-run)"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-amber-400" role="alert">
          {error}
        </p>
      )}
      {runMsg && (
        <p className="mt-2 text-xs text-gray-400" role="status">
          {runMsg}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading deployment history…</p>
      ) : (
        <div className="mt-6 space-y-8">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Saved artifacts (cross-module hints)
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-gray-600 uppercase mb-1">Sequences</div>
                {sequences.length === 0 ? (
                  <p className="text-sm text-gray-500">No sequences yet.</p>
                ) : (
                  <ul className="space-y-2 max-h-40 overflow-y-auto pr-1 text-sm">
                    {sequences.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-lg border border-cyan-500/20 bg-slate-900/40 px-3 py-2"
                      >
                        <div className="text-gray-200">{s.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {s.channel} · {s.status}
                        </div>
                        <CapitalPlanHintsBadge crossModuleContext={s.crossModuleContext} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-[10px] text-gray-600 uppercase mb-1">Funnels</div>
                {funnels.length === 0 ? (
                  <p className="text-sm text-gray-500">No funnels yet.</p>
                ) : (
                  <ul className="space-y-2 max-h-40 overflow-y-auto pr-1 text-sm">
                    {funnels.map((f) => (
                      <li
                        key={f.id}
                        className="rounded-lg border border-cyan-500/20 bg-slate-900/40 px-3 py-2"
                      >
                        <div className="text-gray-200">{f.name}</div>
                        <div className="text-[10px] text-gray-500">{f.status}</div>
                        <CapitalPlanHintsBadge crossModuleContext={f.crossModuleContext} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">
              Hints appear when you create an artifact with{" "}
              <code className="text-gray-400">capitalPlanId</code> +{" "}
              <code className="text-gray-400">applyCapitalPlanHints: true</code> — not automatic.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Funnel deployment runs
            </div>
            {funnelRuns.length === 0 ? (
              <p className="text-sm text-gray-500">No funnel deployments recorded yet.</p>
            ) : (
              <ul className="space-y-2 max-h-52 overflow-y-auto pr-1 text-sm">
                {funnelRuns.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-cyan-500/25 bg-slate-900/40 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <span className="text-gray-300 font-mono text-xs">{r.funnelId.slice(0, 8)}…</span>
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${badgeClass(r.status)}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {r.provider}/{r.mode} · {new Date(r.startedAt).toLocaleString()}
                    </div>
                    {r.errorMessage ? (
                      <div className="text-xs text-red-400 mt-1">{r.errorMessage}</div>
                    ) : (
                      <>
                        <FunnelRunCapitalHints resultSummary={r.resultSummary} />
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {r.resultSummary != null
                            ? `${JSON.stringify(r.resultSummary).slice(0, 100)}…`
                            : "—"}
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Sequence execution runs
            </div>
            {sequenceRuns.length === 0 ? (
              <p className="text-sm text-gray-500">No sequence runs yet. Use dry-run above.</p>
            ) : (
              <ul className="space-y-2 max-h-52 overflow-y-auto pr-1 text-sm">
                {sequenceRuns.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-cyan-500/25 bg-slate-900/40 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <span className="text-gray-300 font-mono text-xs">{r.sequenceId.slice(0, 8)}…</span>
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${badgeClass(r.status)}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {r.provider}/{r.mode} · {new Date(r.startedAt).toLocaleString()}
                    </div>
                    {r.errorMessage ? (
                      <div className="text-xs text-red-400 mt-1">{r.errorMessage}</div>
                    ) : (
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {r.resultSummary != null
                          ? `${JSON.stringify(r.resultSummary).slice(0, 120)}…`
                          : "—"}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
