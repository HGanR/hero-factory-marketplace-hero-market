/**
 * Platform API v1 - Event by ID
 * GET /api/v1/events/:id
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformActivity } from "@/lib/db/schema";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { serializeEvent } from "@/lib/platform-api/serializers";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const apiCtx = await getPlatformApiContext(req);
  if (!apiCtx) return unauthorized();
  if (!hasScope(apiCtx.scopes, "read:events")) return forbidden();

  if (apiCtx.authType === "api_key" && apiCtx.apiKeyId) {
    recordApiKeyUsage(apiCtx.apiKeyId);
  }

  const { id } = await ctx.params;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(platformActivity)
    .where(and(eq(platformActivity.id, id), eq(platformActivity.userId, apiCtx.userId)))
    .limit(1);

  if (!row) return notFound("Event not found");

  return NextResponse.json({ data: serializeEvent(row as unknown as Record<string, unknown>) });
}
