/**
 * Vendor-agnostic parsing for Content360 schedule responses (single + batch items).
 * Keeps unknown fields in `raw` — callers merge into providerResponseJson.
 */

import type {
  Content360BatchScheduleItemResult,
  Content360ScheduleResult,
} from "@/lib/social/providers/content360/content360-types";

function pickString(o: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Extract external schedule id from common vendor shapes (nested or flat). */
export function extractExternalScheduleIdFromUnknown(body: unknown, opts?: { trustGenericId?: boolean }): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const keys = opts?.trustGenericId
    ? (["externalScheduleId", "external_schedule_id", "scheduleId", "schedule_id", "remoteScheduleId", "remote_schedule_id", "id"] as const)
    : (["externalScheduleId", "external_schedule_id", "scheduleId", "schedule_id", "remoteScheduleId", "remote_schedule_id"] as const);
  const direct = pickString(o, [...keys]);
  if (direct) return direct;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const innerKeys = opts?.trustGenericId
      ? (["externalScheduleId", "scheduleId", "id"] as const)
      : (["externalScheduleId", "scheduleId"] as const);
    const inner = pickString(data as Record<string, unknown>, [...innerKeys]);
    if (inner) return inner;
  }
  return null;
}

export function extractExternalPostIdFromUnknown(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const direct = pickString(o, ["externalPostId", "external_post_id", "postId", "post_id", "platformPostId"]);
  if (direct) return direct;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const inner = pickString(data as Record<string, unknown>, ["externalPostId", "postId", "id"]);
    if (inner) return inner;
  }
  return null;
}

export function extractVendorErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const o = body as Record<string, unknown>;
  const err = o.error ?? o.message ?? (typeof o.data === "object" && o.data && !Array.isArray(o.data) ? (o.data as Record<string, unknown>).error : undefined);
  return typeof err === "string" ? err : undefined;
}

/**
 * Normalizes HTTP adapter outcome into {@link Content360ScheduleResult} while preserving full `body` as `raw`.
 */
export function normalizeHttpSchedulePostResult(args: {
  httpOk: boolean;
  status: number;
  body: unknown;
}): Content360ScheduleResult {
  const raw =
    args.body && typeof args.body === "object" && !Array.isArray(args.body) ? (args.body as Record<string, unknown>) : { value: args.body };
  if (args.status === 503) {
    return {
      ok: false,
      simulated: true,
      message: "CONTENT360_API_NOT_CONFIGURED — job persisted without remote schedule.",
      raw,
    };
  }
  const externalScheduleId = extractExternalScheduleIdFromUnknown(args.body, { trustGenericId: args.httpOk });
  const externalPostId = extractExternalPostIdFromUnknown(args.body);
  const message = extractVendorErrorMessage(args.body);
  return {
    ok: Boolean(args.httpOk),
    simulated: false,
    externalScheduleId: externalScheduleId ?? null,
    externalPostId: externalPostId ?? null,
    message,
    raw,
  };
}

/** Batch body: array may live under items | results | posts | data */
export function extractBatchItemsArray(body: unknown): unknown[] | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const candidates = [o.items, o.results, o.posts, o.data];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return null;
}

export function parseContent360BatchItemRow(raw: unknown): Content360BatchScheduleItemResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const campaignPostId =
    typeof item.campaignPostId === "string"
      ? item.campaignPostId
      : typeof item.postId === "string"
        ? item.postId
        : typeof item.campaign_post_id === "string"
          ? item.campaign_post_id
          : "";
  if (!campaignPostId) return null;

  const ok = Boolean(item.ok ?? item.success ?? item.scheduled);
  const externalScheduleId =
    pickString(item, ["externalScheduleId", "external_schedule_id", "scheduleId", "schedule_id", "remoteScheduleId", "id"]) ?? null;
  const externalPostId = pickString(item, ["externalPostId", "external_post_id", "postId", "post_id", "platformPostId"]);
  const message = typeof item.error === "string" ? item.error : typeof item.message === "string" ? item.message : undefined;

  return {
    campaignPostId,
    ok,
    simulated: false,
    externalScheduleId,
    externalPostId: externalPostId ?? null,
    message,
    raw: item as Record<string, unknown>,
  };
}
