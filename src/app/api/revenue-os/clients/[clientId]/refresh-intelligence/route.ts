import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { getClientHubRollupForOwnedClient } from "@/lib/revenue-os/client-hub-rollup";
import { assertValidClientId, getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { syncClientHubRollupToSiteIntelligence } from "@/lib/site-builder/intelligence/client-hub-rollup-sync";

type Ctx = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId } = await ctx.params;
  try {
    assertValidClientId(clientId);
  } catch {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }
  await ensureClientHubTables();
  const owned = await getOwnedClientRow(userId, clientId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const startedAt = Date.now();
  try {
    const roll = await getClientHubRollupForOwnedClient(userId, clientId, owned, { skipIntelligenceWriteback: true });
    const db = await getDb();
    const stat = await syncClientHubRollupToSiteIntelligence(db, userId, clientId, [], roll);
    const syncedAt = new Date().toISOString();
    console.info("[site-intelligence refresh]", {
      userId,
      clientId,
      rowsMatched: stat.rowsMatched,
      rowsChanged: stat.rowsChanged,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({
      success: true,
      rowsMatched: stat.rowsMatched,
      rowsChanged: stat.rowsChanged,
      syncedAt,
    });
  } catch (error) {
    console.error("[site-intelligence refresh failed]", {
      userId,
      clientId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to refresh intelligence" }, { status: 500 });
  }
}
