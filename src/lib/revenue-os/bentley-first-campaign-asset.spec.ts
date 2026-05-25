import test from "node:test";
import assert from "node:assert/strict";
import { buildFirstCampaignDraft } from "@/lib/revenue-os/bentley-first-campaign-asset";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { RevenueOsDashboardFormValues } from "@/lib/revenue-os/run-revenue-os-analysis";

const baseForm: RevenueOsDashboardFormValues = {
  businessName: "Acme",
  businessType: "Consulting",
  targetAudience: "Founders",
  market: "USA",
  currentMonthlyRevenue: 10000,
  targetMonthlyRevenue: 50000,
  avgOrderValue: 5000,
  grossMarginPct: 70,
  monthlyTraffic: 5000,
  conversionRatePct: 1,
  cac: 200,
  ltv: 8000,
  coreOffer: "Advisory",
  transformation: "Scale",
  platforms: ["LinkedIn"],
  postingPlatforms: ["linkedin"],
  tone: "Professional",
  contentTypeFocus: "Full Post",
  imageStyle: "cinematic",
  notes: "",
};

test("buildFirstCampaignDraft tolerates numeric content-engine string fields", () => {
  const ce = {
    fullPost: {
      caption: 101 as unknown as string,
      hashtags: [202 as unknown as string, "#tag"],
      visualPrompt: 303 as unknown as string,
    },
    captions: {
      hook: 404 as unknown as string,
      authority: 505 as unknown as string,
    },
    hooks: [606 as unknown as string],
    imagePrompts: [707 as unknown as string],
  } as ContentEngineOutput;

  const draft = buildFirstCampaignDraft("linkedin", ce, baseForm, null);
  assert.match(draft.captionForPublish, /101/);
  assert.match(draft.hashtags ?? "", /#202/);
  assert.ok(draft.preview.length > 0);
});
