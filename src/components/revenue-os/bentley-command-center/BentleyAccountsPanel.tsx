"use client";

import type { BentleySocialCommandCenterPayload } from "@/lib/revenue-os/social-command-center";

type Props = {
  accounts: BentleySocialCommandCenterPayload["accounts"];
};

export function BentleyAccountsPanel({ accounts }: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-zinc-950/50 p-4">
      <p className="text-sm text-zinc-300">
        Connector execution readiness — OAuth coverage, capability matrix, and manual export fallbacks for autonomous actions and publishing.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-center">
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="text-[10px] uppercase text-zinc-500">Auto-publish ready</div>
          <div className="mt-1 font-mono text-2xl text-emerald-200">{accounts.autoPublishReadyCount}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="text-[10px] uppercase text-zinc-500">Manual fallback</div>
          <div className="mt-1 font-mono text-2xl text-amber-200">{accounts.manualFallbackCount}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="text-[10px] uppercase text-zinc-500">Blocked targets</div>
          <div className="mt-1 font-mono text-2xl text-rose-200">{accounts.blockedTargetsCount}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="text-[10px] uppercase text-zinc-500">Connected platforms</div>
          <div className="mt-1 text-xs text-zinc-300">{accounts.connectedPlatforms.length || "—"}</div>
        </div>
      </div>
      {accounts.recommendedConnectorAction ? (
        <p className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3 text-sm text-cyan-100/90">
          Bentley recommendation · {accounts.recommendedConnectorAction}
        </p>
      ) : null}
      {accounts.connectorCoverageLine ? (
        <p className="text-xs text-zinc-400">{accounts.connectorCoverageLine}</p>
      ) : null}
      {accounts.matrixSummaryLine ? <p className="text-xs text-zinc-500">{accounts.matrixSummaryLine}</p> : null}
      <div className="flex flex-wrap gap-2">
        {accounts.connectedPlatforms.map((p) => (
          <span key={p} className="rounded-full border border-white/10 bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-200">
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}
