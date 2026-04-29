import { describe, it, expect } from "@jest/globals";
import type { PlatformPerformanceSnapshot } from "@/lib/social/platform-performance-sync-contract";
import {
  formatAnalyticsSummaryLine,
  normalizePlatformSnapshotToPayload,
  parseStoredAnalyticsPayload,
} from "@/lib/social/governed-post-analytics-normalize";

describe("governed-post-analytics-normalize", () => {
  it("normalizePlatformSnapshotToPayload maps Instagram snapshot fields", () => {
    const snap: PlatformPerformanceSnapshot = {
      platform: "instagram",
      externalPostId: "123",
      capturedAt: "2026-01-01T00:00:00.000Z",
      impressions: 10,
      reach: 8,
      likes: 3,
      comments: 1,
      engagement: 12,
      saves: 2,
      videoViews: 5,
    };
    const p = normalizePlatformSnapshotToPayload(snap);
    expect(p.normalized.impressions).toBe(10);
    expect(p.normalized.reach).toBe(8);
    expect(p.normalized.reactions).toBe(3);
    expect(p.normalized.comments).toBe(1);
    expect(p.normalized.engagementsTotal).toBe(12);
    expect(p.normalized.saves).toBe(2);
    expect(p.normalized.videoViews).toBe(5);
    expect(p.sourceNotes.some((s) => s.includes("Instagram"))).toBe(true);
    expect(p.comparatorCaveat?.length).toBeGreaterThan(10);
  });

  it("normalizePlatformSnapshotToPayload maps LinkedIn snapshot fields", () => {
    const snap: PlatformPerformanceSnapshot = {
      platform: "linkedin",
      externalPostId: "urn:li:ugcPost:1",
      capturedAt: "2026-01-01T00:00:00.000Z",
      likes: 4,
      comments: 2,
      engagement: 6,
    };
    const p = normalizePlatformSnapshotToPayload(snap);
    expect(p.normalized.reactions).toBe(4);
    expect(p.normalized.comments).toBe(2);
    expect(p.normalized.engagementsTotal).toBe(6);
    expect(p.normalized.impressions).toBeUndefined();
    expect(p.sourceNotes.some((s) => s.includes("LinkedIn"))).toBe(true);
  });

  it("parseStoredAnalyticsPayload rejects unknown version", () => {
    expect(parseStoredAnalyticsPayload({ version: 99, normalized: {}, platformSnapshot: {} })).toBeNull();
    expect(parseStoredAnalyticsPayload(null)).toBeNull();
  });

  it("formatAnalyticsSummaryLine builds a compact line", () => {
    const s = formatAnalyticsSummaryLine({
      normalized: { impressions: 100, engagementsTotal: 12 },
      fetchedAtIso: "2026-04-01T12:00:00.000Z",
    });
    expect(s).toContain("100 impr");
    expect(s).toContain("12 eng");
    expect(s).toContain("synced");
  });
});
