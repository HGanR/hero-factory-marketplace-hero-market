import { notFound, redirect } from "next/navigation";
import { getAuthedUserId } from "@/lib/api/auth";
import { ClientHubHeader } from "@/components/client-hub/ClientHubHeader";
import { ClientMetricCard } from "@/components/client-hub/ClientMetricCard";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId, getClientAnalyticsForClient } from "@/lib/revenue-os/client-hub-queries";
import { ClientPerformanceChartGrid } from "@/components/client-hub/ClientPerformanceChartGrid";
import { deriveWeeklySeries } from "@/lib/revenue-os/client-performance-series";
import { ClientFunnelChart } from "@/components/client-hub/ClientFunnelChart";
import { ClientAgentPerformancePanel } from "@/components/client-hub/ClientAgentPerformancePanel";
import { ClientWebsitePerformancePanel } from "@/components/client-hub/ClientWebsitePerformancePanel";

type PageProps = { params: Promise<{ clientId: string }> };

function cardValue(v: number | null | undefined, placeholder: boolean): string | number {
  if (placeholder) return "—";
  if (v == null) return "—";
  return v;
}

export default async function ClientHubAnalyticsPage({ params }: PageProps) {
  await ensureClientHubTables();
  const userId = await getAuthedUserId();
  if (!userId) {
    redirect("/?returnTo=" + encodeURIComponent("/ai-revenue-os/clients"));
  }
  const { clientId } = await params;
  assertValidClientId(clientId);
  const a = await getClientAnalyticsForClient(userId, clientId);
  if (!a) notFound();

  return (
    <div className="space-y-6">
      <ClientHubHeader
        title="Analytics"
        description="Metrics are derived from CRM, widget embed, and campaigns for this client—no cross-client or unscoped data."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <ClientMetricCard
            label={a.leadConversion.label}
            value={cardValue(a.leadConversion.value, a.leadConversion.isPlaceholder)}
            isPlaceholder={a.leadConversion.isPlaceholder}
            sub={a.leadConversion.activationHint || undefined}
          />
        </div>
        <div className="space-y-1">
          <ClientMetricCard
            label={a.agentResponseVolume.label}
            value={cardValue(a.agentResponseVolume.value, a.agentResponseVolume.isPlaceholder)}
            isPlaceholder={a.agentResponseVolume.isPlaceholder}
            sub={a.agentResponseVolume.activationHint || undefined}
          />
        </div>
        <div className="space-y-1">
          <ClientMetricCard
            label={a.campaignEngagement.label}
            value={cardValue(a.campaignEngagement.value, a.campaignEngagement.isPlaceholder)}
            isPlaceholder={a.campaignEngagement.isPlaceholder}
            sub={a.campaignEngagement.activationHint || undefined}
          />
        </div>
        <div className="space-y-1">
          <ClientMetricCard
            label={a.bookingRate.label}
            value={a.bookingRate.value == null ? "—" : `${a.bookingRate.value}%`}
            isPlaceholder={a.bookingRate.isPlaceholder}
            sub={a.bookingRate.activationHint || undefined}
          />
        </div>
        <div className="space-y-1">
          <ClientMetricCard
            label={a.websiteActivity.label}
            value={a.websiteActivity.isPlaceholder ? "—" : (a.websiteActivity.value ?? "—")}
            isPlaceholder={a.websiteActivity.isPlaceholder}
            sub={a.websiteActivity.activationHint || undefined}
          />
        </div>
        <div className="space-y-1">
          <ClientMetricCard
            label="Open conversations (known)"
            value={a.knownMetrics.openConversations}
          />
        </div>
      </div>
      <section className="rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
        <h2 className="text-sm font-semibold text-cyan-200/90">Rolled-up numbers (this client only)</h2>
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-slate-400">
          <li>Leads captured: {a.knownMetrics.leadsCaptured}</li>
          <li>Conversations: {a.knownMetrics.conversations}</li>
          <li>Open conversations: {a.knownMetrics.openConversations}</li>
          <li>CRM messages: {a.knownMetrics.crmMessageCount}</li>
          <li>Widget (embed) messages: {a.knownMetrics.widgetMessageCount}</li>
          <li>Total messages (CRM + widget): {a.knownMetrics.messagesExchanged}</li>
          <li>Active sites: {a.knownMetrics.activeSites}</li>
          <li>Active agents (on site): {a.knownMetrics.activeAgents}</li>
          <li>Campaigns launched: {a.knownMetrics.campaignsLaunched}</li>
          <li>Posted social pieces: {a.knownMetrics.publishedPosts}</li>
          <li>
            Last activity:{" "}
            {a.knownMetrics.lastActivityAt
              ? new Date(a.knownMetrics.lastActivityAt).toLocaleString()
              : "— (no events yet; create site, CRM, or campaign content)"}
          </li>
        </ul>
      </section>
      <ClientPerformanceChartGrid
        series={{
          leads: deriveWeeklySeries(a.knownMetrics.leadsCaptured),
          conversations: deriveWeeklySeries(a.knownMetrics.conversations),
          messages: deriveWeeklySeries(a.knownMetrics.widgetMessageCount),
          bookings: deriveWeeklySeries(a.knownMetrics.bookings),
        }}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <ClientFunnelChart
          visits={Math.max(a.knownMetrics.widgetMessageCount, a.knownMetrics.conversations)}
          conversations={a.knownMetrics.conversations}
          leads={a.knownMetrics.leadsCaptured}
          bookings={a.knownMetrics.bookings}
        />
        <ClientAgentPerformancePanel
          responseVolume={a.knownMetrics.crmMessageCount + a.knownMetrics.widgetMessageCount}
          campaignActivity={a.knownMetrics.campaignsLaunched + a.knownMetrics.publishedPosts}
        />
        <ClientWebsitePerformancePanel
          websiteActivity={Math.max(a.knownMetrics.widgetMessageCount, a.knownMetrics.conversations)}
          activeSites={a.knownMetrics.activeSites}
        />
      </div>
    </div>
  );
}
