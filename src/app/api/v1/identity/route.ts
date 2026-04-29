/**
 * Platform API v1 - Identity
 * GET /api/v1/identity — Get current user's Troo ID and linked wallets
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trooIdentities, trooWalletLinks } from "@/lib/db/schema.identity";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";
import { resolveTrooId } from "@/lib/identity/troo-id";

export async function GET(req: NextRequest) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "read:worlds")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const trooId = await resolveTrooId(ctx.userId);

  const db = await getDb();
  const [identity] = await db
    .select()
    .from(trooIdentities)
    .where(eq(trooIdentities.userId, ctx.userId))
    .limit(1);

  if (!identity) {
    return NextResponse.json({
      data: {
        trooId,
        userId: ctx.userId,
        wallets: [],
      },
    });
  }

  const wallets = await db
    .select()
    .from(trooWalletLinks)
    .where(eq(trooWalletLinks.identityId, identity.id));

  return NextResponse.json({
    data: {
      trooId: identity.trooId,
      userId: ctx.userId,
      wallets: wallets.map((w) => ({
        chain: w.chain,
        address: w.address,
        verifiedAt: w.verifiedAt?.toISOString(),
      })),
    },
  });
}
