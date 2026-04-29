/**
 * Platform API v1 - Link Wallet
 * POST /api/v1/identity/wallets — Link a wallet to Troo identity
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
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "write:worlds")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  let body: { chain?: string; address?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const chain = String(body.chain ?? "evm").slice(0, 32);
  const address = String(body.address ?? "").trim().slice(0, 128);
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const db = await getDb();
  await resolveTrooId(ctx.userId);

  const [identity] = await db
    .select()
    .from(trooIdentities)
    .where(eq(trooIdentities.userId, ctx.userId))
    .limit(1);

  if (!identity) {
    return NextResponse.json({ error: "Identity not found" }, { status: 500 });
  }

  const allForIdentity = await db
    .select()
    .from(trooWalletLinks)
    .where(eq(trooWalletLinks.identityId, identity.id));

  const addrLower = address.toLowerCase();
  const alreadyLinked = allForIdentity.some(
    (w) => w.chain === chain && w.address.toLowerCase() === addrLower
  );
  if (alreadyLinked) {
    return NextResponse.json({
      success: true,
      alreadyLinked: true,
      wallet: { chain, address },
    });
  }

  const id = crypto.randomUUID();
  try {
    await db.insert(trooWalletLinks).values({
      id,
      identityId: identity.id,
      chain,
      address: addrLower,
      verifiedAt: null,
    });
  } catch (e) {
    if (String(e).includes("Duplicate") || String(e).includes("unique")) {
      return NextResponse.json(
        { error: "Wallet already linked to another account" },
        { status: 409 }
      );
    }
    throw e;
  }

  return NextResponse.json({
    success: true,
    alreadyLinked: false,
    wallet: { chain, address: addrLower },
  });
}
