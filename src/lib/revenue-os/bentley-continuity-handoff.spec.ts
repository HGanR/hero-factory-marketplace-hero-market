/** @jest-environment jsdom */
import {
  BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY,
  buildBentleyDashboardPayload,
  bentleySnapshotPatchFromPersistedDashboardForm,
  bentleySnapshotFromHandoffPayload,
  parseBentleyDashboardPayload,
  serializeBentleyDashboardHandoff,
} from "@/lib/revenue-os/bentley-dashboard-handoff";
import { findSessionValueByKeyPrefix } from "@/lib/revenue-os/bentley-storage-scope";
import {
  getFirstMissingField,
  getWorkflowPhase,
  industryResolved,
  intakeComplete,
  type BentleySnapshot,
} from "@/lib/revenue-os/bentley-orchestrator";
import type { RevenueOsDashboardFormValues } from "@/lib/revenue-os/run-revenue-os-analysis";

function troothertzSampleSnapshot(): BentleySnapshot {
  return {
    industryKey: "consulting",
    contentIndustry: "Consulting",
    targetAudience: "Entrepreneurs",
    traffic: 8000,
    conversionRate: 1,
    aov: 5000,
    businessName: "TROOTHHERTZ",
    coreOffer: "Capital architecture",
    transformation: "Revenue growth",
    platforms: ["TikTok"],
    postingPlatforms: ["tiktok"],
    tone: "Professional",
    contentType: "Full Post",
    imageStyle: "cinematic",
    campaignNotes: "Growth focus",
  };
}

describe("Bentley dashboard handoff continuity", () => {
  it("serializes and parses dashboard payload without losing posting platforms", () => {
    const snap = troothertzSampleSnapshot();
    const payload = buildBentleyDashboardPayload(snap, { autoRunFullAnalysis: true });
    const raw = serializeBentleyDashboardHandoff({ payload });
    const env = parseBentleyDashboardPayload(raw);
    expect(env?.payload).toBeTruthy();
    expect(env!.payload.autoRunFullAnalysis).toBe(true);
    expect(env!.payload.autoRunMode).toBe("full_pipeline");
    const merged = bentleySnapshotFromHandoffPayload(env!.payload);
    expect(merged.postingPlatforms).toContain("tiktok");
    expect(intakeComplete(merged)).toBe(true);
    expect(industryResolved(merged)).toBe(true);
    expect(getFirstMissingField(merged)).not.toBe("industryKey");
  });

  it("hydrates snapshot from persisted dashboard form with industry key guess (no restart at industry)", () => {
    const payload = buildBentleyDashboardPayload(troothertzSampleSnapshot(), { autoRunFullAnalysis: false });
    const form: RevenueOsDashboardFormValues = {
      businessName: payload.businessName,
      businessType: payload.businessType,
      targetAudience: payload.targetAudience,
      market: payload.market,
      currentMonthlyRevenue: payload.currentMonthlyRevenue,
      targetMonthlyRevenue: payload.targetMonthlyRevenue,
      avgOrderValue: payload.avgOrderValue,
      grossMarginPct: payload.grossMarginPct,
      monthlyTraffic: payload.monthlyTraffic,
      conversionRatePct: payload.conversionRatePct,
      cac: payload.cac,
      ltv: payload.ltv,
      coreOffer: payload.coreOffer,
      transformation: payload.transformation,
      platforms: payload.platforms,
      postingPlatforms: payload.postingPlatforms,
      tone: payload.tone,
      contentTypeFocus: payload.contentTypeFocus,
      imageStyle: payload.imageStyle,
      notes: payload.notes,
    };
    const patch = bentleySnapshotPatchFromPersistedDashboardForm(form);
    const merged: BentleySnapshot = {
      industryKey: null,
      contentIndustry: "",
      targetAudience: "",
      traffic: 0,
      conversionRate: 0,
      aov: 0,
      businessName: "",
      coreOffer: "",
      transformation: "",
      platforms: [],
      tone: "Professional",
      contentType: "Full Post",
      imageStyle: "cinematic",
      campaignNotes: "",
      postingPlatforms: [],
      ...patch,
    };
    expect(intakeComplete(merged)).toBe(true);
    expect(industryResolved(merged)).toBe(true);
    expect(getFirstMissingField(merged)).not.toBe("industryKey");
    expect(getWorkflowPhase(merged)).not.toBe("intake");
  });

  it("findSessionValueByKeyPrefix locates handoff under alternate scoped keys", () => {
    sessionStorage.clear();
    const env = { payload: buildBentleyDashboardPayload(troothertzSampleSnapshot()) };
    sessionStorage.setItem(
      `${BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY}::u:alice::c:_`,
      JSON.stringify(env)
    );
    const found = findSessionValueByKeyPrefix(BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY);
    expect(found?.value).toBeTruthy();
    expect(parseBentleyDashboardPayload(found!.value)).not.toBeNull();
  });
});
