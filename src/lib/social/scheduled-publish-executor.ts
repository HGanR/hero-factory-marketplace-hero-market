/**
 * Pure helpers for scheduled campaign post publishing — no UI, deterministic.
 */

import type { ScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";
import { parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";

export type CampaignPostLike = {
  id: string;
  status: string;
  scheduledAt: Date | string | null;
  scheduledPublishMeta?: unknown;
};

export type SocialAccountStateLike = {
  hasAccessToken: boolean;
  /** Token present but empty after decrypt */
  tokenValid: boolean;
};

const MAX_SCHEDULED_RETRIES = 3;

export type NormalizedScheduledPublishFailure = {
  code: string;
  message: string;
  retryable: boolean;
};

export function isScheduledPostDue(post: CampaignPostLike, now: Date): boolean {
  const st = String(post.status || "").toUpperCase();
  if (st === "SCHEDULED") {
    if (!post.scheduledAt) return false;
    const t = post.scheduledAt instanceof Date ? post.scheduledAt : new Date(post.scheduledAt);
    return !Number.isNaN(t.getTime()) && t.getTime() <= now.getTime();
  }
  if (st === "RETRY_SCHEDULED") {
    const meta = parseScheduledPublishMeta(post.scheduledPublishMeta);
    if (!meta.nextPublishAttemptAt) return false;
    const t = new Date(meta.nextPublishAttemptAt);
    return !Number.isNaN(t.getTime()) && t.getTime() <= now.getTime();
  }
  return false;
}

export function canAttemptScheduledPublish(
  post: CampaignPostLike,
  accountState: SocialAccountStateLike
): { ok: true } | { ok: false; reason: string } {
  const st = String(post.status || "").toUpperCase();
  if (st !== "SCHEDULED" && st !== "RETRY_SCHEDULED") {
    return { ok: false, reason: "Post is not in a schedulable state." };
  }
  if (!accountState.hasAccessToken) {
    return { ok: false, reason: "No OAuth token on file — connect the account." };
  }
  if (!accountState.tokenValid) {
    return { ok: false, reason: "Access token is missing or invalid." };
  }
  return { ok: true };
}

/**
 * Delays after failure N (1-based): 1→5m, 2→15m, 3→60m, 4+→terminal (null).
 */
/** Returns delay in milliseconds before the next retry attempt. */
export function computeScheduledPublishRetryDelay(failureCountAfterIncrement: number): number | null {
  if (failureCountAfterIncrement <= 0) return null;
  if (failureCountAfterIncrement === 1) return 5 * 60 * 1000;
  if (failureCountAfterIncrement === 2) return 15 * 60 * 1000;
  if (failureCountAfterIncrement === 3) return 60 * 60 * 1000;
  return null;
}

export function shouldTerminalFailAfterAttempt(failureCountAfterIncrement: number): boolean {
  return failureCountAfterIncrement > MAX_SCHEDULED_RETRIES;
}

export function computeNextScheduledPublishAttemptAt(
  now: Date,
  failureCountAfterIncrement: number
): Date | null {
  const ms = computeScheduledPublishRetryDelay(failureCountAfterIncrement);
  if (ms == null) return null;
  return new Date(now.getTime() + ms);
}

/** Conservative classification for retry vs hard fail. */
export function isRetryableScheduledPublishError(message: string, code?: string): boolean {
  const m = `${message} ${code ?? ""}`.toLowerCase();
  if (
    /\baccount_not_connected\b/.test(m) ||
    /\bno oauth token\b/.test(m) ||
    /\binvalid_platform\b/.test(m) ||
    /\bplatform_unsupported\b/.test(m) ||
    /\bunsupported platform\b/.test(m) ||
    /\bvalidation\b/.test(m) ||
    /\binvalid parameter\b/.test(m) ||
    /\b400\b/.test(m) ||
    (/\b403\b/.test(m) && /\bforbidden\b/.test(m)) ||
    /\bcontent (policy|violation)\b/.test(m) ||
    /\bpolicy\b.*\bviolation\b/.test(m)
  ) {
    return false;
  }
  if (
    /\b429\b/.test(m) ||
    /\brate limit\b/.test(m) ||
    /\b503\b/.test(m) ||
    /\b502\b/.test(m) ||
    /\b504\b/.test(m) ||
    /\btimeout\b/.test(m) ||
    /\betimedout\b/.test(m) ||
    /\beconnreset\b/.test(m) ||
    /\benotfound\b/.test(m) ||
    /\bfetch failed\b/.test(m) ||
    /\bnetwork\b/.test(m) ||
    /\btemporar(y|ily)\b/.test(m) ||
    /\btoken expired\b/.test(m) ||
    /\b401\b/.test(m) ||
    /\bunauthorized\b/.test(m)
  ) {
    return true;
  }
  return false;
}

export function normalizeScheduledPublishFailure(
  err: unknown,
  fallbackCode = "PUBLISH_FAILED"
): NormalizedScheduledPublishFailure {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.trim() || "Unknown error";
  const code =
    typeof err === "object" && err !== null && "code" in err && typeof (err as { code?: string }).code === "string"
      ? String((err as { code: string }).code)
      : fallbackCode;
  return {
    code,
    message: msg.slice(0, 2000),
    retryable: isRetryableScheduledPublishError(msg, code),
  };
}

export function buildRetryMetaAfterFailure(args: {
  now: Date;
  prevMeta: ScheduledPublishMeta | null | undefined;
  failure: NormalizedScheduledPublishFailure;
}): { status: "RETRY_SCHEDULED" | "FAILED"; meta: ScheduledPublishMeta; terminal: boolean } {
  const prev = parseScheduledPublishMeta(args.prevMeta);
  const nextCount = (prev.publishAttemptCount ?? 0) + 1;
  const delay = computeScheduledPublishRetryDelay(nextCount);
  const terminal = !args.failure.retryable || delay === null || shouldTerminalFailAfterAttempt(nextCount);
  const base: ScheduledPublishMeta = {
    ...prev,
    publishAttemptCount: nextCount,
    lastPublishAttemptAt: args.now.toISOString(),
    lastPublishError: args.failure.message,
    lastPublishErrorCode: args.failure.code,
  };
  if (terminal) {
    return {
      status: "FAILED",
      meta: { ...base, nextPublishAttemptAt: undefined },
      terminal: true,
    };
  }
  const nextAt = new Date(args.now.getTime() + (delay as number));
  return {
    status: "RETRY_SCHEDULED",
    meta: { ...base, nextPublishAttemptAt: nextAt.toISOString() },
    terminal: false,
  };
}
