"use client";

import Link from "next/link";
import { HolographicCard, HOLO_TILE_SM } from "./HolographicCard";

export function DashboardMissionControl() {
  return (
    <HolographicCard accent="cyan">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-cyan-100 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Mission Control
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <Link href="/troo-town" className={`${HOLO_TILE_SM} p-4 block`}>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Worlds</div>
            <div className="text-lg font-semibold text-white mt-1">Troo Town</div>
            <div className="text-xs text-cyan-400/80 mt-1">Enter World</div>
          </Link>
          <Link href="/app/agents" className={`${HOLO_TILE_SM} p-4 block`}>
            <div className="text-xs text-slate-400 uppercase tracking-wider">AI Agents</div>
            <div className="text-lg font-semibold text-white mt-1">AI Agency</div>
            <div className="text-xs text-cyan-400/80 mt-1">Deploy Agents</div>
          </Link>
          <Link href="/mission-path" className={`${HOLO_TILE_SM} p-4 block`}>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Guided</div>
            <div className="text-lg font-semibold text-white mt-1">Mission Path</div>
            <div className="text-xs text-cyan-400/80 mt-1">Next Steps</div>
          </Link>
          <Link href="/trust-records?tab=settings" className={`${HOLO_TILE_SM} p-4 block`}>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Trust</div>
            <div className="text-lg font-semibold text-white mt-1">Trust Records</div>
            <div className="text-xs text-cyan-400/80 mt-1">Configure</div>
          </Link>
          <Link href="/accounting" className={`${HOLO_TILE_SM} p-4 block`}>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Finance</div>
            <div className="text-lg font-semibold text-white mt-1">Accounting</div>
            <div className="text-xs text-cyan-400/80 mt-1">Ledger</div>
          </Link>
        </div>
      </div>
    </HolographicCard>
  );
}
