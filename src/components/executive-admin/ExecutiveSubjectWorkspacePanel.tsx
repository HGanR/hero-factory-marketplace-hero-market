"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import type { SubjectExecutiveWorkspaceDto } from "@/lib/executive-agent/subject-workspace-types";

type Props = {
  subjectId: ExecutiveSubjectId;
  clientId: string;
  orderId: string;
  onSkipperContext?: (context: string | null) => void;
  embedded?: boolean;
};

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function ExecutiveSubjectWorkspacePanel({
  subjectId,
  clientId,
  orderId,
  onSkipperContext,
  embedded = false,
}: Props) {
  const [workspace, setWorkspace] = useState<SubjectExecutiveWorkspaceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ subjectId });
      if (clientId.trim()) params.set("clientId", clientId.trim());
      if (orderId.trim()) params.set("orderId", orderId.trim());
      const r = await fetch(`/api/admin/executive-agent/subject-workspace?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as SubjectExecutiveWorkspaceDto & {
        error?: string;
        message?: string;
      };
      if (!r.ok || !j.ok) {
        setError(j.message ?? j.error ?? `Workspace load failed (${r.status})`);
        setWorkspace(null);
        onSkipperContext?.(null);
        return;
      }
      setWorkspace(j);
      onSkipperContext?.(j.skipperContext);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setWorkspace(null);
      onSkipperContext?.(null);
    } finally {
      setLoading(false);
    }
  }, [subjectId, clientId, orderId, onSkipperContext]);

  useEffect(() => {
    void load();
  }, [load]);

  const mem = workspace?.memoryHighlights;

  return (
    <section
      className={
        embedded
          ? ""
          : "mb-4 rounded-2xl border border-violet-500/22 bg-[#050b13]/88 p-4 shadow-[0_0_24px_rgba(139,92,246,0.06)] backdrop-blur-md"
      }
    >
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300/90">
              Subject workspace
            </h2>
            {workspace ? (
              <p className="mt-0.5 text-[10px] text-slate-500">
                {workspace.scope.label}
                {workspace.scope.department ? ` · ${workspace.scope.department}` : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-full border border-violet-500/35 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-violet-200 hover:bg-violet-950/30 disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-full border border-violet-500/35 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-violet-200 hover:bg-violet-950/30 disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-red-300/90">{error}</p> : null}
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading workspace context…</p> : null}

      {workspace && !loading ? (
        <div className="mt-3 space-y-4 text-xs text-slate-300">
          <p className="text-sm text-violet-100/90">{workspace.headline}</p>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Workspace" value={workspace.scope.workspaceKind} />
            <Stat label="Orders" value={String(workspace.orders.length)} />
            <Stat label="Timeline" value={String(workspace.timeline.length)} />
            <Stat label="Recommendations" value={String(workspace.recommendations.length)} />
          </div>

          {workspace.health ? (
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Client health</span>
              <p className="mt-1">
                Score {workspace.health.score} · {workspace.health.tier}
                {workspace.health.stalled ? " · stalled" : ""}
              </p>
            </div>
          ) : null}

          {workspace.skipperBrief ? (
            <p className="text-[11px] text-slate-400">{workspace.skipperBrief}</p>
          ) : null}

          {workspace.recommendations.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Recommendations
              </h3>
              <ul className="mt-1 space-y-1">
                {workspace.recommendations.slice(0, 6).map((r) => (
                  <li key={r.id} className="rounded border border-slate-800/60 px-2 py-1 text-[11px]">
                    <span className="text-violet-200/90">{r.title}</span>
                    <span className="text-slate-600"> · {r.priority}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {workspace.timeline.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Timeline</h3>
              <ul className="mt-1 max-h-36 space-y-1 overflow-y-auto">
                {workspace.timeline.slice(0, 8).map((t) => (
                  <li key={t.id} className="text-[11px] text-slate-400">
                    {t.label}
                    {t.orderId ? ` · ${shortId(t.orderId)}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : workspace.timelineSummary ? (
            <p className="text-[11px] text-slate-500">{workspace.timelineSummary}</p>
          ) : null}

          {workspace.orders.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Orders</h3>
              <ul className="mt-1 flex flex-wrap gap-2">
                {workspace.orders.map((o) => (
                  <li
                    key={o.orderId}
                    className="rounded border border-cyan-500/20 bg-cyan-950/20 px-2 py-1 font-mono text-[10px]"
                  >
                    {o.department} · {o.pipelineStage.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {mem ? (
            <div className="rounded-lg border border-violet-500/20 bg-violet-950/15 px-3 py-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
                Operational memory (subject-scoped)
              </h3>
              <ul className="mt-1 list-inside list-disc text-[11px] text-slate-400">
                {mem.recurringBottleneck ? <li>{mem.recurringBottleneck}</li> : null}
                {mem.topEffectiveRecommendation ? <li>{mem.topEffectiveRecommendation}</li> : null}
                {workspace.scope.department === "WEBSITE" ? (
                  <li>Low-revision WEBSITE signals: {mem.websiteLowRevisionDrafts}</li>
                ) : null}
                {workspace.scope.department === "TRUST" ? (
                  <li>TRUST stall signals: {mem.trustStalledPackets}</li>
                ) : null}
                {mem.clientsNeedingGuidance > 0 ? (
                  <li>Clients needing guidance: {mem.clientsNeedingGuidance}</li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <p className="text-[10px] text-slate-600">
            Read-only workspace · Skipper uses this context in subject chat · no autonomous execution
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
      <div className="text-sm font-medium capitalize text-slate-200">{value}</div>
    </div>
  );
}
