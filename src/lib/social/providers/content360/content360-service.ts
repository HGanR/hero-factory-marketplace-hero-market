import "server-only";

import { decryptToken } from "@/lib/social/encrypt";
import type { ClientProviderConnectionRow } from "@/lib/db/schema";
import { Content360HttpClient, isContent360ApiConfigured } from "@/lib/social/providers/content360/content360-client";
import type {
  Content360BatchScheduleItemResult,
  Content360CancelResult,
  Content360JobStatusResult,
  Content360ScheduleBatchResult,
  Content360ScheduleResult,
  Content360VerifyResult,
} from "@/lib/social/providers/content360/content360-types";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";
import type {
  Content360ExecuteOutcome,
  Content360ExecuteScheduledPublishInput,
  Content360SyncNormalized,
} from "@/lib/social/providers/content360/content360-execute-types";
import {
  inferContent360SyncDisposition,
  normalizeContent360ProviderResponse,
} from "@/lib/social/providers/content360/content360-provider-response";
import {
  extractBatchItemsArray,
  normalizeHttpSchedulePostResult,
  parseContent360BatchItemRow,
} from "@/lib/social/providers/content360/content360-vendor-schedule-response";

function decryptedAccessToken(row: ClientProviderConnectionRow): string {
  const enc = row.accessTokenEnc?.trim();
  if (!enc) return "";
  try {
    return decryptToken(enc);
  } catch {
    return "";
  }
}

export class Content360Service {
  private readonly http = new Content360HttpClient();

  verifyConnection(row: ClientProviderConnectionRow): Promise<Content360VerifyResult> {
    if (row.provider !== CONTENT360_PROVIDER_ID) {
      return Promise.resolve({
        ok: false,
        message: "Not a Content360 connection row",
        checkedAt: new Date().toISOString(),
      });
    }
    const token = decryptedAccessToken(row);
    if (!token) {
      return Promise.resolve({
        ok: false,
        message: "Missing encrypted access token on connection",
        checkedAt: new Date().toISOString(),
      });
    }
    return this.http.verifyConnection(token).then((r) => {
      if (r.status === 503) {
        return {
          ok: false,
          skipped: true,
          message: "Content360 API base URL not configured — verify skipped (no outbound call).",
          checkedAt: new Date().toISOString(),
        };
      }
      return {
        ok: Boolean(r.ok),
        message: typeof (r.body as { error?: string })?.error === "string" ? (r.body as { error: string }).error : undefined,
        checkedAt: new Date().toISOString(),
      };
    });
  }

  schedulePost(
    row: ClientProviderConnectionRow,
    payload: Record<string, unknown>,
  ): Promise<Content360ScheduleResult> {
    const token = decryptedAccessToken(row);
    if (!token) {
      return Promise.resolve({ ok: false, message: "Missing credentials", simulated: true });
    }
    return this.http.schedulePost(token, payload).then((r) =>
      normalizeHttpSchedulePostResult({ httpOk: r.ok, status: r.status, body: r.body }),
    );
  }

  /**
   * Tries vendor batch scheduling; on unsupported or incomplete responses, falls back to {@link schedulePost} per row.
   */
  async scheduleBatch(
    row: ClientProviderConnectionRow,
    input: {
      campaignId: string;
      timezone: string;
      posts: Array<{
        campaignPostId: string;
        scheduledAt: string;
        targetPlatform: string;
        caption: string;
        hashtags: string | null;
        assetId: string | null;
      }>;
    },
  ): Promise<Content360ScheduleBatchResult> {
    const token = decryptedAccessToken(row);
    if (!token) {
      return {
        usedBatchEndpoint: false,
        items: input.posts.map((p) => ({
          campaignPostId: p.campaignPostId,
          ok: false,
          simulated: true,
          message: "Missing credentials",
        })),
        raw: { reason: "missing_token" },
      };
    }

    const payload: Record<string, unknown> = {
      campaignId: input.campaignId,
      timezone: input.timezone,
      posts: input.posts,
    };

    const httpRes = await this.http.scheduleBatch(token, payload);
    if (httpRes.status === 503) {
      return this.scheduleBatchPerPostFallback(row, input);
    }

    if (httpRes.ok && httpRes.status >= 200 && httpRes.status < 300) {
      const parsed = Content360Service.tryParseBatchScheduleBody(httpRes.body, input.posts.map((p) => p.campaignPostId));
      if (parsed) {
        return {
          usedBatchEndpoint: true,
          providerBatchId: parsed.providerBatchId,
          items: parsed.items,
          raw: typeof httpRes.body === "object" && httpRes.body && !Array.isArray(httpRes.body) ? (httpRes.body as Record<string, unknown>) : undefined,
        };
      }
    }

    return this.scheduleBatchPerPostFallback(row, input);
  }

