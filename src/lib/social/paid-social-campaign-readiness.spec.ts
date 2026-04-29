import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  derivePaidSocialCampaignReadiness,
  isPaidSocialProviderLaunchImplemented,
  paidSocialProviderDisplayLabel,
} from "@/lib/social/paid-social-campaign-readiness";

const FLAG_ENV = "PAID_SOCIAL_META_ADS_EXECUTION_ENABLED";

describe("derivePaidSocialCampaignReadiness", () => {
  const base = {
    provider: "meta_ads" as const,
    objective: "traffic",
    budgetType: "daily",
    budgetAmountMinor: 5000,
    destinationUrl: "https://example.com/landing",
    placements: ["instagram_feed"] as string[],
    creative: { primaryAssetIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] },
  };

  const metaOk = {
    metaAdAccountId: "123456789",
    metaPageId: "987654321",
    metaLaunchStatus: "idle",
    remoteMetaCampaignId: null as string | null,
    primaryAssetCreativeType: "IMAGE",
    primaryAssetHasPublicImageUrl: true,
  };

  let prevFlag: string | undefined;

  beforeEach(() => {
    prevFlag = process.env[FLAG_ENV];
    delete process.env[FLAG_ENV];
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[FLAG_ENV];
    else process.env[FLAG_ENV] = prevFlag;
  });

  it("marks structurally complete when required fields are present", () => {
    const r = derivePaidSocialCampaignReadiness({ ...base, metaExecution: metaOk });
    expect(r.structurallyComplete).toBe(true);
    expect(r.structurallyBlockedReasons).toHaveLength(0);
  });

  it("blocks launch for meta_ads when feature flag is off", () => {
    const r = derivePaidSocialCampaignReadiness({ ...base, metaExecution: metaOk });
    expect(isPaidSocialProviderLaunchImplemented("meta_ads")).toBe(false);
    expect(r.launchEligible).toBe(false);
    expect(r.launchBlockedReasons).toContain("meta_ads_launch_feature_disabled");
    expect(r.launchBlockedReasons).not.toContain("provider_not_launchable_yet");
  });

  it("allows launch eligible when flag on and meta v1 requirements met", () => {
    process.env[FLAG_ENV] = "1";
    const r = derivePaidSocialCampaignReadiness({ ...base, metaExecution: metaOk });
    expect(isPaidSocialProviderLaunchImplemented("meta_ads")).toBe(true);
    expect(r.launchEligible).toBe(true);
    expect(r.launchBlockedReasons).not.toContain("meta_ads_launch_feature_disabled");
  });

  it("blocks when ad account missing (flag on)", () => {
    process.env[FLAG_ENV] = "true";
    const r = derivePaidSocialCampaignReadiness({
      ...base,
      metaExecution: { ...metaOk, metaAdAccountId: null },
    });
    expect(r.launchEligible).toBe(false);
    expect(r.launchBlockedReasons).toContain("missing_meta_ad_account");
  });

  it("blocks unsupported objective when flag on", () => {
    process.env[FLAG_ENV] = "1";
    const r = derivePaidSocialCampaignReadiness({
      ...base,
      objective: "leads",
      metaExecution: metaOk,
    });
    expect(r.launchEligible).toBe(false);
    expect(r.launchBlockedReasons).toContain("unsupported_objective_for_meta_launch");
  });

  it("blocks unsupported creative when not IMAGE or no URL (flag on)", () => {
    process.env[FLAG_ENV] = "1";
    const r = derivePaidSocialCampaignReadiness({
      ...base,
      metaExecution: { ...metaOk, primaryAssetCreativeType: "VIDEO", primaryAssetHasPublicImageUrl: true },
    });
    expect(r.launchEligible).toBe(false);
    expect(r.launchBlockedReasons).toContain("unsupported_creative_for_meta_launch");
  });

  it("blocks already launched remote id (flag on)", () => {
    process.env[FLAG_ENV] = "1";
    const r = derivePaidSocialCampaignReadiness({
      ...base,
      metaExecution: { ...metaOk, remoteMetaCampaignId: "cmp_1" },
    });
    expect(r.launchEligible).toBe(false);
    expect(r.launchBlockedReasons).toContain("already_launched");
  });

  it("blocks launch in progress (flag on)", () => {
    process.env[FLAG_ENV] = "1";
    const r = derivePaidSocialCampaignReadiness({
      ...base,
      metaExecution: { ...metaOk, metaLaunchStatus: "launching" },
    });
    expect(r.launchEligible).toBe(false);
    expect(r.launchBlockedReasons).toContain("launch_in_progress");
  });

  it("reports missing_objective when objective empty", () => {
    const r = derivePaidSocialCampaignReadiness({ ...base, objective: "", metaExecution: metaOk });
    expect(r.structurallyComplete).toBe(false);
    expect(r.structurallyBlockedReasons).toContain("missing_objective");
  });

  it("reports missing_budget when type none or amount invalid", () => {
    const r = derivePaidSocialCampaignReadiness({ ...base, budgetType: "none", metaExecution: metaOk });
    expect(r.structurallyBlockedReasons).toContain("missing_budget");
  });

  it("reports missing_destination for bad URL", () => {
    const r = derivePaidSocialCampaignReadiness({ ...base, destinationUrl: "not-a-url", metaExecution: metaOk });
    expect(r.structurallyBlockedReasons).toContain("missing_destination");
  });

  it("reports missing_placements when list empty", () => {
    const r = derivePaidSocialCampaignReadiness({ ...base, placements: [], metaExecution: metaOk });
    expect(r.structurallyBlockedReasons).toContain("missing_placements");
  });

  it("allows creative via referenceOrganicPostId without assets", () => {
    const r = derivePaidSocialCampaignReadiness({
      ...base,
      creative: { primaryAssetIds: [], referenceOrganicPostId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      metaExecution: metaOk,
    });
    expect(r.structurallyBlockedReasons).not.toContain("missing_creative");
  });

  it("reports missing_creative when no asset and no reference post", () => {
    const r = derivePaidSocialCampaignReadiness({
      ...base,
      creative: {},
      metaExecution: metaOk,
    });
    expect(r.structurallyBlockedReasons).toContain("missing_creative");
  });

  it("adds provider_not_launchable_yet for non-meta providers", () => {
    const r = derivePaidSocialCampaignReadiness({
      ...base,
      provider: "other_provider",
      metaExecution: undefined,
    });
    expect(r.launchBlockedReasons).toContain("provider_not_launchable_yet");
  });
});

describe("paidSocialProviderDisplayLabel", () => {
  let prevFlag: string | undefined;

  beforeEach(() => {
    prevFlag = process.env[FLAG_ENV];
    delete process.env[FLAG_ENV];
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[FLAG_ENV];
    else process.env[FLAG_ENV] = prevFlag;
  });

  it("mentions launch disabled when flag off", () => {
    expect(paidSocialProviderDisplayLabel("meta_ads").toLowerCase()).toContain("launch disabled");
  });

  it("mentions narrow launch when flag on", () => {
    process.env[FLAG_ENV] = "1";
    expect(paidSocialProviderDisplayLabel("meta_ads").toLowerCase()).toContain("narrow launch");
  });
});
