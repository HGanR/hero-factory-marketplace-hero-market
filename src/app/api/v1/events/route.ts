/**
 * Platform API v1 - Events
 * GET /api/v1/events - List platform activity events
 */
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformActivity } from "@/lib/db/schema";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden } from "@/lib/platform-api/errors";
import { serializeEvent } from "@/lib/platform-api/serializers";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(req: NextRequest) {
  const apiCtx = await getPlatformApiContext(req);
  if (!apiCtx) return unauthorized();
  if (!hasScope(apiCtx.scopes, "read:events")) return forbidden();

  if (apiCtx.authType === "api_key" && apiCtx.apiKeyId) {
    recordApiKeyUsage(apiCtx.apiKeyId);
  }

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10) || 50, 100);
  const trustId = req.nextUrl.searchParams.get("trustId");

  const db = await getDb();
  const rows = trustId
    ? await db
        .select()
        .from(platformActivity)
        .where(
          and(
            eq(platformActivity.userId, apiCtx.userId),
            eq(platformActivity.trustId, trustId)
          )
        )
        .orderBy(desc(platformActivity.createdAt))
        .limit(limit)
    : await db
        .select()
        .from(platformActivity)
        .where(eq(platformActivity.userId, apiCtx.userId))
        .orderBy(desc(platformActivity.createdAt))
        .limit(limit);

  return NextResponse.json({
    data: rows.map((r) => serializeEvent(r as unknown as Record<string, unknown>)),
    meta: { count: rows.length },
  });
}
