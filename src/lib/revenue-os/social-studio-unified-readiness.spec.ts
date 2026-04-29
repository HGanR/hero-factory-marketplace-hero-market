import type { SocialAccountRow } from "@/lib/db/schema";
import { resolveStudioPublishReadiness } from "@/lib/revenue-os/social-studio-unified-readiness";

function liAccount(over: Partial<SocialAccountRow> = {}): SocialAccountRow {
  return {
    id: "acc-li",
    userId: "u1",
    clientId: "c1",
    platform: "linkedin",
    authType: "OAUTH",
    accessTokenEnc: null,
    refreshTokenEnc: null,
    expiresAt: null,
    externalAccountId: "x",
    scopes: "w_member_social",
    displayName: "LI",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as SocialAccountRow;
}

function baseArgs(over: Partial<Parameters<typeof resolveStudioPublishReadiness>[0]> = {}) {
  return {
    targetPlatform: "linkedin",
    socialAccount: null,
    postMode: "draft" as const,
    scheduledAtIso: null,
    campaignAssetId: null,
    assetCreativeType: "IMAGE" as const,
    hasHostedHttpsAssetUrl: true,
    treatAsHasStorageUrlForValidation: true,
    connectedAccountRows: [] as { platform: string; platformCanonical?: "linkedin" | null }[],
    governanceRequiresApproval: false,
    ...over,
  };
}

describe("resolveStudioPublishReadiness", () => {
  it("requiresManual when no OAuth and linkedin (manual_export from publishMode)", () => {
    const r = resolveStudioPublishReadiness(
      baseArgs({ targetPlatform: "linkedin" })
    );
    expect(r.requiresManual).toBe(true);
    expect(r.publishMode.mode).toBe("manual_export");
    expect(r.canPublishNow).toBe(false);
  });

  it("direct mode with connected + matching account: canSchedule / publish flags follow promote readiness", () => {
    const r = resolveStudioPublishReadiness(
      baseArgs({
        connectedAccountRows: [{ platform: "linkedin" }],
        socialAccount: {
          id: "a1",
          userId: "u1",
          clientId: "c1",
          platform: "linkedin",
        } as unknown as Parameters<typeof resolveStudioPublishReadiness>[0]["socialAccount"] extends infer T
          ? T extends { id: string }
            ? T
            : never
          : never,
        campaignAssetId: "asset-1",
        postMode: "schedule",
        scheduledAtIso: new Date("2030-01-01T12:00:00Z").toISOString(),
      })
    );
    expect(r.publishMode.mode).toBe("direct");
    expect(r.requiresManual).toBe(false);
    expect(r.canSchedule).toBe(true);
  });

  it("TikTok is manual (manualOnlyPlatform)", () => {
    const r = resolveStudioPublishReadiness(
      baseArgs({
        targetPlatform: "tiktok",
        connectedAccountRows: [{ platform: "tiktok" }],
        socialAccount: liAccount({
          id: "tt-1",
          platform: "tiktok",
        }),
        campaignAssetId: "x",
      })
    );
    expect(r.requiresManual).toBe(true);
    expect(r.canPublishNow).toBe(false);
  });

  it("flags governance approval in reasons and requiresApproval", () => {
    const r = resolveStudioPublishReadiness(baseArgs({ governanceRequiresApproval: true }));
    expect(r.requiresApproval).toBe(true);
    expect(
      r.reasons.some((s) => s.toLowerCase().includes("approval"))
    ).toBe(true);
  });
});
