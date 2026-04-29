/**
 * Platform API v1 - Instrument by ID
 * GET /api/v1/instruments/:id
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts, trustInstruments } from "@/lib/db/schema";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { serializeInstrument } from "@/lib/platform-api/serializers";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const apiCtx = await getPlatformApiContext(req);
  if (!apiCtx) return unauthorized();
  if (!hasScope(apiCtx.scopes, "read:instruments")) return forbidden();

  if (apiCtx.authType === "api_key" && apiCtx.apiKeyId) {
    recordApiKeyUsage(apiCtx.apiKeyId);
  }

  const { id } = await ctx.params;
  const db = await getDb();

  const [instrument] = await db
    .select()
    .from(trustInstruments)
    .where(eq(trustInstruments.id, id))
    .limit(1);
  if (!instrument) return notFound("Instrument not found");

  const [trust] = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, instrument.trustId), eq(trusts.userId, apiCtx.userId)))
    .limit(1);
  if (!trust) return notFound("Instrument not found");

  return NextResponse.json({ data: serializeInstrument(instrument as unknown as Record<string, unknown>) });
}
