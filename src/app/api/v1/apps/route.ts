/**
 * Platform API v1 - Apps
 * GET /api/v1/apps - List published apps (or scope=my for creator's apps)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformApps } from "@/lib/db/schema.apps";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(req: NextRequest) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "read:apps")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const scope = req.nextUrl.searchParams.get("scope") ?? "public";
  const category = req.nextUrl.searchParams.get("category");

  const db = await getDb();

  if (scope === "my") {
    const rows = await db
      .select()
      .from(platformApps)
      .where(eq(platformApps.creatorId, ctx.userId))
      .orderBy(desc(platformApps.updatedAt))
      .limit(100);

    return NextResponse.json({
      data: rows.map((a) => ({
        id: a.id,
        slug: a.slug,
        name: a.name,
        description: a.description,
        category: a.category,
        creatorId: a.creatorId,
        version: a.version,
        priceToken: a.priceToken,
        priceUSD: a.priceUSD,
        revenueShare: a.revenueShare,
        installCount: a.installCount,
        status: a.status,
        createdAt: a.createdAt?.toISOString(),
        updatedAt: a.updatedAt?.toISOString(),
      })),
      meta: { count: rows.length },
    });
  }

  const conditions = [eq(platformApps.status, "published")];
  if (category) conditions.push(eq(platformApps.category, category));

  const rows = await db
    .select()
    .from(platformApps)
    .where(and(...conditions))
    .orderBy(desc(platformApps.installCount), desc(platformApps.updatedAt))
    .limit(50);

  return NextResponse.json({
    data: rows.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      category: a.category,
      creatorId: a.creatorId,
      version: a.version,
      priceToken: a.priceToken,
      priceUSD: a.priceUSD,
      revenueShare: a.revenueShare,
      installCount: a.installCount,
      status: a.status,
      createdAt: a.createdAt?.toISOString(),
      updatedAt: a.updatedAt?.toISOString(),
    })),
    meta: { count: rows.length },
  });
}
