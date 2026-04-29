/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  isPublishApprovalReportDeliveryDue,
  mergePublishApprovalReportScheduleOnPatch,
  parsePublishApprovalReportScheduleJson,
  publishApprovalReportDeliveryWindowKey,
  PublishApprovalReportScheduleInputSchema,
  toPublishApprovalReportSchedulePublic,
  utcMondayDateString,
} from "@/lib/revenue-os/publish-approval-report-schedule";

const validInput = {
  enabled: true,
  frequency: "daily" as const,
  format: "json" as const,
  recipientMode: "owner_only" as const,
};

describe("PublishApprovalReportScheduleInputSchema", () => {
  it("accepts valid payloads", () => {
    expect(PublishApprovalReportScheduleInputSchema.parse(validInput)).toEqual(validInput);
  });

  it("rejects extra keys", () => {
    expect(() =>
      PublishApprovalReportScheduleInputSchema.parse({ ...validInput, lastDeliveryWindowKey: "x" })
    ).toThrow();
  });
});

describe("parsePublishApprovalReportScheduleJson", () => {
  it("returns null for invalid", () => {
    expect(parsePublishApprovalReportScheduleJson(null)).toBeNull();
    expect(parsePublishApprovalReportScheduleJson({})).toBeNull();
  });

  it("parses persisted shape", () => {
    const s = parsePublishApprovalReportScheduleJson({
      ...validInput,
      lastDeliveryWindowKey: "2026-04-05",
      lastDeliveredAt: "2026-04-05T10:00:00.000Z",
    });
    expect(s?.enabled).toBe(true);
    expect(s?.lastDeliveryWindowKey).toBe("2026-04-05");
  });
});

describe("toPublishApprovalReportSchedulePublic", () => {
  it("strips internal window key", () => {
    const pub = toPublishApprovalReportSchedulePublic({
      ...validInput,
      lastDeliveryWindowKey: "secret",
      lastDeliveredAt: "2026-01-01T00:00:00.000Z",
    });
    expect(pub).toEqual({
      ...validInput,
      lastDeliveredAt: "2026-01-01T00:00:00.000Z",
    });
    expect((pub as { lastDeliveryWindowKey?: string }).lastDeliveryWindowKey).toBeUndefined();
  });
});

describe("publishApprovalReportDeliveryWindowKey", () => {
  it("uses UTC date for daily", () => {
    const d = new Date("2026-04-05T23:00:00.000Z");
    expect(publishApprovalReportDeliveryWindowKey("daily", d)).toBe("2026-04-05");
  });

  it("uses week- prefix with Monday UTC for weekly", () => {
    const wed = new Date("2026-04-08T12:00:00.000Z"); // Wednesday
    expect(publishApprovalReportDeliveryWindowKey("weekly", wed)).toBe(`week-${utcMondayDateString(wed)}`);
    expect(utcMondayDateString(wed)).toBe("2026-04-06");
  });
});

describe("isPublishApprovalReportDeliveryDue", () => {
  it("is false when disabled", () => {
    expect(
      isPublishApprovalReportDeliveryDue({
        schedule: { ...validInput, enabled: false },
        now: new Date("2026-04-05T12:00:00.000Z"),
      })
    ).toBe(false);
  });

  it("is true when never delivered in current window", () => {
    expect(
      isPublishApprovalReportDeliveryDue({
        schedule: { ...validInput, enabled: true },
        now: new Date("2026-04-05T12:00:00.000Z"),
      })
    ).toBe(true);
  });

  it("is false when same window already recorded", () => {
    const now = new Date("2026-04-05T15:00:00.000Z");
    const key = publishApprovalReportDeliveryWindowKey("daily", now);
    expect(
      isPublishApprovalReportDeliveryDue({
        schedule: { ...validInput, enabled: true, lastDeliveryWindowKey: key },
        now,
      })
    ).toBe(false);
  });

  it("is true again on next UTC day for daily", () => {
    const schedule = {
      ...validInput,
      enabled: true,
      lastDeliveryWindowKey: "2026-04-05",
    };
    expect(
      isPublishApprovalReportDeliveryDue({
        schedule,
        now: new Date("2026-04-06T01:00:00.000Z"),
      })
    ).toBe(true);
  });
});

describe("mergePublishApprovalReportScheduleOnPatch", () => {
  it("clears tracking when disabling", () => {
    const m = mergePublishApprovalReportScheduleOnPatch({
      prev: { ...validInput, lastDeliveryWindowKey: "x", lastDeliveredAt: "y" },
      input: { ...validInput, enabled: false },
    });
    expect(m.enabled).toBe(false);
    expect((m as { lastDeliveryWindowKey?: string }).lastDeliveryWindowKey).toBeUndefined();
  });

  it("preserves window when editing format only", () => {
    const m = mergePublishApprovalReportScheduleOnPatch({
      prev: { ...validInput, lastDeliveryWindowKey: "2026-04-05" },
      input: { ...validInput, format: "csv" },
    });
    expect(m.format).toBe("csv");
    expect(m.lastDeliveryWindowKey).toBe("2026-04-05");
  });

  it("resets window when frequency changes", () => {
    const m = mergePublishApprovalReportScheduleOnPatch({
      prev: { ...validInput, frequency: "daily", lastDeliveryWindowKey: "2026-04-05" },
      input: { ...validInput, frequency: "weekly" },
    });
    expect(m.frequency).toBe("weekly");
    expect((m as { lastDeliveryWindowKey?: string }).lastDeliveryWindowKey).toBeUndefined();
  });
});
