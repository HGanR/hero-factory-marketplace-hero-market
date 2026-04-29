/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  getPaidSocialOptimizationSignalConfig,
  PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS_ENV,
  PAID_SOCIAL_LOW_CTR_THRESHOLD_ENV,
  PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR_ENV,
  PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS_DEFAULT,
  PAID_SOCIAL_LOW_CTR_THRESHOLD_DEFAULT,
  PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR_DEFAULT,
} from "@/lib/social/paid-social-optimization-signal-config";

describe("getPaidSocialOptimizationSignalConfig", () => {
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    prev[PAID_SOCIAL_LOW_CTR_THRESHOLD_ENV] = process.env[PAID_SOCIAL_LOW_CTR_THRESHOLD_ENV];
    prev[PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS_ENV] = process.env[PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS_ENV];
    prev[PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR_ENV] = process.env[PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR_ENV];
    delete process.env[PAID_SOCIAL_LOW_CTR_THRESHOLD_ENV];
    delete process.env[PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS_ENV];
    delete process.env[PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR_ENV];
  });

  afterEach(() => {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("uses defaults when env unset", () => {
    const c = getPaidSocialOptimizationSignalConfig();
    expect(c.lowCtrThreshold).toBe(PAID_SOCIAL_LOW_CTR_THRESHOLD_DEFAULT);
    expect(c.lowCtrMinImpressions).toBe(PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS_DEFAULT);
    expect(c.spendWithoutClicksMinSpendMinor).toBe(PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR_DEFAULT);
  });

  it("parses env and clamps out-of-range values", () => {
    process.env[PAID_SOCIAL_LOW_CTR_THRESHOLD_ENV] = "2";
    process.env[PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS_ENV] = "999999999";
    process.env[PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR_ENV] = "0";
    const c = getPaidSocialOptimizationSignalConfig();
    expect(c.lowCtrThreshold).toBe(0.5);
    expect(c.lowCtrMinImpressions).toBe(1_000_000);
    expect(c.spendWithoutClicksMinSpendMinor).toBe(1);
  });

  it("accepts valid overrides", () => {
    process.env[PAID_SOCIAL_LOW_CTR_THRESHOLD_ENV] = "0.01";
    process.env[PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS_ENV] = "50";
    process.env[PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR_ENV] = "100";
    const c = getPaidSocialOptimizationSignalConfig();
    expect(c.lowCtrThreshold).toBe(0.01);
    expect(c.lowCtrMinImpressions).toBe(50);
    expect(c.spendWithoutClicksMinSpendMinor).toBe(100);
  });
});
