import {
  computeClientHealthScoreFromRollup,
  getNextBestClientActionFromContext,
} from "@/lib/revenue-os/client-hub-intelligence";
import type { ClientHubRollup } from "@/lib/revenue-os/client-hub-types";

function baseRoll(partial: Partial<ClientHubRollup> = {}): ClientHubRollup {
  return {
    leadsCaptured: 0,
    conversationsOpened: 0,
    openConversations: 0,
    bookings: 0,
    crmMessagesCount: 0,
    widgetMessagesCount: 0,
    messagesExchanged: 0,
    agentInteractions: 0,
    activeSites: 0,
    activeAgents: 0,
    campaignsLaunched: 0,
    publishedPosts: 0,
    websiteVisits: null,
    lastActivityAt: new Date().toISOString(),
    leadQualifiedCount: 0,
    followUpCount: 0,
    taskCreatedCount: 0,
    bookingScheduledCount: 0,
    ...partial,
  };
}

describe("computeClientHealthScoreFromRollup", () => {
  it("scores higher with pipeline + posts + campaigns", () => {
    const hi = computeClientHealthScoreFromRollup(
      baseRoll({
        leadsCaptured: 10,
        conversationsOpened: 8,
        publishedPosts: 5,
        campaignsLaunched: 2,
        activeSites: 1,
        activeAgents: 1,
        messagesExchanged: 20,
      }),
      { leadsMissingFollowUp: 0, campaignsAnyTotal: 3, automationEventsLast7Days: 2 },
    );
    const lo = computeClientHealthScoreFromRollup(
      baseRoll({
        leadsCaptured: 0,
        openConversations: 4,
        activeSites: 0,
        campaignsLaunched: 0,
        lastActivityAt: new Date(Date.now() - 40 * 864e5).toISOString(),
      }),
      { leadsMissingFollowUp: 3, campaignsAnyTotal: 0, automationEventsLast7Days: 0 },
    );
    expect(hi.score).toBeGreaterThan(lo.score);
    expect(hi.status).toBe("thriving");
    expect(lo.status).toBe("at_risk");
    expect(lo.issues.length).toBeGreaterThan(0);
  });
});

describe("getNextBestClientActionFromContext", () => {
  it("prioritizes open inbox over campaign suggestions", () => {
    const r = getNextBestClientActionFromContext({
      roll: baseRoll({ openConversations: 2, leadsCaptured: 5 }),
      hasPrimarySite: false,
      hasPrimaryAgent: false,
      leadsMissingFollowUp: 4,
      campaignsAnyTotal: 0,
      automationEventsLast7Days: 0,
    });
    expect(r.code).toBe("inbox_open");
  });

  it("suggests follow-up when inbox is clear but leads lack follow-up", () => {
    const r = getNextBestClientActionFromContext({
      roll: baseRoll({ openConversations: 0, leadsCaptured: 3 }),
      hasPrimarySite: true,
      hasPrimaryAgent: true,
      leadsMissingFollowUp: 2,
      campaignsAnyTotal: 1,
      automationEventsLast7Days: 0,
    });
    expect(r.code).toBe("lead_followup");
  });
});
