import "server-only";

import { getContent360ApiBase, getContent360RequestTimeoutMs, isContent360ApiBaseConfigured } from "@/lib/social/providers/content360/content360-env";

/**
 * Low-level HTTP client for Content360.
 *
 * No outbound calls unless `CONTENT360_API_BASE` is set (trimmed non-empty).
 * Request timeout from `CONTENT360_REQUEST_TIMEOUT_MS` (see `content360-env.ts`).
 */
export function isContent360ApiConfigured(): boolean {
  return isContent360ApiBaseConfigured();
}

export class Content360HttpClient {
  private readonly baseUrl: string | null;
  private readonly timeoutMs: number;

  constructor() {
    this.baseUrl = getContent360ApiBase();
    this.timeoutMs = getContent360RequestTimeoutMs();
  }

  private abortSignal(): AbortSignal {
    return AbortSignal.timeout(this.timeoutMs);
  }

  async verifyConnection(_accessToken: string): Promise<{ ok: boolean; status: number; body: unknown }> {
    if (!this.baseUrl) {
      return { ok: false, status: 503, body: { error: "CONTENT360_API_NOT_CONFIGURED" } };
    }
    // TODO: replace with real Content360 verify endpoint + auth header contract.
    return { ok: false, status: 501, body: { error: "CONTENT360_VERIFY_NOT_IMPLEMENTED" } };
  }

  async schedulePost(
    _accessToken: string,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; status: number; body: unknown }> {
    if (!this.baseUrl) {
      return { ok: false, status: 503, body: { error: "CONTENT360_API_NOT_CONFIGURED" } };
    }
    const idem = typeof payload.idempotencyKey === "string" && payload.idempotencyKey.trim() ? payload.idempotencyKey.trim() : "";
    const { idempotencyKey: _drop, ...wirePayload } = payload;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${_accessToken}`,
    };
    if (idem) headers["Idempotency-Key"] = idem;
    const url = `${this.baseUrl}/schedule`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(wirePayload),
        signal: this.abortSignal(),
      });
      const body = (await res.json().catch(() => ({}))) as unknown;
      return { ok: res.ok, status: res.status, body };
    } catch (e) {
      return {
        ok: false,
        status: 502,
        body: { error: "CONTENT360_SCHEDULE_NETWORK_ERROR", detail: String(e) },
      };
    }
  }

  /**
   * Optional vendor batch endpoint. On 404/501/5xx or unparsable body, callers should fall back to {@link schedulePost} per item.
   */
  async scheduleBatch(
    accessToken: string,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; status: number; body: unknown }> {
    if (!this.baseUrl) {
      return { ok: false, status: 503, body: { error: "CONTENT360_API_NOT_CONFIGURED" } };
    }
    const idem = typeof payload.idempotencyKey === "string" && payload.idempotencyKey.trim() ? payload.idempotencyKey.trim() : "";
    const { idempotencyKey: _drop, ...wirePayload } = payload;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    if (idem) headers["Idempotency-Key"] = idem;
    const url = `${this.baseUrl}/schedule/batch`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(wirePayload),
        signal: this.abortSignal(),
      });
      const body = (await res.json().catch(() => ({}))) as unknown;
      return { ok: res.ok, status: res.status, body };
    } catch (e) {
      return {
        ok: false,
        status: 502,
        body: { error: "CONTENT360_SCHEDULE_BATCH_NETWORK_ERROR", detail: String(e) },
      };
    }
  }

  async getJobStatus(_accessToken: string, _externalScheduleId: string): Promise<{ ok: boolean; status: number; body: unknown }> {
    if (!this.baseUrl) {
      return { ok: false, status: 503, body: { error: "CONTENT360_API_NOT_CONFIGURED" } };
    }
    return { ok: false, status: 501, body: { error: "CONTENT360_JOB_STATUS_NOT_IMPLEMENTED" } };
  }

  async cancelScheduledPost(
    _accessToken: string,
    _externalScheduleId: string,
  ): Promise<{ ok: boolean; status: number; body: unknown }> {
    if (!this.baseUrl) {
      return { ok: false, status: 503, body: { error: "CONTENT360_API_NOT_CONFIGURED" } };
    }
    return { ok: false, status: 501, body: { error: "CONTENT360_CANCEL_NOT_IMPLEMENTED" } };
  }
}
