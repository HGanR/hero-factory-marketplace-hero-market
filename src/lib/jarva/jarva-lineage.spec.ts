import { describe, expect, it } from "@jest/globals";
import { buildFieldExplainabilityMap, findLastApplyMetadataForField, type JarvaLineageEntry } from "./jarva-lineage";

function entry(p: Partial<JarvaLineageEntry> & Pick<JarvaLineageEntry, "id" | "at" | "messageSnippet" | "extractedFieldKeys">): JarvaLineageEntry {
  return {
    targets: ["jarva_intake"],
    ...p,
  };
}

describe("findLastApplyMetadataForField", () => {
  it("returns the newest apply row that lists the field", () => {
    const lineage: JarvaLineageEntry[] = [
      entry({
        id: "a1",
        at: "2020-01-01T00:00:00.000Z",
        messageSnippet: "chat",
        extractedFieldKeys: ["grantor.name"],
        applyKind: "chat_extraction",
      }),
      entry({
        id: "a2",
        at: "2020-01-02T00:00:00.000Z",
        messageSnippet: "apply1",
        extractedFieldKeys: ["grantor.name", "governingState"],
        applyKind: "manual_apply",
      }),
      entry({
        id: "a3",
        at: "2020-01-03T00:00:00.000Z",
        messageSnippet: "apply2",
        extractedFieldKeys: ["trustee.name"],
        applyKind: "auto_apply",
      }),
    ];
    const g = findLastApplyMetadataForField(lineage, "grantor.name");
    expect(g?.id).toBe("a2");
    expect(g?.kind).toBe("manual_apply");
    const t = findLastApplyMetadataForField(lineage, "trustee.name");
    expect(t?.id).toBe("a3");
  });

  it("ignores apply rows with empty extractedFieldKeys (legacy)", () => {
    const lineage: JarvaLineageEntry[] = [
      entry({
        id: "legacy",
        at: "2020-01-01T00:00:00.000Z",
        messageSnippet: "(apply)",
        extractedFieldKeys: [],
        applyKind: "auto_apply",
      }),
    ];
    expect(findLastApplyMetadataForField(lineage, "grantor.name")).toBeUndefined();
  });
});

describe("buildFieldExplainabilityMap", () => {
  it("sets per-field apply metadata and keeps shared applyTimestamp fallback", () => {
    const lineage: JarvaLineageEntry[] = [
      entry({
        id: "chat",
        at: "2020-01-01T12:00:00.000Z",
        messageSnippet: "I live in TX",
        extractedFieldKeys: ["grantor.name", "grantor.state"],
        applyKind: "chat_extraction",
        fieldConfidence: { "grantor.name": "high", "grantor.state": "high" },
      }),
      entry({
        id: "apply",
        at: "2020-01-02T12:00:00.000Z",
        messageSnippet: "(manual apply)",
        extractedFieldKeys: ["grantor.name", "grantor.state"],
        applyKind: "manual_apply",
      }),
    ];
    const m = buildFieldExplainabilityMap(lineage);
    expect(m["grantor.name"]?.applyTimestamp).toBe("2020-01-02T12:00:00.000Z");
    expect(m["grantor.name"]?.lastApplyTimestampForField).toBe("2020-01-02T12:00:00.000Z");
    expect(m["grantor.name"]?.lastApplyKindForField).toBe("manual_apply");
    expect(m["grantor.name"]?.lastApplyLineageEntryId).toBe("apply");
    expect(m["grantor.name"]?.sourceApplyKind).toBe("chat_extraction");
  });

  it("leaves per-field apply undefined when no apply row references the field but keeps global timestamp", () => {
    const lineage: JarvaLineageEntry[] = [
      entry({
        id: "chat",
        at: "2020-01-01T12:00:00.000Z",
        messageSnippet: "x",
        extractedFieldKeys: ["grantor.name"],
        applyKind: "chat_extraction",
      }),
      entry({
        id: "apply",
        at: "2020-01-02T12:00:00.000Z",
        messageSnippet: "(apply)",
        extractedFieldKeys: ["governingState"],
        applyKind: "manual_apply",
      }),
    ];
    const m = buildFieldExplainabilityMap(lineage);
    expect(m["grantor.name"]?.applyTimestamp).toBe("2020-01-02T12:00:00.000Z");
    expect(m["grantor.name"]?.lastApplyTimestampForField).toBeUndefined();
    expect(m["grantor.name"]?.lastApplyKindForField).toBeUndefined();
  });
});
