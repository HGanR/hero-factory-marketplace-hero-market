import { getClientPortalSession } from "@/lib/client-portal/portal-session";
import { getClientPortalOverviewForPortalUser, getClientPortalRollupForPortalUser } from "@/lib/client-portal/portal-data";
import { PortalAnalyticsOverview } from "@/components/client-portal/PortalAnalyticsOverview";

export default async function ClientPortalAnalyticsPage() {
  const s = await getClientPortalSession();
  if (!s) return null;
  const r = await getClientPortalRollupForPortalUser(s);
  const o = await getClientPortalOverviewForPortalUser(s);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
      <p className="text-sm text-slate-600">Aggregated website + assistant analytics only.</p>
      <PortalAnalyticsOverview
        leadsCaptured={r.leadsCaptured}
        conversations={r.conversationsOpened}
        bookings={r.bookings}
        websiteActivity={r.widgetMessageVolume + r.crmMessageVolume}
        agentStatus={r.activeAgents > 0 ? "Active" : "Inactive"}
        serviceStatus={o.aiAgent.isActive ? "active" : "paused"}
        recentConversations={o.recent.conversations}
      />
    </div>
  );
}
