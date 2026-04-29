import { describe, expect, it } from "@jest/globals";
import { resolveSocialEngagementCapabilities } from "./social-engagement-capabilities";

describe("resolveSocialEngagementCapabilities", () => {
  it("uses overrides for comment path and marks manual when reply comments false", () => {
    const cap = resolveSocialEngagementCapabilities({
      provider: "meta",
      socialAccount: { expiresAt: null } as never,
      flagsOverride: { canReadComments: true, canReplyComments: false, canReadDMs: false, canSendDMs: false },
      sourceType: "comment",
    });
    expect(cap.canReadComments).toBe(true);
    expect(cap.canReplyComments).toBe(false);
    expect(cap.canAutoRespond).toBe(false);
    expect(cap.requiresManualForReplies).toBe(true);
    expect(cap.reasons.some((r) => r.includes("In-app comment reply"))).toBe(true);
  });

  it("allows comment replies when canReplyComments is true and source is ad_comment", () => {
    const cap = resolveSocialEngagementCapabilities({
      provider: "meta",
      socialAccount: { expiresAt: new Date(Date.now() + 864e5) } as never,
      flagsOverride: { canReplyComments: true, canReadComments: true, canReadDMs: true, canSendDMs: false },
      sourceType: "ad_comment",
    });
    expect(cap.requiresManualForReplies).toBe(false);
  });

  it("requires manual for DMs when canSendDMs is false", () => {
    const cap = resolveSocialEngagementCapabilities({
      provider: "instagram",
      socialAccount: null,
      flagsOverride: { canSendDMs: false, canReadDMs: true, canReplyComments: true, canReadComments: true },
      sourceType: "dm",
    });
    expect(cap.requiresManualForReplies).toBe(true);
    expect(cap.reasons.some((r) => r.toLowerCase().includes("dm"))).toBe(true);
  });

  it("forces manual when OAuth token is expired", () => {
    const cap = resolveSocialEngagementCapabilities({
      provider: "x",
      socialAccount: { expiresAt: new Date(0) } as never,
      flagsOverride: { canReplyComments: true, canSendDMs: true, canReadComments: true, canReadDMs: true },
      sourceType: "comment",
    });
    expect(cap.requiresManualForReplies).toBe(true);
    expect(cap.reasons.some((r) => r.includes("expired"))).toBe(true);
  });

  it("matches Connected Accounts line: default engagement row shows manual-first when no reply path", () => {
    const cap = resolveSocialEngagementCapabilities({
      provider: "instagram",
      socialAccount: { expiresAt: new Date(Date.now() + 864e5) } as never,
      flagsOverride: { canReadComments: true, canReplyComments: false, canReadDMs: false, canSendDMs: false },
      sourceType: "unknown",
    });
    expect(cap.requiresManualForReplies).toBe(true);
    expect(cap.canReplyComments).toBe(false);
    expect(cap.canSendDMs).toBe(false);
  });

  it("treats canReadMentions as false unless override is set", () => {
    const off = resolveSocialEngagementCapabilities({
      provider: "x",
      socialAccount: { expiresAt: null } as never,
      flagsOverride: { canReadMentions: false, canReplyComments: true, canReadComments: true },
      sourceType: "mention",
    });
    expect(off.canReadMentions).toBe(false);
    const on = resolveSocialEngagementCapabilities({
      provider: "x",
      socialAccount: { expiresAt: null } as never,
      flagsOverride: { canReadMentions: true, canReplyComments: true, canReadComments: true },
      sourceType: "mention",
    });
    expect(on.canReadMentions).toBe(true);
    expect(on.requiresManualForReplies).toBe(false);
  });
});
