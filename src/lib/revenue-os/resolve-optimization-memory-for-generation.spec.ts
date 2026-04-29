/**
 * @jest-environment node
 */

jest.mock("@/lib/revenue-os/post-optimization-memory-db", () => {
  const actual = jest.requireActual<typeof import("@/lib/revenue-os/post-optimization-memory-db")>(
    "@/lib/revenue-os/post-optimization-memory-db"
  );
  return {
    ...actual,
    listOptimizationMemoryForUser: jest.fn(),
  };
});

import { listOptimizationMemoryForUser } from "@/lib/revenue-os/post-optimization-memory-db";
import { resolveOptimizationMemoryForGeneration } from "@/lib/revenue-os/resolve-optimization-memory-for-generation";

const mockList = listOptimizationMemoryForUser as jest.MockedFunction<typeof listOptimizationMemoryForUser>;

describe("resolveOptimizationMemoryForGeneration", () => {
  beforeEach(() => {
    mockList.mockReset();
  });

  it("returns null when userId is not usable", async () => {
    await expect(resolveOptimizationMemoryForGeneration({}, { userId: NaN as unknown as number })).resolves.toBeNull();
  });

  it("returns empty prompt when DB list is empty", async () => {
    mockList.mockResolvedValue([]);
    const r = await resolveOptimizationMemoryForGeneration({}, { userId: 42 });
    expect(r).not.toBeNull();
    expect(r?.promptBlock).toBeNull();
    expect(r?.injectedEntryIds).toEqual([]);
    expect(r?.promptWeightingSummary).toMatch(/basis=/);
  });

  it("includes promptWeightingSummary when injecting memory", async () => {
    mockList.mockResolvedValue([
      {
        id: "e1",
        source: "manual",
        outcomeKind: "positive",
        evidence: { publishCount: 4, impressions: 800 },
        summary: "s1",
        platform: "instagram",
      },
      {
        id: "e2",
        source: "manual",
        outcomeKind: "mixed",
        evidence: { publishCount: 4, impressions: 0 },
        summary: "s2",
        platform: "linkedin",
      },
    ] as never);
    const r = await resolveOptimizationMemoryForGeneration({}, { userId: 42 });
    expect(r?.promptBlock).toContain("OPTIMIZATION MEMORY");
    expect(r?.promptWeightingSummary).toContain("basis=");
    expect(r?.promptBlock).toContain("strongestMeasured");
    expect(r?.promptWeightingSummary).toContain("igMeasuredPref=on");
    expect(r?.instagramPreferenceHint).toMatch(/Instagram/);
    expect(r?.promptBlock).toContain("measuredPlatformPreferenceHint");
  });
});
