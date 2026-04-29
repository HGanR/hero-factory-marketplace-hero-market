"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BentleySocialCommandCenterPayload, CommandCenterSection } from "@/lib/revenue-os/social-command-center";
import { BentleyCommandCenterKpis } from "@/components/revenue-os/bentley-command-center/BentleyCommandCenterKpis";
import { BentleyPlannerBoard } from "@/components/revenue-os/bentley-command-center/BentleyPlannerBoard";
import { BentleyIntelligencePanel } from "@/components/revenue-os/bentley-command-center/BentleyIntelligencePanel";
import { BentleyInboxBoard } from "@/components/revenue-os/bentley-command-center/BentleyInboxBoard";
import { BentleyApprovalsPanel } from "@/components/revenue-os/bentley-command-center/BentleyApprovalsPanel";
import { BentleyReportsPanel } from "@/components/revenue-os/bentley-command-center/BentleyReportsPanel";
import { BentleyAccountsPanel } from "@/components/revenue-os/bentley-command-center/BentleyAccountsPanel";

export type TabId = Exclude<CommandCenterSection, "all">;

const TABS: { id: TabId; label: string }[] = [
  { id: "planner", label: "Planner" },
  { id: "intelligence", label: "Intelligence" },
  { id: "inbox", label: "Inbox" },
  { id: "approvals", label: "Approvals" },
  { id: "reports", label: "Reports" },
  { id: "accounts", label: "Accounts" },
];

type Props = {
  payload: BentleySocialCommandCenterPayload;
  signedOut: boolean;
  clientId: string;
  trustId: string;
  onClientIdChange: (v: string) => void;
  onTrustIdChange: (v: string) => void;
  onRefresh: () => Promise<void>;
};

export function BentleyCommandCenterShell({
  payload,
  signedOut,
  clientId,
  trustId,
  onClientIdChange,
  onTrustIdChange,
  onRefresh,
}: Props) {
  const [tab, setTab] = useState<TabId>("planner");

  const kpiFocus = useMemo((): CommandCenterSection => tab, [tab]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/10 bg-black/40 px-4 py-6 sm:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-400/90">Bentley · Revenue OS</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">Social Command Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Centralized planner, lead intent inbox, governed autonomous actions, operator reports, and connector execution
          readiness — market sweep intelligence and cadence optimization stay native to Bentley.
        </p>
        <p className="mt-3 text-sm">
          <Link
            href="/dashboard/bentley/policy-workbench"
            className="font-medium text-cyan-400/95 underline-offset-4 hover:text-cyan-300 hover:underline"
          >
            Policy tuning workbench
          </Link>
          <span className="text-zinc-500"> — simulate, compare, and review autonomy changes before applying.</span>{" "}
          <Link
            href="/dashboard/bentley/policy-rollout"
            className="font-medium text-amber-200/90 underline-offset-4 hover:text-amber-100 hover:underline"
          >
            Rollout workbench
          </Link>
          <span className="text-zinc-500"> — stage pilots and guardrails before live apply.</span>
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-500">
            clientId
            <input
              className="ml-2 rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-1 text-sm text-zinc-100"
              value={clientId}
              onChange={(e) => onClientIdChange(e.target.value)}
              placeholder="optional scope"
            />
          </label>
          <label className="text-xs text-zinc-500">
            trustId
            <input
              className="ml-2 rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-1 text-sm text-zinc-100"
              value={trustId}
              onChange={(e) => onTrustIdChange(e.target.value)}
              placeholder="optional scope"
            />
          </label>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="rounded-lg bg-cyan-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Apply workspace scope
          </button>
        </div>
      </header>

      <div className="space-y-6 px-4 py-6 sm:px-8">
        {signedOut ? (
          <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-6 text-sm text-zinc-400">
            Sign in to load the command center — approvals, audit-backed autonomous actions, and workspace-scoped queue
            boards require an authenticated session.
          </div>
        ) : null}

        <BentleyCommandCenterKpis kpis={payload.kpis} active={kpiFocus} onFocus={(s) => setTab(s === "all" ? "planner" : (s as TabId))} />

        <nav className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === t.id ? "bg-cyan-500/15 text-cyan-100" : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="min-h-[320px]">
          {tab === "planner" ? (
            <BentleyPlannerBoard
              columns={payload.planner.columns}
              workflowSummaryLine={payload.planner.workflowSummaryLine}
              cadenceSummaryLine={payload.planner.cadenceSummaryLine}
            />
          ) : null}
          {tab === "intelligence" ? <BentleyIntelligencePanel intelligence={payload.intelligence} /> : null}
          {tab === "inbox" ? <BentleyInboxBoard inbox={payload.inbox} /> : null}
          {tab === "approvals" ? <BentleyApprovalsPanel approvals={payload.approvals} onRefresh={onRefresh} /> : null}
          {tab === "reports" ? <BentleyReportsPanel reports={payload.reports} /> : null}
          {tab === "accounts" ? <BentleyAccountsPanel accounts={payload.accounts} /> : null}
        </div>

        <footer className="border-t border-white/5 pt-4 text-[11px] text-zinc-600">
          Generated {payload.generatedAt.slice(0, 19)} · Filters{" "}
          {payload.filters.clientId ?? "—"} / {payload.filters.trustId ?? "—"}
        </footer>
      </div>
    </div>
  );
}
