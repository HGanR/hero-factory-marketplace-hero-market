import { describe, it, expect } from "@jest/globals";
import { mergeJarvaIntakeSaveMetadata } from "./persist-jarva-intake-draft";
import type { JarvaIntakeDraftPayload } from "./persist-jarva-intake-draft";
import type { JarvaLineageEntry } from "./jarva-lineage";

const minimalIntake = (): JarvaIntakeDraftPayload["intake"] =>
  ({
    schemaVersion: 1,
  }) as JarvaIntakeDraftPayload["intake"];

const sampleLineage: JarvaLineageEntry[] = [
  {
    id: "jl_1",
    at: "2025-01-01T00:00:00.000Z",
    messageSnippet: "hello",
    extractedFieldKeys: ["grantor.name"],
    targets: ["jarva_intake"],
  },
];

describe("mergeJarvaIntakeSaveMetadata", () => {
  it("preserves existing lineage when incoming lineage is omitted", () => {
    const prev: JarvaIntakeDraftPayload = {
      intake: minimalIntake(),
      schemaVersion: 1,
      lineage: sampleLineage,
      jarvaMode: "build",
    };
    const { lineageMerged, jarvaModeMerged } = mergeJarvaIntakeSaveMetadata(prev, {});
    expect(lineageMerged).toEqual(sampleLineage);
    expect(jarvaModeMerged).toBe("build");
  });

  it("preserves existing jarvaMode when incoming jarvaMode is omitted", () => {
    const prev: JarvaIntakeDraftPayload = {
      intake: minimalIntake(),
      schemaVersion: 1,
      jarvaMode: "review",
    };
    const { jarvaModeMerged } = mergeJarvaIntakeSaveMetadata(prev, {});
    expect(jarvaModeMerged).toBe("review");
  });

  it("replaces lineage when explicitly supplied (empty array)", () => {
    const prev: JarvaIntakeDraftPayload = {
      intake: minimalIntake(),
      schemaVersion: 1,
      lineage: sampleLineage,
    };
    const { lineageMerged } = mergeJarvaIntakeSaveMetadata(prev, { lineage: [] });
    expect(lineageMerged).toEqual([]);
  });

  it("replaces lineage when explicitly supplied (new rows)", () => {
    const prev: JarvaIntakeDraftPayload = {
      intake: minimalIntake(),
      schemaVersion: 1,
      lineage: sampleLineage,
    };
    const next: JarvaLineageEntry[] = [
      {
        id: "jl_2",
        at: "2025-02-01T00:00:00.000Z",
        messageSnippet: "new",
        extractedFieldKeys: [],
        targets: ["jarva_intake"],
      },
    ];
    const { lineageMerged } = mergeJarvaIntakeSaveMetadata(prev, { lineage: next });
    expect(lineageMerged).toEqual(next);
  });

  it("replaces jarvaMode when explicitly supplied", () => {
    const prev: JarvaIntakeDraftPayload = {
      intake: minimalIntake(),
      schemaVersion: 1,
      jarvaMode: "assist",
    };
    const { jarvaModeMerged } = mergeJarvaIntakeSaveMetadata(prev, { jarvaMode: "review" });
    expect(jarvaModeMerged).toBe("review");
  });

  it("uses empty lineage when no prev and lineage omitted", () => {
    const { lineageMerged } = mergeJarvaIntakeSaveMetadata(null, {});
    expect(lineageMerged).toEqual([]);
  });
});
