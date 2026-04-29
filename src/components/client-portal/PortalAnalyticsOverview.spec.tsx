import { renderToStaticMarkup } from "react-dom/server";
import { PortalAnalyticsOverview } from "@/components/client-portal/PortalAnalyticsOverview";

describe("PortalAnalyticsOverview", () => {
  it("renders key metrics and empty conversations", () => {
    const html = renderToStaticMarkup(
      <PortalAnalyticsOverview
        leadsCaptured={0}
        conversations={0}
        bookings={0}
        websiteActivity={0}
        agentStatus="Inactive"
        serviceStatus="paused"
        recentConversations={[]}
      />,
    );
    expect(html).toContain("Leads captured");
    expect(html).toContain("No conversations yet");
  });

  it("renders conversation rows", () => {
    const html = renderToStaticMarkup(
      <PortalAnalyticsOverview
        leadsCaptured={5}
        conversations={8}
        bookings={2}
        websiteActivity={12}
        agentStatus="Active"
        serviceStatus="active"
        recentConversations={[
          { subject: "Need pricing info", lastMessagePreview: "Can we talk tomorrow?", lastMessageAt: new Date(), channel: "widget" },
        ]}
      />,
    );
    expect(html).toContain("Need pricing info");
  });
});
