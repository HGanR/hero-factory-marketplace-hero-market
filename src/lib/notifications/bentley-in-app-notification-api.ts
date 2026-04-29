/**
 * Normalized API mapping + query limits for GET/PATCH /api/notifications.
 */

import { bentleyNotificationEvents } from "@/lib/db/schema";

export const NOTIFICATION_API_LIMIT_DEFAULT = 10;
export const NOTIFICATION_API_LIMIT_MIN = 1;
export const NOTIFICATION_API_LIMIT_MAX = 25;

/** Source types surfaced in the lightweight notification center (extend as new flows emit events). */
export const NOTIFICATION_CENTER_SOURCE_TYPES = [
  "campaign_reviewer_assignment",
  "campaign_publish_approval",
  "campaign_publish_approval_report",
  "bentley_autonomous",
] as const;

export type NotificationCenterSourceType = (typeof NOTIFICATION_CENTER_SOURCE_TYPES)[number];

export function parseNotificationLimit(raw: string | null): number {
  if (raw == null || raw === "") return NOTIFICATION_API_LIMIT_DEFAULT;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return NOTIFICATION_API_LIMIT_DEFAULT;
  return Math.min(NOTIFICATION_API_LIMIT_MAX, Math.max(NOTIFICATION_API_LIMIT_MIN, n));
}

export function extractCampaignIdFromEventPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const c = (payload as Record<string, unknown>).campaignId;
  return typeof c === "string" && c.trim() ? c.trim() : "";
}

/** User-visible message: prefer body, fall back to title. */
export function buildNotificationMessage(body: string | null | undefined, title: string | null | undefined): string {
  const b = String(body ?? "").trim();
  if (b) return b.slice(0, 4000);
  const t = String(title ?? "").trim();
  return t.slice(0, 512);
}

export function timestampToIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : s;
}

export type InAppNotificationApiItem = {
  id: string;
  sourceType: string;
  campaignId: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};

export function mapNotificationRowToApiItem(
  row: typeof bentleyNotificationEvents.$inferSelect
): InAppNotificationApiItem {
  return {
    id: row.id,
    sourceType: row.sourceType,
    campaignId: extractCampaignIdFromEventPayload(row.eventPayloadJson),
    message: buildNotificationMessage(row.body, row.title),
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
    readAt: timestampToIso(row.readAt),
  };
}
