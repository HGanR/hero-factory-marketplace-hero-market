/**
 * Platform API v1 - Trust Assets
 * GET /api/v1/trusts/:id/assets
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts, workflowTrustAssets } from "@/lib/db/schema";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { serializeAsset } from "@/lib/platform-api/serializers";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const apiCtx = await getPlatformApiContext(req);
  if (!apiCtx) return unauthorized();
  if (!hasScope(apiCtx.scopes, "read:assets")) return forbidden();

  if (apiCtx.authType === "api_key" && apiCtx.apiKeyId) {
    recordApiKeyUsage(apiCtx.apiKeyId);
  }

  const { id: trustId } = await ctx.params;
  const db = await getDb();

  const [trust] = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, apiCtx.userId)))
    .limit(1);
  if (!trust) return notFound("Trust not found");

  const rows = await db
    .select()
    .from(workflowTrustAssets)
    .where(eq(workflowTrustAssets.trustId, trustId))
    .limit(100);

  return NextResponse.json({
    data: rows.map((r) => serializeAsset(r as unknown as Record<string, unknown>)),
    meta: { count: rows.length, trustId },
  });
}
