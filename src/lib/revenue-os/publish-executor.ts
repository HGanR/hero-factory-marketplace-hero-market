/**
 * Executes publish for a distribution queue item + optional target (real adapter when available).
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyDistributionQueueTargets, socialAccounts } from "@/lib/db/schema";
import {
  fetchDistributionQueueTargetsForQueue,
  getDistributionQueueItemForUser,
  getDistributionQueueTargetForUser,
  markDistributionQueueFailed,
  markDistributionQueuePublished,
  type DistributionQueueRow,
  type DistributionQueueTargetRow,
} from "@/lib/revenue-os/distribution-queue-actions";
import { getAdapter } from "@/lib/social/adapters";
import { decryptToken } from "@/lib/social/encrypt";
import { normalizeAccountPlatformToSocialPlatform } from "@/lib/social/platform-identity";
import type { SocialPlatform } from "@/lib/social/config";
import type { PublishInput } from "@/lib/social/types";
import type { ConnectorRoutingStatus } from "@/lib/revenue-os/distribution-routing";

export type PublishExecutionMode = "real" | "mock" | "manual";

export type ExecutePublishActionResult = {
  ok: boolean;
  reason?: string;
  executionMode: PublishExecutionMode;
  targetPlatform?: string;
  targetProfileId?: string | null;
  payloadWarnings?: string[];
  externalPostRef?: string | null;
  queue?: DistributionQueueRow;
};

function parseRoutingStatus(raw: string | null | undefined): ConnectorRoutingStatus | null {
  if (!raw) return null;
  if (
    raw === "ready" ||
    raw === "blocked_no_connector" ||
    raw === "blocked_capability_mismatch" ||
    raw === "requires_manual_export"
  ) {
    return raw;
  }
  return null;
}

function payloadToPublishInput(payload: Record<string, unknown>): PublishInput {
  const caption =
    typeof payload.caption === "string"
      ? payload.caption
      : typeof payload.message === "string"
        ? payload.message
        : typeof payload.text === "string"
          ? payload.text
          : "";
  const hashtagsRaw = payload.hashtags;
  const hashtags =
    Array.isArray(hashtagsRaw)
      ? (hashtagsRaw as string[])
      : typeof hashtagsRaw === "string"
        ? hashtagsRaw.split(/\s+/).filter(Boolean)
        : undefined;
  const linkUrl =
    typeof payload.linkUrl === "string"
      ? payload.linkUrl
      : typeof payload.cta === "string" && payload.cta.startsWith("http")
        ? payload.cta
        : undefined;
  return { caption: caption || "(empty)", hashtags, linkUrl };
}

export async function executePublishAction(input: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
  queueTargetId?: string | null;
  /** When true, allows publish even when routing_status blocks auto path. */
  manualOverride?: boolean;
  /** When true, record success without calling external APIs (default true when no real path). */
  mockOrManual?: boolean;
  externalPostRef?: string | null;
}): Promise<ExecutePublishActionResult> {
  const queue = await getDistributionQueueItemForUser({
    userId: input.userId,
    clientId: input.clientId,
    trustId: input.trustId,
    queueId: input.queueId,
  });
  if (!queue) {
    return { ok: false, reason: "not_found", executionMode: "manual" };
  }

  let target: DistributionQueueTargetRow | null = null;
  if (input.queueTargetId) {
    target = await getDistributionQueueTargetForUser({
      userId: input.userId,
      clientId: input.clientId,
      trustId: input.trustId,
      queueTargetId: input.queueTargetId,
    });
    if (!target) {
      return { ok: false, reason: "target_not_found", executionMode: "manual" };
    }
  } else {
    const list = await fetchDistributionQueueTargetsForQueue({
      userId: input.userId,
      clientId: input.clientId,
      trustId: input.trustId,
      queueId: input.queueId,
    });
    target = list[0] ?? null;
  }

  const routing = parseRoutingStatus(target?.routingStatus ?? null);
  const isBlocked =
    routing === "blocked_no_connector" ||
    routing === "blocked_capability_mismatch" ||
    routing === "requires_manual_export";
  if (isBlocked && !input.manualOverride) {
    return {
      ok: false,
      reason: `blocked_${routing}`,
      executionMode: "manual",
      targetPlatform: target?.targetPlatform,
      targetProfileId: target?.targetProfileId ?? null,
      payloadWarnings: Array.isArray(target?.routingWarningsJson)
        ? (target.routingWarningsJson as string[])
        : undefined,
    };
  }

  const payload =
    target?.payloadJson && typeof target.payloadJson === "object"
      ? (target.payloadJson as Record<string, unknown>)
      : {};
  const warnings = Array.isArray(target?.routingWarningsJson)
    ? (target.routingWarningsJson as string[])
    : [];

  const platformKey = normalizeAccountPlatformToSocialPlatform(
    target?.targetPlatform ?? queue.platform
  );
  const profileId = target?.targetProfileId?.trim() || null;

  const forceMock = input.mockOrManual === true;
  const routingAllowsReal = routing === null || routing === "ready";
  const tryReal =
    !forceMock &&
    routingAllowsReal &&
    platformKey &&
    profileId &&
    getAdapter(platformKey);

  if (tryReal && target) {
    try {
      const db = await getDb();
      const accRows = await db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.id, profileId))
        .limit(1);
      const acc = accRows[0];
      if (
        acc &&
        acc.userId === input.userId &&
        (acc.clientId ?? "") === (input.clientId ?? "") &&
        normalizeAccountPlatformToSocialPlatform(acc.platform) === platformKey
      ) {
        const accessToken = acc.accessTokenEnc ? decryptToken(acc.accessTokenEnc) : null;
        if (accessToken) {
          const adapter = getAdapter(platformKey as SocialPlatform);
          if (adapter) {
            const pubIn = payloadToPublishInput(payload);
            const result = await adapter.publish(
              {
                id: acc.id,
                userId: acc.userId,
                clientId: acc.clientId,
                platform: acc.platform,
                authType: acc.authType,
                accessToken,
                refreshToken: acc.refreshTokenEnc ? decryptToken(acc.refreshTokenEnc) : null,
                expiresAt: acc.expiresAt ?? null,
                externalAccountId: acc.externalAccountId,
                scopes: acc.scopes,
                displayName: acc.displayName,
              },
              pubIn
            );
            const published = await markDistributionQueuePublished({
              userId: input.userId,
              clientId: input.clientId,
              trustId: input.trustId,
              queueId: input.queueId,
              externalPostRef: result.platformPostId,
              mockOrManual: false,
            });
            if (target) {
              await db
                .update(bentleyDistributionQueueTargets)
                .set({
                  targetStatus: "published",
                  updatedAt: new Date(),
                })
                .where(eq(bentleyDistributionQueueTargets.id, target.id));
            }
            const next = published.row ?? queue;
            return {
              ok: published.ok,
              reason: published.reason,
              executionMode: "real",
              targetPlatform: platformKey,
              targetProfileId: profileId,
              payloadWarnings: warnings,
              externalPostRef: result.platformPostId,
              queue: next,
            };
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await markDistributionQueueFailed({
        userId: input.userId,
        clientId: input.clientId,
        trustId: input.trustId,
        queueId: input.queueId,
        error: msg,
      });
      return {
        ok: false,
        reason: "publish_failed",
        executionMode: "real",
        targetPlatform: platformKey ?? undefined,
        targetProfileId: profileId,
        payloadWarnings: warnings,
      };
    }
  }

  const ref =
    input.externalPostRef?.trim() ||
    `mock:${input.queueId}:${Date.now().toString(36)}`.slice(0, 512);
  const published = await markDistributionQueuePublished({
    userId: input.userId,
    clientId: input.clientId,
    trustId: input.trustId,
    queueId: input.queueId,
    externalPostRef: ref,
    mockOrManual: true,
  });

  if (published.ok && target) {
    try {
      const db = await getDb();
      await db
        .update(bentleyDistributionQueueTargets)
        .set({
          targetStatus: "published",
          updatedAt: new Date(),
        })
        .where(eq(bentleyDistributionQueueTargets.id, target.id));
    } catch {
      /* ignore */
    }
  }

  return {
    ok: published.ok,
    reason: published.reason,
    executionMode: "mock",
    targetPlatform: target?.targetPlatform ?? queue.platform,
    targetProfileId: profileId,
    payloadWarnings: warnings,
    externalPostRef: ref,
    queue: published.row,
  };
}
