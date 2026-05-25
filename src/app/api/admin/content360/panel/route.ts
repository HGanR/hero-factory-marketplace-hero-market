import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { requireAdminContent360Session, Content360AdminAuthError } from "@/lib/auth/require-admin-content360";
import { getDb } from "@/lib/db";
import { providerPublishJobs } from "@/lib/db/schema";
import { evaluateContent360Env } from "@/lib/social/providers/content360/content360-env";
import {
  isContent360PlatformConfigured,
  isContent360FeatureEnabledGlobal,
} from "@/lib/content360/content360-platform-env";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/content360/panel
 * Aggregate health for admin dashboard (no secrets).
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

  const envEval = evaluateContent360Env();
  const platformConfigured = isContent360PlatformConfigured();
  const featureEnabled = isContent360FeatureEnabledGlobal();

  let jobStats: {
    last24hPublished: number;
    last24hFailed: number;
    lastJobStatus: string | null;
    lastJobUpdatedAt: string | null;
  } | null = null;

  try {
    const db = await getDb();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [publishedRow] = await db
      .select({ n: count() })
      .from(providerPublishJobs)
      .where(
        and(
          eq(providerPublishJobs.provider, CONTENT360_PROVIDER_ID),
          eq(providerPublishJobs.status, "published"),
          gte(providerPublishJobs.updatedAt, since),
        ),
      );

    const [failedRow] = await db
      .select({ n: count() })
      .from(providerPublishJobs)
      .where(
        and(
          eq(providerPublishJobs.provider, CONTENT360_PROVIDER_ID),
          eq(providerPublishJobs.status, "failed"),
          gte(providerPublishJobs.updatedAt, since),
        ),
      );

    const recent = await db
      .select({
        status: providerPublishJobs.status,
        updatedAt: providerPublishJobs.updatedAt,
        errorMessage: providerPublishJobs.errorMessage,
      })
      .from(providerPublishJobs)
      .where(eq(providerPublishJobs.provider, CONTENT360_PROVIDER_ID))
      .orderBy(desc(providerPublishJobs.updatedAt))
      .limit(1);
    const last = recent[0];
    jobStats = {
      last24hPublished: Number(publishedRow?.n ?? 0),
      last24hFailed: Number(failedRow?.n ?? 0),
      lastJobStatus: last?.status ?? null,
      lastJobUpdatedAt: last?.updatedAt ? new Date(last.updatedAt).toISOString() : null,
    };
  } catch {
    jobStats = null;
  }

  return NextResponse.json(
    {
      schedulerHealth: {
        content360EnabledFlag: featureEnabled,
        revenueOsEnv: envEval,
        platformApiKeyConfigured: platformConfigured,
      },
      providerJobs: jobStats,
      availablePlatforms: [
        "instagram",
        "facebook",
        "linkedin",
        "tiktok",
        "youtube",
        "twitter",
      ],
      apiHealth: platformConfigured ? "credentials_present" : "platform_credentials_missing",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
