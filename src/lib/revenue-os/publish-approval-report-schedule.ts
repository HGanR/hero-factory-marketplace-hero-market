/**
 * Campaign-level scheduled delivery of publish-approval compliance reports (Part 23).
 */

import { z } from "zod";

export const PUBLISH_APPROVAL_REPORT_FREQUENCY = ["daily", "weekly"] as const;
export type PublishApprovalReportFrequency = (typeof PUBLISH_APPROVAL_REPORT_FREQUENCY)[number];

export const PUBLISH_APPROVAL_REPORT_FORMAT = ["json", "csv"] as const;
export type PublishApprovalReportFormat = (typeof PUBLISH_APPROVAL_REPORT_FORMAT)[number];

export const PUBLISH_APPROVAL_REPORT_RECIPIENT_MODE = ["owner_only", "owner_and_admins"] as const;
export type PublishApprovalReportRecipientMode = (typeof PUBLISH_APPROVAL_REPORT_RECIPIENT_MODE)[number];

/** Client / API input (no server-managed dedupe fields). */
export const PublishApprovalReportScheduleInputSchema = z
  .object({
    enabled: z.boolean(),
    frequency: z.enum(PUBLISH_APPROVAL_REPORT_FREQUENCY),
    format: z.enum(PUBLISH_APPROVAL_REPORT_FORMAT),
    recipientMode: z.enum(PUBLISH_APPROVAL_REPORT_RECIPIENT_MODE),
  })
  .strict();

export type PublishApprovalReportScheduleInput = z.infer<typeof PublishApprovalReportScheduleInputSchema>;

/** Persisted in `campaigns.publish_approval_report_schedule_json`. */
export type PublishApprovalReportSchedulePersisted = PublishApprovalReportScheduleInput & {
  /** UTC window id: `YYYY-MM-DD` (daily) or `week-YYYY-MM-DD` (Monday date). */
  lastDeliveryWindowKey?: string;
  /** ISO timestamp after a successful delivery (optional audit / UI). */
  lastDeliveredAt?: string;
};

/** GET /api/campaigns/:id — omit internal dedupe key. */
export type PublishApprovalReportSchedulePublic = PublishApprovalReportScheduleInput & {
  lastDeliveredAt?: string;
};

export function parsePublishApprovalReportScheduleJson(raw: unknown): PublishApprovalReportSchedulePersisted | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return parsePublishApprovalReportScheduleJson(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const base = PublishApprovalReportScheduleInputSchema.safeParse({
    enabled: o.enabled,
    frequency: o.frequency,
    format: o.format,
    recipientMode: o.recipientMode,
  });
  if (!base.success) return null;
  let lastDeliveryWindowKey: string | undefined;
  if (typeof o.lastDeliveryWindowKey === "string" && o.lastDeliveryWindowKey.trim()) {
    lastDeliveryWindowKey = o.lastDeliveryWindowKey.trim().slice(0, 64);
  }
  let lastDeliveredAt: string | undefined;
  if (typeof o.lastDeliveredAt === "string" && o.lastDeliveredAt.trim()) {
    lastDeliveredAt = o.lastDeliveredAt.trim().slice(0, 40);
  }
  return {
    ...base.data,
    ...(lastDeliveryWindowKey ? { lastDeliveryWindowKey } : {}),
    ...(lastDeliveredAt ? { lastDeliveredAt } : {}),
  };
}

export function toPublishApprovalReportSchedulePublic(
  s: PublishApprovalReportSchedulePersisted | null
): PublishApprovalReportSchedulePublic | null {
  if (!s) return null;
  const { lastDeliveryWindowKey: _w, ...rest } = s;
  return rest;
}

/** ISO date (YYYY-MM-DD) of Monday 00:00 UTC for the week containing `d`. */
export function utcMondayDateString(d: Date): string {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff);
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Logical delivery window for dedupe: one delivery per window per campaign.
 */
export function publishApprovalReportDeliveryWindowKey(
  frequency: PublishApprovalReportFrequency,
  now: Date
): string {
  if (frequency === "daily") return now.toISOString().slice(0, 10);
  return `week-${utcMondayDateString(now)}`;
}

/**
 * True when schedule is on and we have not yet recorded a delivery for the current window.
 */
export function isPublishApprovalReportDeliveryDue(args: {
  schedule: PublishApprovalReportSchedulePersisted;
  now: Date;
}): boolean {
  if (!args.schedule.enabled) return false;
  const key = publishApprovalReportDeliveryWindowKey(args.schedule.frequency, args.now);
  const prev = args.schedule.lastDeliveryWindowKey ?? null;
  if (prev == null || prev === "") return true;
  return prev !== key;
}

export function mergePublishApprovalReportScheduleOnPatch(args: {
  prev: PublishApprovalReportSchedulePersisted | null;
  input: PublishApprovalReportScheduleInput;
}): PublishApprovalReportSchedulePersisted {
  const { prev, input } = args;
  if (!input.enabled) {
    return { ...input };
  }
  if (prev == null) {
    return { ...input };
  }
  const freqChanged = prev.frequency !== input.frequency;
  const wasDisabled = !prev.enabled;
  if (freqChanged || wasDisabled) {
    return { ...input };
  }
  return {
    ...input,
    ...(prev.lastDeliveryWindowKey ? { lastDeliveryWindowKey: prev.lastDeliveryWindowKey } : {}),
    ...(prev.lastDeliveredAt ? { lastDeliveredAt: prev.lastDeliveredAt } : {}),
  };
}
