import { buildBentleyCsvImportPayload, leadRawRecordToNormalizedLead, mergeRawPayloadWithCsvImport } from "./csvToPipeline";
import { mapCsvRowToLeadRawRecord } from "./mapCsvRowToLeadRawRecord";
import { foldHeaderKey, normalizeHeaderToCanonical, normalizeCsvHeaderRow } from "./normalizeCsvHeaders";
import { parseCsvText, splitCsvLine } from "./parseCsvText";
import { parseValidateCsvImport } from "./parseCsvImport";
import { generateBentleySliSampleCsv } from "./sampleCsv";
import { parsePlatformValue, validateCsvLeadRow } from "./validateCsvLeadRow";

describe("normalizeCsvHeaders", () => {
  it("folds headers to snake keys", () => {
    expect(foldHeaderKey(" Author Handle ")).toBe("author_handle");
    expect(foldHeaderKey("Comment Text")).toBe("comment_text");
  });

  it("maps aliases to canonical names", () => {
    expect(normalizeHeaderToCanonical("author")).toBe("authorHandle");
    expect(normalizeHeaderToCanonical("body")).toBe("commentText");
    expect(normalizeHeaderToCanonical("postTitle")).toBe("sourceTitle");
    expect(normalizeHeaderToCanonical("link")).toBe("sourceUrl");
    expect(normalizeHeaderToCanonical("timestamp")).toBe("publishedAt");
    expect(normalizeHeaderToCanonical("niche")).toBe("verticalHint");
  });

  it("normalizes a header row list", () => {
    const h = normalizeCsvHeaderRow(["Platform", "comment", "UserName"]);
    expect(h).toEqual(["platform", "commentText", "authorHandle"]);
  });
});

describe("parseCsvText", () => {
  it("splits quoted commas", () => {
    const line = `"a,b","c"`;
    expect(splitCsvLine(line)).toEqual(["a,b", "c"]);
  });

  it("parses header and rows", () => {
    const t = "x,y\n1,2\n3,4\n";
    const p = parseCsvText(t);
    expect(p.headers).toEqual(["x", "y"]);
    expect(p.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});

describe("parseValidateCsvImport", () => {
  it("flags empty file", () => {
    const r = parseValidateCsvImport("   ");
    expect(r.validRows.length).toBe(0);
    expect(r.summary.fileMessages.some((m) => m.text.includes("empty"))).toBe(true);
  });

  it("accepts valid rows and rejects missing platform", () => {
    const csv = `platform,commentText,authorHandle
instagram,"hello world",u1
,comment only,u2
tiktok,"second",u3
`;
    const r = parseValidateCsvImport(csv);
    expect(r.validRows.length).toBe(2);
    expect(r.invalidRows.length).toBe(1);
    expect(r.invalidRows[0].messages.some((m) => m.severity === "error")).toBe(true);
  });

  it("maps unsupported platform to unknown with warning only", () => {
    const csv = `platform,commentText
mars_colony,"need leads"
`;
    const r = parseValidateCsvImport(csv);
    expect(r.validRows.length).toBe(1);
    expect(r.validRows[0].warnings.some((w) => w.includes("Unsupported"))).toBe(true);
    expect(r.validRows[0].record.sourcePlatform).toBe("unknown");
  });
});

describe("mapCsvRowToLeadRawRecord", () => {
  it("builds record with meta", () => {
    const row = {
      platform: "youtube",
      commentText: "test",
      authorHandle: "@bob",
      sourceId: "sid-1",
      verticalHint: "contractor",
      likeCount: "3",
    };
    const rec = mapCsvRowToLeadRawRecord(row, 2);
    expect(rec.sourcePlatform).toBe("youtube");
    expect(rec.commentText).toBe("test");
    expect(rec.authorHandle).toBe("bob");
    expect(rec.sourceId).toBe("sid-1");
    expect(rec.rawMeta?.verticalHint).toBe("contractor");
    expect(rec.rawMeta?.likeCount).toBe(3);
  });
});

describe("csvToPipeline provenance", () => {
  it("attaches bentleyCsvImport to merged raw payload", () => {
    const row = {
      platform: "reddit",
      commentText: "help",
      authorHandle: "u1",
    };
    const rec = mapCsvRowToLeadRawRecord(row, 5);
    const nl = leadRawRecordToNormalizedLead(rec);
    expect(nl.platform).toBe("reddit");
    expect(nl.notes).toContain("help");
    const bentley = buildBentleyCsvImportPayload(rec, {
      fileName: "t.csv",
      importedAt: "2026-01-01T00:00:00.000Z",
      rowNumber: 5,
    });
    expect(bentley.importSource).toBe("csv_upload");
    expect(bentley.fileName).toBe("t.csv");
    expect(bentley.rowNumber).toBe(5);
    const merged = mergeRawPayloadWithCsvImport({ extra: 1 }, bentley);
    expect((merged.bentleyCsvImport as { commentText: string }).commentText).toBe("help");
    expect(merged.extra).toBe(1);
  });
});

describe("generateBentleySliSampleCsv", () => {
  it("includes expected header and multiple platforms", () => {
    const s = generateBentleySliSampleCsv();
    expect(s).toContain("platform,authorHandle,commentText");
    expect(s).toContain("tiktok");
    expect(s).toContain("youtube");
    expect(s).toContain("reddit");
    expect(s).toContain("instagram");
    expect(s).toContain("facebook_public");
    expect(s.endsWith("\n")).toBe(true);
  });
});

describe("validateCsvLeadRow", () => {
  it("requires commentText", () => {
    const msgs = validateCsvLeadRow({ platform: "tiktok" }, 2);
    expect(msgs.some((m) => m.text.includes("commentText") && m.severity === "error")).toBe(true);
  });
});

describe("parsePlatformValue", () => {
  it("maps aliases", () => {
    expect(parsePlatformValue("FB").platform).toBe("facebook_public");
    expect(parsePlatformValue("ig").platform).toBe("instagram");
  });
});
