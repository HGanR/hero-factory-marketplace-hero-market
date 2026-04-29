import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { evaluateRevenueOsSession } from "@/lib/revenue-os-session";

export const REVENUE_OS_ACCESS_DENIED_ERROR = "REVENUE_OS_ACCESS_DENIED" as const;
export const REVENUE_OS_ACCESS_DENIED_MESSAGE = "See admin for access to Revenue OS." as const;

export function revenueOsAccessDeniedResponse(): NextResponse {
  return NextResponse.json(
    {
      error: REVENUE_OS_ACCESS_DENIED_ERROR,
      message: REVENUE_OS_ACCESS_DENIED_MESSAGE,
    },
    { status: 403 }
  );
}

/**
 * Revenue OS product APIs: block marketplace users who are logged in but lack ROS access.
 * Returns a 403 NextResponse when denied; otherwise null (caller continues — may still 401 if unauthenticated).
 *
 * Admins bypass. Unauthenticated callers return null so existing handlers can return empty payloads or 401.
 */
export async function enforceRevenueOsApiAccess(request?: NextRequest): Promise<NextResponse | null> {
  let verdict: Awaited<ReturnType<typeof evaluateRevenueOsSession>>;
  if (request != null) {
    verdict = await evaluateRevenueOsSession((name) => request.cookies.get(name)?.value);
  } else {
    const store = await cookies();
    verdict = await evaluateRevenueOsSession((name) => store.get(name)?.value);
  }
  if (verdict === "deny") return revenueOsAccessDeniedResponse();
  return null;
}
