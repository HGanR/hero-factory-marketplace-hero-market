import { NextRequest, NextResponse } from "next/server";
import { requireAdminContent360Session, Content360AdminAuthError } from "@/lib/auth/require-admin-content360";
import { content360Fetch, Content360FetchError } from "@/lib/content360/content360-client";
import {
  getContent360AuthProbePath,
  isContent360PlatformConfigured,
} from "@/lib/content360/content360-platform-env";

export const dynamic = "force-dynamic";

const FALLBACK_PROBE_PATHS = ["/v1/me", "/me", "/v1/account", "/account"] as const;

/**
 * GET /api/admin/content360/test
 * Verifies platform Content360 credentials (never exposes the API key).
 */
export async function GET(request: NextRequest) {
  try {
    requireAdminContent360Session(request);
  } catch (e) {
    if (e instanceof Content360AdminAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  if (!isContent360PlatformConfigured()) {
    return NextResponse.json(
      {
        connected: false,
        configured: false,
        message: "CONTENT360_BASE_URL / CONTENT360_API_BASE and CONTENT360_API_KEY / CONTENT360_PLATFORM_API_KEY are not both set.",
      },
      { status: 200 },
    );
  }

  const primary = getContent360AuthProbePath();
  const paths = [primary, ...FALLBACK_PROBE_PATHS.filter((p) => p !== primary)];

  let lastErr: string | null = null;
  for (const path of paths) {
    try {
      const data = await content360Fetch<Record<string, unknown>>(path, { method: "GET" });
      return NextResponse.json(
        {
          connected: true,
          configured: true,
          probePath: path,
          account: sanitizeAccountPayload(data),
          providerStatus: typeof data.status === "string" ? data.status : "ok",
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        },
      );
    } catch (e) {
      if (e instanceof Content360FetchError && (e.httpStatus === 404 || e.httpStatus === 501)) {
        lastErr = `${path}: ${e.message}`;
        continue;
      }
      if (e instanceof Content360FetchError) {
        return NextResponse.json(
          {
            connected: false,
            configured: true,
            probePath: path,
            error: e.message,
            code: e.code,
            httpStatus: e.httpStatus,
            providerHint: summarizeBody(e.responseBody),
          },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        );
      }
      lastErr = e instanceof Error ? e.message : String(e);
      break;
    }
  }

  return NextResponse.json(
    {
      connected: false,
      configured: true,
      message: "Could not reach a known Content360 auth probe path.",
      attempts: lastErr,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

function summarizeBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ["error", "message", "code", "status"]) {
    if (k in o) out[k] = o[k];
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeAccountPayload(data: Record<string, unknown>): Record<string, unknown> {
  const allow = new Set([
    "id",
    "email",
    "name",
    "username",
    "organization",
    "organizationId",
    "plan",
    "status",
    "role",
    "locale",
    "timezone",
    "createdAt",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (allow.has(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
      out[k] = v;
    }
  }
  return out;
}
