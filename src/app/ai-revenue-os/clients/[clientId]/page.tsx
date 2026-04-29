import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthedUserId } from "@/lib/api/auth";
import { ClientActivityFeed } from "@/components/client-hub/ClientActivityFeed";
import { ClientHealthBadge } from "@/components/client-hub/ClientHealthBadge";
import { ClientHubHeader } from "@/components/client-hub/ClientHubHeader";
import { ClientMetricCard } from "@/components/client-hub/ClientMetricCard";
import { ClientHubRefreshIntelligenceControl } from "@/components/client-hub/ClientHubRefreshIntelligenceControl";
import { ClientStatusBadge } from "@/components/client-hub/ClientStatusBadge";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId, getClientActivityForClient, getClientSummary } from "@/lib/revenue-os/client-hub-queries";

type PageProps = { params: Promise<{ clientId: string }> };

export default async function ClientHubOverviewPage({ params }: PageProps) {
  await ensureClientHubTables();
  const userId = await getAuthedUserId();
  if (!userId) {
    redirect("/?returnTo=" + encodeURIComponent("/ai-revenue-os/clients"));
  }
  const { clientId } = await params;
  assertValidClientId(clientId);
  const [summary, activity] = await Promise.all([
    getClientSummary(userId, clientId),
    getClientActivityForClient(userId, clientId, 12),
  ]);
  if (!summary) {
    notFound();
  }
  const w = summary.client.workspaceId;
  return (
    <div className="space-y-8">
      <ClientHubHeader
        title={summary.client.name}
        description="Client performance overview — linked sites, agents, and pipeline signal."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <ClientStatusBadge status={summary.client.status} />
            {w ? (
              <span className="rounded border border-slate-600/50 bg-slate-900/50 px-2 py-0.5 text-xs text-slate-400">
                Workspace: {w}
              </span>
            ) : null}
            <span className="text-xs text-slate-500">
              Last activity:{" "}
              {summary.metrics.lastActivityAt
                ? new Date(summary.metrics.lastActivityAt).toLocaleString()
                : new Date(summary.client.updatedAt).toLocaleString()}
            </span>
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ClientMetricCard label="Leads captured" value={summary.metrics.leadsCaptured} sub="CRM contacts for this client" />
        <ClientMetricCard
          label="Conversations (opened)"
          value={summary.metrics.conversations}
          sub="Inbox threads attributed to the client"
        />
        <ClientMetricCard
          label="Messages exchanged"
          value={summary.metrics.messagesExchanged}
          sub="CRM + embed widget on client sites"
        />
        <ClientMetricCard
          label="Widget / agent (embed)"
          value={summary.metrics.agentInteractions}
          sub="Visitor↔agent messages on linked sites (public widget)"
        />
        <ClientMetricCard label="Active sites" value={summary.metrics.activeSites} sub="Non-archived sites" />
        <ClientMetricCard label="Active agents" value={summary.metrics.activeAgents} sub="Distinct agents on those sites" />
        <ClientMetricCard
          label="Campaigns launched"
          value={summary.metrics.campaignsLaunched}
          sub="LIVE or COMPLETED in Revenue OS for this client"
        />
        <ClientMetricCard label="Published posts" value={summary.metrics.publishedPosts} sub="POSTED in campaign queue" />
        <ClientMetricCard
          label="Open conversations (need response)"
          value={summary.metrics.openConversations}
          sub="Status open in CRM"
        />
        <ClientMetricCard
          label="Automation · leads qualified"
          value={summary.metrics.leadQualifiedCount}
          sub="From Client Hub inbox actions (CRM customFields + events)"
        />
        <ClientMetricCard label="Automation · follow-ups logged" value={summary.metrics.followUpCount} sub="Inbox follow-up events" />
        <ClientMetricCard label="Automation · tasks created" value={summary.metrics.taskCreatedCount} sub="Task events from inbox" />
        <ClientMetricCard label="Automation · bookings scheduled" value={summary.metrics.bookingScheduledCount} sub="Booking events from inbox" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-cyan-200/90">Client health</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ClientHealthBadge score={summary.health.score} label={summary.health.label} status={summary.health.status} />
            <span className="text-xs text-slate-500">Composite 0–100 from pipeline, engagement, campaigns, and hygiene signals.</span>
          </div>
          {summary.health.issues.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-400">
              {summary.health.issues.map((issue, i) => (
                <li key={`${i}-${issue.slice(0, 40)}`}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No major gaps detected from current telemetry.</p>
          )}
        </section>
        <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <h2 className="text-sm font-semibold text-cyan-100">Next best action</h2>
          <p className="mt-2 text-sm text-slate-200">{summary.nextBestAction}</p>
          {summary.nextBestActionDetail ? (
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{summary.nextBestActionDetail}</p>
          ) : null}
        </section>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-cyan-200/90">Active website</h2>
          {summary.primarySite ? (
            <div className="mt-3 text-sm text-slate-300">
              <p className="font-medium text-slate-100">{summary.primarySite.name}</p>
              <p className="mt-1 text-slate-500">
                {summary.primarySite.status} · updated {new Date(summary.primarySite.updatedAt).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Widget: {summary.primarySite.hasWidget ? "attached" : "not detected"}</p>
              <Link
                href={`/ai-revenue-os/clients/${clientId}/sites`}
                className="mt-2 inline-block text-xs text-cyan-400 hover:underline"
              >
                Manage sites →
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No site linked to this client. Add one under Sites.</p>
          )}
        </section>
        <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-cyan-200/90">Attached AI agent</h2>
          {summary.primaryAgent ? (
            <div className="mt-3 text-sm text-slate-300">
              <p className="font-medium text-slate-100">{summary.primaryAgent.name}</p>
              <p className="mt-1 text-slate-500">Status: {summary.primaryAgent.status || "—"}</p>
              {summary.primaryAgent.widgetKey ? (
                <p className="mt-1 font-mono text-xs text-slate-500">Widget {summary.primaryAgent.widgetKey}</p>
              ) : null}
              <Link
                href={`/ai-revenue-os/clients/${clientId}/agents`}
                className="mt-2 inline-block text-xs text-cyan-400 hover:underline"
              >
                Manage agents →
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No active agent binding on a client site yet.</p>
          )}
        </section>
      </div>
      <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-cyan-200/90">Recent conversations</h2>
        {summary.recentConversations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No inbox threads for contacts on this client.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {summary.recentConversations.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/5 pb-2 text-sm"
              >
                <span className="text-slate-200 line-clamp-1">{r.subject || r.channel}</span>
                <span className="text-xs text-slate-500">
                  {r.lastMessageAt ? new Date(r.lastMessageAt).toLocaleString() : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/ai-revenue-os/clients/${clientId}/inbox`}
          className="mt-3 inline-block text-xs text-cyan-400 hover:underline"
        >
          Open smart inbox →
        </Link>
      </section>
      <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-cyan-200/90">Recent campaign activity</h2>
        {summary.recentCampaignActivity.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No client-scoped campaigns in the system yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {summary.recentCampaignActivity.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span className="line-clamp-1 font-medium text-slate-100">{c.name}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {c.status} · {new Date(c.updatedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/ai-revenue-os/clients/${clientId}/campaigns`}
          className="mt-3 inline-block text-xs text-cyan-400 hover:underline"
        >
          All campaigns →
        </Link>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-cyan-200/90">Latest activity</h2>
        <p className="mt-1 text-xs text-slate-500">
          Newest first: sites, agent bindings, leads, CRM threads, widget sessions, campaigns, and (optionally) platform
          events when that table exists.
        </p>
        <div className="mt-2">
          <ClientActivityFeed items={activity} />
        </div>
      </section>
      <section>
        <ClientHubRefreshIntelligenceControl clientId={clientId} canManage />
      </section>
    </div>
  );
}
