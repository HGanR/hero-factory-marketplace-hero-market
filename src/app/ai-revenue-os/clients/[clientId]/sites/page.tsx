import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedUserId } from "@/lib/api/auth";
import { ClientHubHeader } from "@/components/client-hub/ClientHubHeader";
import { ClientPrimaryActionBar } from "@/components/client-hub/ClientPrimaryActionBar";
import { ClientStatusBadge } from "@/components/client-hub/ClientStatusBadge";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId, listSitesForClient } from "@/lib/revenue-os/client-hub-queries";

type PageProps = { params: Promise<{ clientId: string }> };

export default async function ClientHubSitesPage({ params }: PageProps) {
  await ensureClientHubTables();
  const userId = await getAuthedUserId();
  if (!userId) {
    redirect("/?returnTo=" + encodeURIComponent("/ai-revenue-os/clients"));
  }
  const { clientId } = await params;
  assertValidClientId(clientId);
  const sites = await listSitesForClient(userId, clientId);

  return (
    <div className="space-y-4">
      <ClientHubHeader
        title="Sites & landing pages"
        description="web3_sites scoped to this client. Publish state, widget embed, and bound agent."
      />
      <ClientPrimaryActionBar>
        <Link
          href={`/site-builder?clientId=${encodeURIComponent(clientId)}`}
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
        >
          Build landing page
        </Link>
        <Link
          href={`/ai-revenue-os/clients/${clientId}/agents`}
          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-500/30"
        >
          Attach AI agent
        </Link>
        {sites[0] ? (
          <Link
            href={`/site-builder?siteId=${encodeURIComponent(sites[0]!.id)}`}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-500/30"
          >
            Preview site
          </Link>
        ) : null}
      </ClientPrimaryActionBar>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-900/60 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Publish</th>
              <th className="px-3 py-2">Widget</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {sites.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No sites linked. Use Site Builder to create a page and set client attribution.
                </td>
              </tr>
            ) : (
              sites.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-slate-200">{s.name}</td>
                  <td className="px-3 py-2">
                    <ClientStatusBadge status={s.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {s.hasWidget ? "On" : "—"}
                    {s.widgetKey ? (
                      <span className="ml-1 font-mono text-xs text-slate-500">({s.widgetKey.slice(0, 8)}…)</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {s.boundAgentName || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {s.updatedAt ? new Date(s.updatedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
