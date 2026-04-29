import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedUserId } from "@/lib/api/auth";
import { ClientHubHeader } from "@/components/client-hub/ClientHubHeader";
import { ClientPrimaryActionBar } from "@/components/client-hub/ClientPrimaryActionBar";
import { ClientStatusBadge } from "@/components/client-hub/ClientStatusBadge";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId, listAgentBindingsForClient } from "@/lib/revenue-os/client-hub-queries";

type PageProps = { params: Promise<{ clientId: string }> };

export default async function ClientHubAgentsPage({ params }: PageProps) {
  await ensureClientHubTables();
  const userId = await getAuthedUserId();
  if (!userId) {
    redirect("/?returnTo=" + encodeURIComponent("/ai-revenue-os/clients"));
  }
  const { clientId } = await params;
  assertValidClientId(clientId);
  const agents = await listAgentBindingsForClient(userId, clientId);

  return (
    <div className="space-y-4">
      <ClientHubHeader
        title="AI agents & bindings"
        description="Bindings via owned sites and ai_agent_site_bindings, scoped to your user."
      />
      <ClientPrimaryActionBar>
        <Link
          href="/app/agents"
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
        >
          Create AI agent
        </Link>
        <Link
          href={`/ai-revenue-os/clients/${clientId}/sites`}
          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-500/30"
        >
          Bind to site
        </Link>
        {agents[0] ? (
          <Link
            href={`/site-builder?siteId=${encodeURIComponent(agents[0]!.siteId)}`}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-500/30"
          >
            Test chat (preview)
          </Link>
        ) : null}
      </ClientPrimaryActionBar>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-900/60 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Site</th>
              <th className="px-3 py-2">Widget key</th>
              <th className="px-3 py-2">Knowledge</th>
              <th className="px-3 py-2">Tools</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No bindings. Link a site to this client, then attach an agent in your workspace.
                </td>
              </tr>
            ) : (
              agents.map((a) => (
                <tr key={a.bindingId} className="border-t border-white/5">
                  <td className="px-3 py-2 text-slate-200">{a.agentName}</td>
                  <td className="px-3 py-2">
                    {a.agentStatus ? <ClientStatusBadge status={a.agentStatus} /> : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{a.siteName}</td>
                  <td className="px-3 py-2 font-mono text-xs text-cyan-200/90">{a.widgetKey}</td>
                  <td className="px-3 py-2 text-slate-400">{a.hasKnowledge ? "Ready" : "—"}</td>
                  <td className="px-3 py-2 text-slate-400">{a.toolsEnabled ? "On" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
