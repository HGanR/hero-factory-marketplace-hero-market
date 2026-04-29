import type { BentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/contentBundleHandoffTypes";
import { buildBentleyHandoffFingerprint, buildBentleyMarketIntelligenceMarker } from "./bentley-generation-context";
import { buildBentleyGenerationContext } from "./buildBentleyGenerationContext";
import {
  appendBentleyMarketSectionToLegacyNotesIfMissing,
  legacyNotesAlreadyContainBentleySection,
} from "./mergeBentleyHandoffIntoGenerationInput";
import { resolveBentleyHandoffForGeneration } from "./resolveBentleyHandoffForGeneration";
import { loadBentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/loadBentleyContentBundleHandoff";

jest.mock("@/lib/bentley-social-leads/handoff/loadBentleyContentBundleHandoff", () => ({
  loadBentleyContentBundleHandoff: jest.fn(),
}));

const mockHandoff = (over: Partial<BentleyContentBundleHandoff> = {}): BentleyContentBundleHandoff => ({
  source: "bentley_sli",
  schemaVersion: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  basedOnFilteredRowCount: 3,
  filtersApplied: {
    filterPlatform: "",
    filterAccess: "",
    filterOppMin: 0,
    filterBuyerIntent: "",
    filterWebsite: "",
    filterEmail: "",
    filterNextMove: "",
    filterPreset: "",
    filterQueue: "",
    filterCalibration: "",
    filterFeedback: "",
    filterProductivity: "",
    filterHandoff: "",
    segmentDrilldown: null,
  },
  provenance: {
    uploadId: null,
    runId: null,
    uploadSourceType: null,
    uploadFilename: null,
    csvImportFileName: null,
    csvValidRowsImported: null,
    totalRunRowCount: 10,
    filteredLeadRecordIds: [],
    filteredAnalysisIds: [],
  },
  platformsInvolved: ["x"],
  topPainThemes: [{ theme: "time", count: 2 }],
  marketSummary: "SMBs want faster leads.",
  hooks: ["Hook A", "Hook B"],
  ctaAngles: ["CTA 1"],
  offerAngles: ["Offer 1"],
  objections: [{ text: "Too expensive", count: 1 }],
  pillars: ["Trust"],
  whatToPostNext: ["Post a proof post"],
  engineBatchSummary: {
    totalLeads: 10,
    avgIntentScore0To100: 50,
    avgConfidence0To1: 0.5,
    byPlatform: {},
    byPainType: {},
    byUrgency: {},
    byCommercialStage: {},
    byHandoffReadiness: {},
  },
  contentInsightsSchemaVersion: 1,
  ...over,
});

describe("buildBentleyGenerationContext", () => {
  it("preserves user notes and leaves Bentley null when no handoff", () => {
    const ctx = buildBentleyGenerationContext({
      userNotes: "  my notes  ",
      handoff: null,
      resolvedFrom: "none",
    });
    expect(ctx.userNotesOriginal).toBe("  my notes  ");
    expect(ctx.bentleyHandoff).toBeNull();
    expect(ctx.bentleyMarketIntelligence).toBeNull();
    expect(ctx.bentleyReadableNotesBlock).toBe("");
  });

  it("includes structured intelligence when handoff present", () => {
    const h = mockHandoff({ handoffId: "abc-uuid-1234" });
    const ctx = buildBentleyGenerationContext({
      userNotes: "x",
      handoff: h,
      resolvedFrom: "request_payload",
    });
    expect(ctx.bentleyMarketIntelligence?.marketSummary).toContain("SMBs");
    expect(ctx.bentleyReadableNotesBlock.length).toBeGreaterThan(20);
  });
});

describe("appendBentleyMarketSectionToLegacyNotesIfMissing", () => {
  const h = mockHandoff({ handoffId: "id-1" });
  const block = "## Market\nhello";

  it("does not duplicate when marker already present", () => {
    const marker = buildBentleyMarketIntelligenceMarker("id-1");
    const once = appendBentleyMarketSectionToLegacyNotesIfMissing(`before\n---\n${marker}\n---\n\nx`, h, block);
    const twice = appendBentleyMarketSectionToLegacyNotesIfMissing(once, h, block);
    expect(twice).toBe(once);
  });

  it("appends once when absent", () => {
    const out = appendBentleyMarketSectionToLegacyNotesIfMissing("user only", h, block);
    expect(out).toContain("user only");
    expect(out).toContain(buildBentleyMarketIntelligenceMarker("id-1"));
    expect(out).toContain("## Market");
  });
});

describe("legacyNotesAlreadyContainBentleySection", () => {
  it("detects by handoff id marker", () => {
    const m = buildBentleyMarketIntelligenceMarker("hid");
    expect(legacyNotesAlreadyContainBentleySection(`foo ${m} bar`, "hid")).toBe(true);
  });
});

describe("buildBentleyHandoffFingerprint", () => {
  it("changes when handoff id changes", () => {
    const a = buildBentleyHandoffFingerprint(mockHandoff({ handoffId: "a" }));
    const b = buildBentleyHandoffFingerprint(mockHandoff({ handoffId: "b" }));
    expect(a).not.toBe(b);
  });
});

describe("resolveBentleyHandoffForGeneration", () => {
  const load = loadBentleyContentBundleHandoff as jest.MockedFunction<typeof loadBentleyContentBundleHandoff>;

  beforeEach(() => {
    load.mockReset();
  });

  it("returns none when useBentleyIntelligence is false", async () => {
    const r = await resolveBentleyHandoffForGeneration({ useBentleyIntelligence: false }, 1);
    expect(r.handoff).toBeNull();
    expect(r.resolvedFrom).toBe("none");
    expect(load).not.toHaveBeenCalled();
  });

  it("prefers DB id over inline payload when both present", async () => {
    const dbHandoff = mockHandoff({ handoffId: "db-id", marketSummary: "from db" });
    const inlineHandoff = mockHandoff({ handoffId: "inline-id", marketSummary: "from inline" });
    load.mockResolvedValueOnce(dbHandoff);

    const r = await resolveBentleyHandoffForGeneration(
      {
        bentleyHandoffId: "db-id",
        bentleySliContentHandoff: inlineHandoff,
      },
      42
    );

    expect(r.resolvedFrom).toBe("handoff_id_db");
    expect(r.handoff?.marketSummary).toBe("from db");
    expect(load).toHaveBeenCalledWith({ userId: 42, handoffId: "db-id" });
  });

  it("falls back to request payload when id load fails", async () => {
    const inlineHandoff = mockHandoff({ marketSummary: "inline" });
    load.mockResolvedValueOnce(null);

    const r = await resolveBentleyHandoffForGeneration(
      {
        bentleyHandoffId: "missing",
        bentleySliContentHandoff: inlineHandoff,
      },
      1
    );

    expect(r.resolvedFrom).toBe("request_payload");
    expect(r.handoff?.marketSummary).toBe("inline");
  });

  it("uses payload when userId missing (cannot load by id)", async () => {
    const inlineHandoff = mockHandoff();
    load.mockResolvedValueOnce(null);

    const r = await resolveBentleyHandoffForGeneration(
      {
        bentleyHandoffId: "some-id",
        bentleySliContentHandoff: inlineHandoff,
      },
      null
    );

    expect(r.resolvedFrom).toBe("request_payload");
    expect(load).not.toHaveBeenCalled();
  });
});