  private static tryParseBatchScheduleBody(
    body: unknown,
    requiredIds: string[],
  ): { providerBatchId?: string | null; items: Content360BatchScheduleItemResult[] } | null {
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const o = body as Record<string, unknown>;
    const rawItems = extractBatchItemsArray(body);
    if (!rawItems) return null;

    const byId = new Map<string, Content360BatchScheduleItemResult>();
    for (const raw of rawItems) {
      const one = parseContent360BatchItemRow(raw);
      if (!one?.campaignPostId) continue;
      byId.set(one.campaignPostId, one);
    }

    for (const id of requiredIds) {
      if (!byId.has(id)) return null;
    }

    const items = requiredIds.map((id) => byId.get(id)!);
    const providerBatchId =
      typeof o.externalBatchId === "string"
        ? o.externalBatchId
        : typeof o.providerBatchId === "string"
          ? o.providerBatchId
          : typeof o.batchId === "string"
            ? o.batchId
            : null;

    return { providerBatchId, items };
  }

  private async scheduleBatchPerPostFallback(
    row: ClientProviderConnectionRow,
    input: {
      campaignId: string;
      timezone: string;
      posts: Array<{
        campaignPostId: string;
        scheduledAt: string;
        targetPlatform: string;
        caption: string;
        hashtags: string | null;
        assetId: string | null;
      }>;
    },
  ): Promise<Content360ScheduleBatchResult> {
    const items: Content360BatchScheduleItemResult[] = [];
    for (const p of input.posts) {
      const schedulePayload: Record<string, unknown> = {
        campaignId: input.campaignId,
        campaignPostId: p.campaignPostId,
        scheduledAt: p.scheduledAt,
        timezone: input.timezone,
        targetPlatform: p.targetPlatform,
        caption: p.caption,
        hashtags: p.hashtags,
        assetId: p.assetId,
      };
      const r = await this.schedulePost(row, schedulePayload);
      items.push({
        campaignPostId: p.campaignPostId,
        ok: r.ok,
        simulated: r.simulated,
        externalScheduleId: r.externalScheduleId,
        externalPostId: r.externalPostId,
        message: r.message,
        raw: r.raw,
      });
    }
    return { usedBatchEndpoint: false, items };
  }

  getJobStatus(row: ClientProviderConnectionRow, externalScheduleId: string): Promise<Content360JobStatusResult> {
    const token = decryptedAccessToken(row);
    if (!token) {
      return Promise.resolve({ ok: false, skipped: true });
    }
    return this.http.getJobStatus(token, externalScheduleId).then((r) => {
      if (r.status === 503) {
        return { ok: false, skipped: true, state: "unconfigured" };
      }
      return { ok: Boolean(r.ok), raw: normalizeContent360ProviderResponse(r.body) };
    });
  }

  /**
   * Poll Content360 for schedule/post state. When the HTTP adapter is unimplemented or the API base is unset,
   * returns `unconfigured` / `unknown` so the worker never fabricates a published outcome.
   */
  async syncProviderJobStatus(
    row: ClientProviderConnectionRow,
    externalScheduleId: string,
  ): Promise<Content360SyncNormalized> {
    const token = decryptedAccessToken(row);
    if (!token) {
      return { disposition: "unconfigured", skipped: true, message: "Missing credentials", raw: {} };
    }
    const r = await this.http.getJobStatus(token, externalScheduleId);
    const raw = normalizeContent360ProviderResponse(r.body);
    if (r.status === 503) {
      return { disposition: "unconfigured", skipped: true, raw };
    }
    const disposition = inferContent360SyncDisposition(raw, Boolean(r.ok));
    const externalPostId =
      typeof raw.externalPostId === "string"
        ? raw.externalPostId
        : typeof raw.postId === "string"
          ? raw.postId
          : undefined;
    const message =
      typeof raw.error === "string"
        ? raw.error
        : typeof raw.message === "string"
          ? raw.message
          : undefined;
    return { disposition, externalPostId, message, raw };
  }

