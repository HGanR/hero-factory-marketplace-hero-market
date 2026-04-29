import { PortalMetricCard } from "@/components/client-portal/PortalMetricCard";
import { PortalTrendChart } from "@/components/client-portal/PortalTrendChart";
import { PortalConversationSummary } from "@/components/client-portal/PortalConversationSummary";
import { deriveWeeklySeries } from "@/lib/revenue-os/client-performance-series";

export function PortalAnalyticsOverview({
  leadsCaptured,
  conversations,
  bookings,
  websiteActivity,
  agentStatus,
  serviceStatus,
  recentConversations,
}: {
  leadsCaptured: number;
  conversations: number;
  bookings: number;
  websiteActivity: number;
  agentStatus: string;
  serviceStatus: string;
  recentConversations: {
    subject: string | null;
    lastMessagePreview: string | null;
    lastMessageAt: string | Date | null;
    channel: string | null;
  }[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <PortalMetricCard label="Leads captured" value={leadsCaptured} />
        <PortalMetricCard label="AI conversations" value={conversations} />
        <PortalMetricCard label="Bookings" value={bookings} />
        <PortalMetricCard label="Website / assistant activity" value={websiteActivity} />
        <PortalMetricCard label="Agent status" value={agentStatus} />
        <PortalMetricCard label="Service status" value={serviceStatus} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <PortalTrendChart title="Leads trend" points={deriveWeeklySeries(leadsCaptured)} />
        <PortalTrendChart title="Conversations trend" points={deriveWeeklySeries(conversations)} />
      </div>
      <PortalConversationSummary items={recentConversations} />
    </div>
  );
}
