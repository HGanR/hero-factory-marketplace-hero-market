import { NextRequest, NextResponse } from "next/server";
import { requireAdminContent360Session, Content360AdminAuthError } from "@/lib/auth/require-admin-content360";
import { isContent360PlatformConfigured } from "@/lib/content360/content360-platform-env";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/content360/platform-status
 * Sanitized readiness for admin UI (no secrets, no API base strings).
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

  const content360PlatformConfigured = isContent360PlatformConfigured();
  return NextResponse.json({
    content360PlatformConfigured,
    canUseContent360PlatformSchedule: content360PlatformConfigured,
  });
}
