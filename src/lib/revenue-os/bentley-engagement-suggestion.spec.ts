import { describe, expect, it } from "@jest/globals";
import { buildBentleyEngagementSuggestion } from "./bentley-engagement-suggestion";
import type { SocialEngagementCapabilities } from "@/lib/social/engagement/social-engagement-capabilities";

const baseCap = (r: boolean): SocialEngagementCapabilities => ({
  canReadComments: true,
  canReplyComments: !r,
  canReadDMs: true,
  canSendDMs: !r,
  canReadMentions: true,
  canAutoRespond: false,
  requiresManualForReplies: r,
  reasons: r ? ["manual path"] : [],
  baseFlags: {
    canPublishText: true,
    canPublishImage: true,
    canPublishCarousel: false,
    canPublishVideo: false,
    canSchedule: true,
    canReadComments: true,
    canReplyComments: !r,
    canReadDMs: true,
    canSendDMs: !r,
    canFetchAnalytics: true,
  },
});

describe("buildBentleyEngagementSuggestion", () => {
  it("classifies obvious spam and sets low urgency", () => {
    const s = buildBentleyEngagementSuggestion({
      text: "Follow me and click here for crypto giveaway",
      sourceType: "comment",
      provider: "instagram",
      capabilities: baseCap(true),
    });
    expect(s.intent).toBe("spam");
    expect(s.urgency).toBe("low");
  });

  it("classifies complaint / negative", () => {
    const s = buildBentleyEngagementSuggestion({
      text: "This is a terrible scam I want a refund",
      sourceType: "comment",
      provider: "meta",
      capabilities: baseCap(true),
    });
    expect(s.intent).toBe("complaint");
    expect(s.sentiment).toBe("negative");
    expect(s.urgency).toBe("high");
  });

  it("sets manualOnlyReason from capabilities", () => {
    const s = buildBentleyEngagementSuggestion({
      text: "What is the price?",
      sourceType: "dm",
      provider: "instagram",
      capabilities: baseCap(true),
    });
    expect(s.manualOnlyReason).toBe("manual path");
    expect(s.suggestedOperatorAction).toContain("native");
  });

  it("draft reply differs when in-app is available vs manual", () => {
    const manual = buildBentleyEngagementSuggestion({
      text: "Thanks",
      sourceType: "comment",
      provider: "x",
      capabilities: baseCap(true),
    });
    const ok = buildBentleyEngagementSuggestion({
      text: "Thanks",
      sourceType: "comment",
      provider: "x",
      capabilities: baseCap(false),
    });
    expect(manual.suggestedDraftReply).toContain("Automated in-app send is off");
    expect(ok.suggestedDraftReply).not.toContain("Automated in-app send is off");
  });
});
