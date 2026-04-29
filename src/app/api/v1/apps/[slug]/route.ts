/**
 * Platform API v1 - App by slug
 * GET /api/v1/apps/:slug - Get app details
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformApps } from "@/lib/db/schema.apps";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "read:apps")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const { slug } = await params;
  const db = await getDb();

  const [app] = await db
    .select()
    .from(platformApps)
    .where(eq(platformApps.slug, slug))
    .limit(1);

  if (!app) return notFound("App not found");

  const isCreator = app.creatorId === ctx.userId;
  if (!isCreator && app.status !== "published") {
    return notFound("App not found");
  }

  return NextResponse.json({
    data: {
      id: app.id,
      slug: app.slug,
      name: app.name,
      description: app.description,
      category: app.category,
      creatorId: app.creatorId,
      version: app.version,
      priceToken: app.priceToken,
      priceUSD: app.priceUSD,
      revenueShare: app.revenueShare,
      installCount: app.installCount,
      status: app.status,
      manifestJson: app.manifestJson,
      capabilitiesJson: app.capabilitiesJson,
      createdAt: app.createdAt?.toISOString(),
      updatedAt: app.updatedAt?.toISOString(),
    },
  });
}
