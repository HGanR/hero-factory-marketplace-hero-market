/**
 * Platform API v1 - Trust by ID
 * GET /api/v1/trusts/:id
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { serializeTrust } from "@/lib/platform-api/serializers";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const apiCtx = await getPlatformApiContext(req);
  if (!apiCtx) return unauthorized();
  if (!hasScope(apiCtx.scopes, "read:trusts")) return forbidden();

  if (apiCtx.authType === "api_key" && apiCtx.apiKeyId) {
    recordApiKeyUsage(apiCtx.apiKeyId);
  }

  const { id } = await ctx.params;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, id), eq(trusts.userId, apiCtx.userId)))
    .limit(1);

  if (!row) return notFound("Trust not found");

  return NextResponse.json({ data: serializeTrust(row as unknown as Record<string, unknown>) });
}