  /**
   * Worker entry: confirm remote publish (or surface retryable configuration gaps). Does not claim native OAuth.
   */
  async executeScheduledPublish(input: Content360ExecuteScheduledPublishInput): Promise<Content360ExecuteOutcome> {
    const { connection, job } = input;
    if (job.status === "published" && job.externalPostId?.trim()) {
      return { kind: "published", platformPostId: job.externalPostId.trim() };
    }

    const extSched = job.externalScheduleId?.trim();
    if (extSched) {
      const sync = await this.syncProviderJobStatus(connection, extSched);
      if (sync.disposition === "unconfigured" || sync.skipped) {
        return {
          kind: "failed_retryable",
          code: "CONTENT360_API_NOT_CONFIGURED",
          message:
            sync.disposition === "unconfigured"
              ? "Content360 API is not configured or credentials are missing — cannot confirm publish state."
              : "Content360 credentials missing — cannot confirm publish state.",
          raw: sync.raw,
        };
      }
      if (sync.disposition === "unknown") {
        return {
          kind: "failed_retryable",
          code: "CONTENT360_SYNC_UNAVAILABLE",
          message: sync.message?.trim() || "Content360 job status could not be interpreted (adapter or API pending).",
          raw: sync.raw,
        };
      }
      if (sync.disposition === "published") {
        const pid = sync.externalPostId?.trim() || job.externalPostId?.trim();
        if (!pid) {
          return {
            kind: "failed_retryable",
            code: "CONTENT360_PUBLISHED_WITHOUT_ID",
            message: "Provider reported published but returned no external post id.",
            raw: sync.raw,
          };
        }
        return { kind: "published", platformPostId: pid, raw: sync.raw };
      }
      if (sync.disposition === "failed") {
        return {
          kind: "failed_terminal",
          code: "CONTENT360_PROVIDER_FAILED",
          message: sync.message?.trim() || "Content360 reported a terminal failure for this schedule.",
          raw: sync.raw,
        };
      }
      if (sync.disposition === "canceled") {
        return {
          kind: "failed_terminal",
          code: "CONTENT360_CANCELED",
          message: sync.message?.trim() || "Content360 schedule was canceled.",
          raw: sync.raw,
        };
      }
      return { kind: "awaiting_remote", providerStatus: "queued_at_content360", raw: sync.raw };
    }

    if (!isContent360ApiConfigured()) {
      return {
        kind: "failed_retryable",
        code: "CONTENT360_API_NOT_CONFIGURED",
        message:
          "No Content360 external schedule id exists and the API base is not configured — cannot push or verify this publish.",
        raw: {},
      };
    }
    return {
      kind: "failed_retryable",
      code: "CONTENT360_NO_REMOTE_SCHEDULE_ID",
      message:
        "No external schedule id on file; complete a successful remote Content360 schedule handshake before the worker can verify publish state.",
      raw: {},
    };
  }

  cancelScheduledPost(row: ClientProviderConnectionRow, externalScheduleId: string): Promise<Content360CancelResult> {
    const token = decryptedAccessToken(row);
    if (!token) {
      return Promise.resolve({ ok: false, skipped: true, message: "Missing credentials" });
    }
    return this.http.cancelScheduledPost(token, externalScheduleId).then((r) => {
      if (r.status === 503) {
        return { ok: false, skipped: true, message: "CONTENT360_API_NOT_CONFIGURED" };
      }
      return { ok: Boolean(r.ok), message: "cancel not implemented against live API" };
    });
  }
}

export {
  normalizeContent360ProviderResponse,
  normalizeContent360ProviderResponse as normalizeProviderResponse,
} from "@/lib/social/providers/content360/content360-provider-response";
