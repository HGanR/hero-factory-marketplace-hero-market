import { getClientPortalSession } from "@/lib/client-portal/portal-session";
import { getClientPortalOverviewForPortalUser } from "@/lib/client-portal/portal-data";
import { PortalAnalyticsOverview } from "@/components/client-portal/PortalAnalyticsOverview";

export default async function ClientPortalOverviewPage() {
  const s = await getClientPortalSession();
  if (!s) return null;
  const o = await getClientPortalOverviewForPortalUser(s);
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
      <PortalAnalyticsOverview
        leadsCaptured={o.stats.leadsCaptured}
        conversations={o.stats.openConversations}
        bookings={o.stats.bookings}
        websiteActivity={o.stats.agentMessageVolume}
        agentStatus={o.aiAgent.isActive ? "Active" : "Inactive"}
        serviceStatus="Visible"
        recentConversations={o.recent.conversations}
      />
    </div>
  );
}
