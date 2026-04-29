/**
 * @jest-environment node
 */

import {
  isPlatformRoleRoutingIntent,
  formatBentleyPlatformRoleRoutingReply,
} from "@/lib/revenue-os/bentley-platform-role-routing-chat";
import { derivePlatformRoleRouting } from "@/lib/revenue-os/platform-role-routing";

describe("bentley-platform-role-routing-chat", () => {
  it("detects role-focused platform questions", () => {
    expect(isPlatformRoleRoutingIntent("Which platform should I use for awareness?")).toBe(true);
    expect(isPlatformRoleRoutingIntent("Which platform is best for engagement")).toBe(true);
    expect(isPlatformRoleRoutingIntent("Where should I post for authority")).toBe(true);
    expect(isPlatformRoleRoutingIntent("Which channel should get the next batch")).toBe(true);
    expect(isPlatformRoleRoutingIntent("What platform should I focus on")).toBe(true);
  });

  it("does not steal generic campaign performance intents", () => {
    expect(isPlatformRoleRoutingIntent("How did my campaign do")).toBe(false);
    expect(isPlatformRoleRoutingIntent("Deployment feedback summary")).toBe(false);
  });

  it("formats a role reply with confidence and next action", () => {
    const routing = derivePlatformRoleRouting({
      deploymentRollup: {
        publishedCount: 2,
        failedCount: 0,
        retryCount: 0,
        latestPublishedAt: null,
        hasPerformanceMetrics: true,
        attentionSignalStrength: "promising",
        recommendationHints: [],
        bestAttentionPlatform: "instagram",
        bestEngagementPlatform: "linkedin",
        comparisonConfidence: "high",
      },
      memorySummary: null,
    });
    const text = formatBentleyPlatformRoleRoutingReply({
      message: "What platform should I focus on",
      routing,
    });
    expect(text).toMatch(/Platform roles/);
    expect(text).toMatch(/attention/i);
    expect(text).toMatch(/engagement/i);
    expect(text).toMatch(/confidence/);
    expect(text).toMatch(/Next action/i);
  });
});
