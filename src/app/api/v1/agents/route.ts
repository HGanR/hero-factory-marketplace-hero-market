/**
 * Platform API v1 - Agent Catalog
 * GET /api/v1/agents — List published platform agents (read:worlds or read:commerce)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformAgents } from "@/lib/db/schema.worlds";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(req: NextRequest) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "read:worlds") && !hasScope(ctx.scopes, "read:commerce")) {
    return forbidden();
  }

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const db = await getDb();

  const agents = await db
    .select()
    .from(platformAgents)
    .where(eq(platformAgents.status, "published"))
    .limit(100);

  return NextResponse.json({
    data: agents.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      capabilities: a.capabilities,
      priceToken: a.priceToken,
      priceUSD: a.priceUSD,
      creatorId: a.creatorId,
      metadataJson: a.metadataJson,
    })),
    meta: { count: agents.length },
  });
}
