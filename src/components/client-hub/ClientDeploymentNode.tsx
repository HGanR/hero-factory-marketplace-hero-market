"use client";

import type { DeploymentNode } from "@/lib/revenue-os/client-command-center-data";

function nodePill(state: DeploymentNode["state"]): string {
  switch (state) {
    case "connected":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
    case "missing":
      return "border-slate-600 bg-slate-900/60 text-slate-400";
    case "warning":
      return "border-amber-500/40 bg-amber-500/10 text-amber-100";
    case "paused":
      return "border-rose-500/40 bg-rose-500/10 text-rose-100";
    default:
      return "border-slate-600 bg-slate-900 text-slate-300";
  }
}

export function ClientDeploymentNode({ node }: { node: DeploymentNode }) {
  return (
    <li className={`rounded-xl border px-4 py-3 ${nodePill(node.state)}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-100">{node.label}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">{node.state}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed opacity-95">{node.detail}</p>
    </li>
  );
}
