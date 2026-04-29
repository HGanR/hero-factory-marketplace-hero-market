"use client";

import Link from "next/link";
import { WorkspaceSelector } from "@/components/dashboard/WorkspaceSelector";

/** Hero for `/ai-revenue-os` — Bentley scope sync and workflow live below. */
export function AiRevenueOsMainBodyTop() {
  return (
    <header className="relative z-10 border-b border-cyan-500/15 bg-slate-950/80 pb-8 pt-10 md:pb-10 md:pt-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="min-w-0 flex-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90">
              Bentley · AI Revenue OS
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              Roadmap and revenue execution
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300 md:text-lg">
              Sync scope with Bentley, run the five-system engine, then open the full dashboard for projections,
              campaigns, and deployment memory.
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2 lg:pt-1">
            <WorkspaceSelector />
            <p className="text-[11px] text-slate-500 max-w-[280px] sm:text-right">
              Same workspace / client scope as the main dashboard — Bentley session data follows this selection.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/ai-revenue-os/clients"
            className="inline-flex items-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20"
          >
            Client hub
          </Link>
          <Link
            href="/revenue-os/dashboard"
            className="inline-flex items-center rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/25"
          >
            Open Bentley dashboard
          </Link>
          <a
            href="#workflow-handoff"
            className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-500/35"
          >
            Start workflow handoff
          </a>
        </div>
      </div>
    </header>
  );
}
