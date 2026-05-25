import crypto from "crypto";

import { and, eq, inArray } from "drizzle-orm";

import { providerPublishJobs } from "@/lib/db/schema";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";

/** Active pipeline states — duplicate schedule requests should collapse to the same job. */
export const CONTENT360_ACTIVE_JOB_STATUSES = ["scheduled", "queued"] as const;

export type Content360ActiveJobStatus = (typeof CONTENT360_ACTIVE_JOB_STATUSES)[number];

/**
 * Stable key for deduping schedule requests (same post + provider + wall time to the second).
 * Intentional reschedule at a different time yields a different key; use `forceReschedule` to bypass dedupe.
 */
export function buildContent360ScheduleIdempotencyKey(params: {
  campaignPostId: string;
  provider: string;
  scheduledAt: Date;
}): string {
  const sec = Math.floor(params.scheduledAt.getTime() / 1000);
  const raw = `${params.provider}:${params.campaignPostId}:${sec}`;
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export function mergePayloadWithIdempotency(
  payload: Record<string, unknown> | null | undefined,
  idempotencyKey: string,
): Record<string, unknown> {
  const base = payload && typeof payload === "object" && !Array.isArray(payload) ? { ...payload } : {};
  return { ...base, idempotencyKey };
}

function scheduledAtMs(row: { scheduledAt: Date | string | null }): number {
  const raw = row.scheduledAt;
  const t = raw instanceof Date ? raw.getTime() : raw ? new Date(String(raw)).getTime() : NaN;
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Returns an existing active job for the same logical schedule slot, if any.
 * Prefers `idempotencyKey` on `provider_payload_json`; falls back to same post + provider + same UTC second for legacy rows.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findActiveContent360ScheduleDuplicate(
  db: any,
  input: {
    clientId: string;
    campaignPostId: string;
    provider: string;
    scheduledAt: Date;
    idempotencyKey: string;
  },
): Promise<{ id: string } | null> {
  const wantSec = Math.floor(input.scheduledAt.getTime() / 1000) * 1000;

  const rows = await db
    .select({
      id: providerPublishJobs.id,
      scheduledAt: providerPublishJobs.scheduledAt,
      providerPayloadJson: providerPublishJobs.providerPayloadJson,
    })
    .from(providerPublishJobs)
    .where(
      and(
        eq(providerPublishJobs.clientId, input.clientId),
        eq(providerPublishJobs.campaignPostId, input.campaignPostId),
        eq(providerPublishJobs.provider, input.provider),
        inArray(providerPublishJobs.status, [...CONTENT360_ACTIVE_JOB_STATUSES]),
      ),
    )
    .limit(40);

  for (const row of rows) {
    const payload = row.providerPayloadJson;
    const key =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>).idempotencyKey
        : undefined;
    if (typeof key === "string" && key === input.idempotencyKey) {
      return { id: row.id };
    }
    const ms = scheduledAtMs(row);
    if (Number.isFinite(ms) && Math.abs(ms - wantSec) < 1000 && (typeof key !== "string" || !key.trim())) {
      return { id: row.id };
    }
  }
  return null;
}
