import "server-only";

import {
  getContent360PlatformApiKey,
  getContent360PlatformApiKeyHeaderName,
  getContent360PlatformBaseUrl,
  getContent360PlatformRequestTimeoutMs,
} from "@/lib/content360/content360-platform-env";

export class Content360FetchError extends Error {
  readonly code: string;

  readonly httpStatus: number;

  readonly responseBody: unknown;

  constructor(code: string, message: string, httpStatus: number, responseBody?: unknown) {
    super(message);
    this.name = "Content360FetchError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.responseBody = responseBody;
  }
}

function redactHeadersForLog(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (lk === "authorization" || lk.includes("api-key") || lk.includes("secret")) {
      out[k] = "[redacted]";
    } else {
      out[k] = v.length > 200 ? `${v.slice(0, 200)}…` : v;
    }
  });
  return out;
}

/**
 * Centralized outbound fetch to Content360 using the **platform** API key.
 * Never log the raw key or full Authorization value.
 */
export async function content360Fetch<T = unknown>(
  path: string,
  init: RequestInit & { parseJson?: boolean } = {},
): Promise<T> {
  const base = getContent360PlatformBaseUrl();
  const apiKey = getContent360PlatformApiKey();
  if (!base || !apiKey) {
    throw new Content360FetchError(
      "NOT_CONFIGURED",
      "Content360 platform URL or API key is not configured.",
      503,
    );
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${normalizedPath}`;
  const timeoutMs = getContent360PlatformRequestTimeoutMs();
  const parseJson = (init as { parseJson?: boolean }).parseJson !== false;
  const { parseJson: _p, headers: initHeaders, signal: initSignal, ...restInit } = init as RequestInit & {
    parseJson?: boolean;
  };

  const headers = new Headers(initHeaders ?? undefined);
  if (!headers.has("Content-Type") && restInit.body && typeof restInit.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const customHeader = getContent360PlatformApiKeyHeaderName();
  if (customHeader) {
    headers.set(customHeader, apiKey);
  } else {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      ...restInit,
      headers,
      signal: initSignal ?? AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console -- server diagnostics; never log secrets
    console.error("[content360Fetch] network_error", {
      path: normalizedPath,
      method: (init.method ?? "GET").toUpperCase(),
      elapsedMs: Date.now() - started,
      message: msg,
    });
    throw new Content360FetchError("NETWORK_ERROR", msg || "Content360 request failed", 502);
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    if (parseJson) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = { _parseError: true, snippet: text.slice(0, 400) };
      }
    } else {
      body = text;
    }
  }

  if (!res.ok) {
    // eslint-disable-next-line no-console -- structured log; no secrets
    console.error("[content360Fetch] http_error", {
      path: normalizedPath,
      method: (init.method ?? "GET").toUpperCase(),
      status: res.status,
      elapsedMs: Date.now() - started,
      responseKeys:
        body && typeof body === "object" && !Array.isArray(body)
          ? Object.keys(body as Record<string, unknown>).slice(0, 20)
          : undefined,
    });
    const msg =
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      typeof (body as { message?: string }).message === "string"
        ? String((body as { message: string }).message)
        : `Content360 HTTP ${res.status}`;
    throw new Content360FetchError("HTTP_ERROR", msg, res.status, body);
  }

  // eslint-disable-next-line no-console -- success trace without payloads
  console.info("[content360Fetch] ok", {
    path: normalizedPath,
    method: (init.method ?? "GET").toUpperCase(),
    status: res.status,
    elapsedMs: Date.now() - started,
    responseHeaders: redactHeadersForLog(res.headers),
  });

  return body as T;
}
