import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBentleyDashboardPayload,
  hasMinimumFieldsForDashboard,
  parseBentleyDashboardPayload,
  serializeBentleyDashboardHandoff,
} from "@/lib/revenue-os/bentley-dashboard-handoff";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { BENTLEY_DASHBOARD_HANDOFF_VERSION } from "@/lib/revenue-os/bentley-dashboard-types";
import {
  coerceTrimmedString,
  dashboardIndustryHead,
  dashboardIndustryOfferType,
  normalizeBentleyDashboardHandoffPayload,
  sanitizeBentleySnapshotFromStorage,
} from "@/lib/revenue-os/bentley-string-coerce";

test("coerceTrimmedString handles non-string values before trim", () => {
  assert.equal(coerceTrimmedString(42), "42");
  assert.equal(coerceTrimmedString(null), "");
  assert.equal(coerceTrimmedString(undefined, "x"), "x");
});

test("buildBentleyDashboardPayload tolerates numeric snapshot string fields", () => {
  const snap = {
    industryKey: "consulting" as const,
    contentIndustry: 123 as unknown as string,
    targetAudience: "Entrepreneurs",
    traffic: 8000,
    conversionRate: 1,
    aov: 5000,
    businessName: 999 as unknown as string,
    coreOffer: "Offer",
    transformation: "Outcome",
    platforms: ["TikTok"],
    postingPlatforms: ["tiktok" as const],
    tone: "Professional",
    contentType: "Full Post",
    imageStyle: "cinematic",
    campaignNotes: "",
  } as BentleySnapshot;

  const payload = buildBentleyDashboardPayload(snap);
  assert.equal(payload.businessName, "999");
  assert.equal(payload.contentIndustry, "123");
  assert.equal(hasMinimumFieldsForDashboard(payload), true);
});

test("parseBentleyDashboardPayload normalizes corrupt JSON string fields", () => {
  const raw = serializeBentleyDashboardHandoff({
    payload: normalizeBentleyDashboardHandoffPayload({
      v: BENTLEY_DASHBOARD_HANDOFF_VERSION,
      createdAt: new Date().toISOString(),
      businessName: 777 as unknown as string,
      industryKey: "consulting",
      contentIndustry: 456 as unknown as string,
      businessType: "Consulting",
      targetAudience: "Founders",
      market: "USA",
      currentMonthlyRevenue: 20000,
      targetMonthlyRevenue: 100000,
      grossMarginPct: 70,
      monthlyTraffic: 8000,
      conversionRatePct: 1,
      avgOrderValue: 5000,
      cac: 250,
      ltv: 10000,
      coreOffer: "Offer",
      transformation: "Outcome",
      platforms: ["TikTok"],
      postingPlatforms: ["tiktok"],
      tone: "Professional",
      contentTypeFocus: "Full Post",
      imageStyle: "cinematic",
      notes: "",
      autoRunFullAnalysis: false,
    }),
  });

  const env = parseBentleyDashboardPayload(raw);
  assert.equal(env?.payload.businessName, "777");
  assert.equal(env?.payload.contentIndustry, "456");
});

test("sanitizeBentleySnapshotFromStorage coerces persisted snapshot fields", () => {
  const patch = sanitizeBentleySnapshotFromStorage({
    businessName: 101 as unknown as string,
    contentIndustry: 202 as unknown as string,
    targetAudience: "Audience",
  });
  assert.equal(patch.businessName, "101");
  assert.equal(patch.contentIndustry, "202");
});

test("dashboardIndustryHead splits numeric businessType safely", () => {
  assert.equal(dashboardIndustryHead(42), "42");
  assert.equal(dashboardIndustryHead("Consulting / Advisory"), "Consulting");
  assert.equal(dashboardIndustryOfferType("Consulting / Advisory"), "Advisory");
  assert.equal(dashboardIndustryOfferType(99), undefined);
});
