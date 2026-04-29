/**
 * Platform API v1 - Assets
 * GET /api/v1/assets?trustId=... - List assets (optionally filtered by trust)
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts, workflowTrustAssets } from "@/lib/db/schema";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden } from "@/lib/platform-api/errors";
import { serializeAsset } from "@/lib/platform-api/serializers";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(req: NextRequest) {
  const apiCtx = await getPlatformApiContext(req);
  if (!apiCtx) return unauthorized();
  if (!hasScope(apiCtx.scopes, "read:assets")) return forbidden();

  if (apiCtx.authType === "api_key" && apiCtx.apiKeyId) {
    recordApiKeyUsage(apiCtx.apiKeyId);
  }

  const trustId = req.nextUrl.searchParams.get("trustId");
  const db = await getDb();

  let trustIds: string[];
  if (trustId) {
    const [owned] = await db
      .select()
      .from(trusts)
      .where(and(eq(trusts.id, trustId), eq(trusts.userId, apiCtx.userId)))
      .limit(1);
    if (!owned) return NextResponse.json({ data: [], meta: { count: 0 } });
    trustIds = [trustId];
  } else {
    const userTrusts = await db
      .select({ id: trusts.id })
      .from(trusts)
      .where(eq(trusts.userId, apiCtx.userId));
    trustIds = userTrusts.map((t) => t.id);
  }

  if (trustIds.length === 0) {
    return NextResponse.json({ data: [], meta: { count: 0 } });
  }

  const rows = await db
    .select()
    .from(workflowTrustAssets)
    .where(inArray(workflowTrustAssets.trustId, trustIds))
    .limit(100);

  return NextResponse.json({
    data: rows.map((r) => serializeAsset(r as unknown as Record<string, unknown>)),
    meta: { count: rows.length },
  });
}
