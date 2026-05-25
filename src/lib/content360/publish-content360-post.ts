import "server-only";

import { content360Fetch, Content360FetchError } from "@/lib/content360/content360-client";
import {
  getContent360PlatformPublishPath,
} from "@/lib/content360/content360-platform-env";
import { isContent360PlatformConfiguredFromEnv } from "@/lib/content360/content360-platform-env-read";
import type { PublishResult } from "@/lib/social/types";

export type PublishContent360PostInput = {
  caption: string;
  mediaUrl?: string | null;
  /** ISO 8601 — omit or null for immediate publish when vendor supports it */
  scheduledAt?: string | null;
  /** Target networks (lowercase slugs, e.g. instagram, linkedin) */
  platforms: string[];
  campaignId: string;
  postId: string;
  /** Optional UTM / lineage fields forwarded to vendor when supported */
  metadata?: Record<string, unknown>;
};

export type PublishContent360PostResult =
  | (PublishResult & { ok: true; providerMetadata: Record<string, unknown> })
  | { ok: false; code: string; message: string; providerMetadata?: Record<string, unknown> };

function extractPlatformPostId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const data = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : o;
  const candidates = [
    data.externalPostId,
    data.postId,
    data.id,
    o.externalPostId,
    o.postId,
    o.id,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
  }
  return null;
}

/**
 * Admin / platform Content360 publish using centralized `CONTENT360_API_KEY`.
 * Idempotent per post via Idempotency-Key header.
 */
export async function publishContent360Post(input: PublishContent360PostInput): Promise<PublishContent360PostResult> {
  if (!isContent360PlatformConfiguredFromEnv()) {
    return {
      ok: false,
      code: "CONTENT360_PLATFORM_NOT_CONFIGURED",
      message: "Set CONTENT360_BASE_URL (or CONTENT360_API_BASE) and CONTENT360_API_KEY (or CONTENT360_PLATFORM_API_KEY).",
    };
  }

  const path = getContent360PlatformPublishPath();
  const idempotencyKey = `content360:platform:publish:${input.campaignId}:${input.postId}`;

  const body: Record<string, unknown> = {
    caption: input.caption,
    platforms: input.platforms,
    campaignId: input.campaignId,
    postId: input.postId,
    ...(input.mediaUrl ? { mediaUrl: input.mediaUrl } : {}),
    ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
    ...(input.metadata && Object.keys(input.metadata).length ? { metadata: input.metadata } : {}),
  };

  try {
    const json = await content360Fetch<unknown>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    });
    const platformPostId = extractPlatformPostId(json);
    if (!platformPostId) {
      return {
        ok: false,
        code: "CONTENT360_MISSING_POST_ID",
        message: "Content360 accepted the request but no post id could be parsed from the response.",
        providerMetadata:
          json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {},
      };
    }
    return {
      ok: true,
      platformPostId,
      providerMetadata:
        json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {},
    };
  } catch (e) {
    if (e instanceof Content360FetchError) {
      return {
        ok: false,
        code: e.code,
        message: e.message,
        providerMetadata:
          e.responseBody && typeof e.responseBody === "object"
            ? (e.responseBody as Record<string, unknown>)
            : undefined,
      };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "CONTENT360_PUBLISH_EXCEPTION", message: msg };
  }
}
