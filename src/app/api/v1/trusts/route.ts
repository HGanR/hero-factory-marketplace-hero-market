/**
 * Platform API v1 - Trusts
 * GET /api/v1/trusts - List trusts for authenticated user
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden } from "@/lib/platform-api/errors";
import { serializeTrust } from "@/lib/platform-api/serializers";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(req: NextRequest) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "read:trusts")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(trusts)
    .where(eq(trusts.userId, ctx.userId))
    .limit(100);

  return NextResponse.json({
    data: rows.map((r) => serializeTrust(r as unknown as Record<string, unknown>)),
    meta: { count: rows.length },
  });
}
