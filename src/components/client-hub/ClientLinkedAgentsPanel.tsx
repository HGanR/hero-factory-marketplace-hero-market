"use client";

import Link from "next/link";
import type { ClientCommandCenterPayload } from "@/lib/revenue-os/client-command-center-data";

function shortWidgetKey(k: string): string {
  if (!k) return "—";
  return k.length > 12 ? `${k.slice(0, 6)}…${k.slice(-4)}` : k;
}

export function ClientLinkedAgentsPanel({ data }: { data: ClientCommandCenterPayload }) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold text-cyan-200/90">Agent section</h2>
      <p className="mt-1 text-xs text-slate-500">Active AI agent bindings for this client.</p>
      {data.agents.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No active bindings — attach an agent from Sites or Site Builder.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Agent</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Bound site</th>
                <th className="py-2 pr-3">Widget</th>
                <th className="py-2 pr-3">Service</th>
                <th className="py-2 pr-3">Binding</th>
                <th className="py-2">Control</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((a) => (
                <tr key={a.bindingId} className="border-t border-white/5">
                  <td className="py-2 pr-3 text-slate-200">{a.agentName}</td>
                  <td className="py-2 pr-3 text-slate-400">{a.agentStatus ?? "—"}</td>
                  <td className="py-2 pr-3 text-slate-400">{a.siteName}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-cyan-200/80">{shortWidgetKey(a.widgetKey)}</td>
                  <td className="py-2 pr-3 text-slate-400">{a.clientServiceStatus}</td>
                  <td className="py-2 pr-3">{a.bindingActive ? <span className="text-emerald-300/90">Active</span> : <span className="text-amber-200/90">Inactive</span>}</td>
                  <td className="py-2">
                    <Link
                      href={`/app/agents/${encodeURIComponent(a.agentId)}/control`}
                      className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-100 hover:bg-violet-500/20"
                    >
                      Open Control
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
