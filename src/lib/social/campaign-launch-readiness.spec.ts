import { describe, it, expect } from "@jest/globals";
import type { SocialPlatform } from "@/lib/social/config";
import {
  computeLaunchTargetsReadiness,
  getCampaignPostLaunchPresentation,
} from "@/lib/social/campaign-launch-readiness";
import { connectedSocialPlatformsSet } from "@/lib/social/platform-identity";
import type { SocialAccountLite } from "@/lib/social/social-account-public";

describe("computeLaunchTargetsReadiness", () => {
  it("counts manual-only, connect, reconnect, and publish-ready targets", () => {
    const accounts: SocialAccountLite[] = [
      {
        id: "1",
        platform: "linkedin",
        platformCanonical: "linkedin",
        displayName: "Me",
        externalAccountId: "x",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        createdAt: null,
      },
      {
        id: "2",
        platform: "instagram",
        platformCanonical: "instagram",
        displayName: "Ig",
        externalAccountId: "y",
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        createdAt: null,
      },
    ];
    const connected = connectedSocialPlatformsSet(accounts);
    const rows = [{ key: "linkedin" as const }, { key: "instagram" as const }, { key: "tiktok" as const }];
    const r = computeLaunchTargetsReadiness(rows, accounts, connected);
    expect(r.selectedCount).toBe(3);
    expect(r.publishReadyCount).toBe(1);
    expect(r.reconnectRequiredCount).toBe(1);
    expect(r.manualOnlyCount).toBe(1);
    expect(r.connectRequiredCount).toBe(0);
  });
});

describe("getCampaignPostLaunchPresentation", () => {
  const empty = new Set<SocialPlatform>();

  it("manual-only when adapter missing", () => {
    const p = getCampaignPostLaunchPresentation({
      status: "DRAFT",
      platformRaw: "tiktok",
      accounts: [],
      connectedPlatforms: empty,
    });
    expect(p.launchBadge).toBe("Manual only");
    expect(p.serverPublishLine).toContain("off");
    expect(p.nextActionLine).toMatch(/manual|Copy/i);
  });

  it("connect when automated and not linked", () => {
    const p = getCampaignPostLaunchPresentation({
      status: "DRAFT",
      platformRaw: "linkedin",
      accounts: [],
      connectedPlatforms: empty,
    });
    expect(p.launchBadge).toBe("Connect");
    expect(p.publishAvailabilityNote).toMatch(/linked/i);
  });

  it("reconnect when linked but token expired", () => {
    const accounts: SocialAccountLite[] = [
      {
        id: "1",
        platform: "linkedin",
        platformCanonical: "linkedin",
        displayName: "Me",
        externalAccountId: "x",
        expiresAt: new Date(Date.now() - 120_000).toISOString(),
        createdAt: null,
      },
    ];
    const connected = connectedSocialPlatformsSet(accounts);
    const p = getCampaignPostLaunchPresentation({
      status: "DRAFT",
      platformRaw: "linkedin",
      accounts,
      connectedPlatforms: connected,
    });
    expect(p.launchBadge).toBe("Reconnect");
  });

  it("ready when linked and token fresh", () => {
    const accounts: SocialAccountLite[] = [
      {
        id: "1",
        platform: "linkedin",
        platformCanonical: "linkedin",
        displayName: "Me",
        externalAccountId: "x",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        createdAt: null,
      },
    ];
    const connected = connectedSocialPlatformsSet(accounts);
    const p = getCampaignPostLaunchPresentation({
      status: "DRAFT",
      platformRaw: "linkedin",
      accounts,
      connectedPlatforms: connected,
    });
    expect(p.launchBadge).toBe("Ready");
  });

  it("posted and publishing terminal copy", () => {
    const posted = getCampaignPostLaunchPresentation({
      status: "POSTED",
      platformRaw: "linkedin",
      accounts: [],
      connectedPlatforms: empty,
    });
    expect(posted.launchBadge).toBe("Published");
    expect(posted.nextActionLine).toMatch(/live|No further/i);

    const pub = getCampaignPostLaunchPresentation({
      status: "PUBLISHING",
      platformRaw: "linkedin",
      accounts: [],
      connectedPlatforms: empty,
    });
    expect(pub.launchBadge).toBe("Publishing");
    expect(pub.publishAvailabilityNote).toMatch(/progress|Wait/i);
  });
});
