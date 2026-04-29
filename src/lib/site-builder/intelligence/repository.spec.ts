import type { SitePlannerInput } from "@/lib/site-builder/ai/schemas";
import {
  enrichPlannerInputWithRetrievedPatterns,
  findSimilarSuccessfulVariants,
} from "@/lib/site-builder/intelligence/repository";
import { mysqlRows } from "@/lib/site-builder/db";

function mockDbRows(rows: Record<string, unknown>[]) {
  return {
    execute: jest.fn().mockResolvedValue([rows, []] as [unknown, unknown]),
  };
}

describe("findSimilarSuccessfulVariants", () => {
  it("maps mysql rows to SimilarSuccessfulVariantRow", async () => {
    const db = mockDbRows([
      {
        id: "a1",
        layoutVariantIndex: 2,
        evaluationScore: 88,
        sectionRegistryKeysJson: '["hero_primary","faq"]',
        industry: "Legal",
        siteType: "saas",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const r = await findSimilarSuccessfulVariants(db as never, 1, { limit: 5 });
    expect(r).toHaveLength(1);
    expect(r[0]!.layoutVariantIndex).toBe(2);
    expect(r[0]!.sectionRegistryKeysJson).toContain("hero_primary");
  });
});

describe("enrichPlannerInputWithRetrievedPatterns", () => {
  const baseInput: SitePlannerInput = {
    userPrompt: "Test brief",
    siteType: "auto",
    styleIntensity: 55,
    web3VisualMode: false,
    industry: "Legal",
  };

  it("returns empty hints when there are no matches", async () => {
    const db = mockDbRows([]);
    const out = await enrichPlannerInputWithRetrievedPatterns(db as never, 1, baseInput, {});
    expect(out.patternHints).toBe("");
    expect(out.matches).toHaveLength(0);
  });

  it("builds pattern hint text and suggests layout index mode when input has no layoutVariantIndex", async () => {
    const db = mockDbRows([
      {
        id: "1",
        layoutVariantIndex: 1,
        evaluationScore: 90,
        sectionRegistryKeysJson: '["hero_primary","faq","footer_standard"]',
        industry: "Legal",
        siteType: "auto",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "2",
        layoutVariantIndex: 1,
        evaluationScore: 85,
        sectionRegistryKeysJson: '["hero_primary","value_props"]',
        industry: "Legal",
        siteType: "auto",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    const out = await enrichPlannerInputWithRetrievedPatterns(db as never, 1, baseInput, {
      industry: "Legal",
    });
    expect(out.patternHints).toMatch(/Pattern memory/);
    expect(out.patternHints).toMatch(/hero_primary/);
    expect(out.suggestedLayoutVariantIndex).toBe(1);
    expect(out.input.layoutVariantIndex).toBe(1);
  });

  it("does not override explicit layoutVariantIndex", async () => {
    const db = mockDbRows([
      {
        id: "1",
        layoutVariantIndex: 1,
        evaluationScore: 90,
        sectionRegistryKeysJson: '["footer_standard"]',
        industry: null,
        siteType: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const withLvi: SitePlannerInput = { ...baseInput, layoutVariantIndex: 5 };
    const out = await enrichPlannerInputWithRetrievedPatterns(db as never, 1, withLvi, {});
    expect(out.input.layoutVariantIndex).toBe(5);
  });

  it("returns enrichmentFailed when findSimilar query throws", async () => {
    const db = { execute: jest.fn().mockRejectedValue(new Error("tidb ddl")) };
    const out = await enrichPlannerInputWithRetrievedPatterns(db as never, 1, baseInput, {});
    expect(out.enrichmentFailed).toBe(true);
    expect(out.enrichmentError).toMatch(/tidb ddl/);
    expect(out.matches).toHaveLength(0);
  });
});

describe("mysqlRows helper (used by repository)", () => {
  it("unwraps [rows, fields] tuple", () => {
    const r = mysqlRows([[{ id: 1 }], []]);
    expect(r).toEqual([{ id: 1 }]);
  });
});
