import type { ContentInsightsBatch } from "../engine/domainTypes";
import type { EngineLeadBatchSummary } from "../engine/domainTypes";
import type { LeadAnalysisRow } from "../queryTypes";
import { buildContentBundleHandoff } from "./buildContentBundleHandoff";
import { buildBentleyContentBundleReadableNotes, serializeContentBundleHandoff } from "./serializeContentBundleHandoff";

const minimalInsights = (over?: Partial<ContentInsightsBatch>): ContentInsightsBatch => ({
  schemaVersion: 1,
  topRecurringPainThemes: [{ theme: "lead_generation", count: 2 }],
  hookIdeas: ["Hook A"],
  topObjections: [{ text: "Too expensive", count: 1 }],
  ctaAngles: ["Book a call"],
  offerAngles: ["Audit"],
  contentPillars: ["Trust"],
  marketSummary: "Market wants clarity.",
  whatToPostNext: ["Post about X"],
  generatedAt: "2026-04-01T00:00:00.000Z",
  ...over,
});

const minimalEngine = (): EngineLeadBatchSummary => ({
  totalLeads: 2,
  avgIntentScore0To100: 55,
  avgConfidence0To1: 0.5,
  byPlatform: { instagram: 2 },
  byPainType: { lead_generation: 2 },
  byUrgency: { medium: 2 },
  byCommercialStage: { problem_aware: 2 },
  byHandoffReadiness: { review_needed: 2 },
});

const minimalRow = (id: string, aid: string): LeadAnalysisRow =>
  ({
    leadRecordId: id,
    analysisId: aid,
    platform: "instagram",
  }) as LeadAnalysisRow;

describe("buildContentBundleHandoff", () => {
  it("builds deterministic payload with provenance and filters", () => {
    const rows = [minimalRow("lr1", "a1"), minimalRow("lr2", "a2")];
    const h = buildContentBundleHandoff({
      insights: minimalInsights(),
      engineSummary: minimalEngine(),
      filteredRows: rows,
      totalRunRowCount: 3,
      filtersApplied: {
        filterPlatform: "insta",
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
        uploadId: "up-1",
        runId: "run-1",
        uploadSourceType: "csv_sli",
        uploadFilename: "x.csv",
        csvImportFileName: "x.csv",
        csvValidRowsImported: 3,
        totalRunRowCount: 3,
        filteredLeadRecordIds: ["lr1", "lr2"],
        filteredAnalysisIds: ["a1", "a2"],
      },
      createdAt: "2026-04-02T12:00:00.000Z",
    });

    expect(h.source).toBe("bentley_sli");
    expect(h.schemaVersion).toBe(1);
    expect(h.basedOnFilteredRowCount).toBe(2);
    expect(h.provenance.uploadId).toBe("up-1");
    expect(h.provenance.filteredLeadRecordIds).toEqual(["lr1", "lr2"]);
    expect(h.platformsInvolved).toEqual(["instagram"]);
    expect(h.engineBatchSummary.totalLeads).toBe(2);
  });
});

describe("serializeContentBundleHandoff + readable notes", () => {
  it("round-trips JSON and includes provenance in notes", () => {
    const rows = [minimalRow("lr1", "a1")];
    const h = buildContentBundleHandoff({
      insights: minimalInsights(),
      engineSummary: minimalEngine(),
      filteredRows: rows,
      totalRunRowCount: 1,
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
        runId: "r1",
        uploadSourceType: "paste",
        uploadFilename: "paste.txt",
        csvImportFileName: null,
        csvValidRowsImported: null,
        totalRunRowCount: 1,
        filteredLeadRecordIds: ["lr1"],
        filteredAnalysisIds: ["a1"],
      },
    });

    const json = serializeContentBundleHandoff(h);
    const parsed = JSON.parse(json) as typeof h;
    expect(parsed.marketSummary).toBe(h.marketSummary);

    const notes = buildBentleyContentBundleReadableNotes(h);
    expect(notes.compactMarkdown).toContain("Bentley SLI");
    expect(notes.compactMarkdown).toContain("r1");
    expect(notes.singleBlock).toContain("Market wants clarity");
  });
});
