import test from "node:test";
import assert from "node:assert/strict";
import { dashboardFormPatchFromBentleySnapshotIfDiff } from "@/lib/revenue-os/bentley-dashboard-handoff";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { normalizeDashboardFormValues, type RevenueOsDashboardFormValues } from "@/lib/revenue-os/run-revenue-os-analysis";

function emptySnap(over: Partial<BentleySnapshot> = {}): BentleySnapshot {
  return {
    industryKey: "consulting",
    contentIndustry: "Consulting",
    targetAudience: "SMB",
    traffic: 0,
    conversionRate: 0,
    aov: 0,
    businessName: "TROOTHHERTZ",
    coreOffer: "",
    transformation: "",
    platforms: [],
    postingPlatforms: [],
    tone: "Professional",
    contentType: "Full Post",
    imageStyle: "cinematic",
    campaignNotes: "",
    ...over,
  };
}

const handoffLikeForm = (): RevenueOsDashboardFormValues =>
  normalizeDashboardFormValues({
    businessName: "TROOTHHERTZ",
    businessType: "Consulting",
    targetAudience: "Entrepreneurs",
    market: "USA",
    currentMonthlyRevenue: 20_000,
    targetMonthlyRevenue: 100_000,
    avgOrderValue: 4000,
    grossMarginPct: 70,
    monthlyTraffic: 8000,
    conversionRatePct: 1,
    cac: 250,
    ltv: 8000,
    coreOffer: "Offer",
    transformation: "Grow",
    platforms: [],
    postingPlatforms: [],
    tone: "Professional",
    contentTypeFocus: "Full Post",
    imageStyle: "cinematic",
    notes: "Workflow merged notes here",
  });

test("mirror IfDiff does not stomp handoff traffic/conv/AOV with snapshot zeros", () => {
  const form = handoffLikeForm();
  const patch = dashboardFormPatchFromBentleySnapshotIfDiff(emptySnap(), form);
  assert.equal(patch.monthlyTraffic, undefined);
  assert.equal(patch.conversionRatePct, undefined);
  assert.equal(patch.avgOrderValue, undefined);
});

test("mirror IfDiff still pushes real snapshot economics when they differ", () => {
  const form = handoffLikeForm();
  const snap = emptySnap({ traffic: 12_000, conversionRate: 2.5, aov: 600 });
  const patch = dashboardFormPatchFromBentleySnapshotIfDiff(snap, form);
  assert.equal(patch.monthlyTraffic, 12_000);
  assert.equal(patch.conversionRatePct, 2.5);
  assert.equal(patch.avgOrderValue, 600);
});

test("mirror IfDiff does not clear notes with empty snapshot notes", () => {
  const form = handoffLikeForm();
  const patch = dashboardFormPatchFromBentleySnapshotIfDiff(emptySnap(), form);
  assert.equal(patch.notes, undefined);
});

test("mirror IfDiff pushes non-empty snapshot notes", () => {
  const form = handoffLikeForm();
  const snap = emptySnap({ campaignNotes: "From chat" });
  const patch = dashboardFormPatchFromBentleySnapshotIfDiff(snap, form);
  assert.equal(patch.notes, "From chat");
});
