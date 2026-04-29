import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedUserId } from "@/lib/api/auth";
import { AddClientForm } from "@/components/client-hub/AddClientForm";
import { ClientHealthBadge } from "@/components/client-hub/ClientHealthBadge";
import { ClientStatusBadge } from "@/components/client-hub/ClientStatusBadge";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { listClientsForUser } from "@/lib/revenue-os/client-hub-queries";

export default async function ClientHubListPage() {
  await ensureClientHubTables();
  const userId = await getAuthedUserId();
  if (!userId) {
    redirect("/?returnTo=" + encodeURIComponent("/ai-revenue-os/clients"));
  }
  const clients = await listClientsForUser(userId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 border-b border-white/5 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90">AI Revenue OS</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Client hub</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Businesses and performance you manage — separate from your personal Mission Path on the main dashboard.
            </p>
          </div>
          <Link
            href="/ai-revenue-os"
            className="text-sm text-cyan-300/90 underline-offset-4 hover:underline"
          >
            Main Revenue OS
          </Link>
        </div>
        <div className="mt-6">
          <AddClientForm />
        </div>
        <div className="mt-8 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sites</th>
                <th className="px-4 py-3">AI agents</th>
                <th className="px-4 py-3">Open conv.</th>
                <th className="px-4 py-3">Leads</th>
                <th className="px-4 py-3">Campaigns</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    No clients yet. Add one above to start the command center.
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id} className="border-t border-white/5 bg-slate-900/20 hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-medium text-slate-100">{c.name}</td>
                    <td className="px-4 py-3">
                      <ClientHealthBadge score={c.healthScore} label={c.healthLabel} status={c.healthStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <ClientStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{c.siteCount}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{c.agentBindingCount}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{c.openConversations}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{c.leadsCount}</td>
                    <td className="px-4 py-3 text-slate-400">{c.campaignStatus}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.lastActivityAt ? new Date(c.lastActivityAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/ai-revenue-os/clients/${c.id}`}
                        className="inline-flex rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                      >
                        Open client
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
